import {
  CloudStorageProvider,
  CloudSyncSettings,
  CloudSyncStatus,
  ConflictResolver,
  ConflictData,
} from '../types/cloudStorage';
import { logger } from '../utils/logger';
import { GoogleDriveAppDataProvider } from './providers/googleDriveProvider';
import { databaseCompatibility } from '../database/watermelon/database';

class CloudStorageManager {
  private providers: Map<string, CloudStorageProvider> = new Map();
  private activeProvider: CloudStorageProvider | null = null;
  private syncSettings: CloudSyncSettings = {
    autoSync: false,
    autoBackup: true,
    backupIntervalMinutes: 5,
    maxBackups: 50,
  };
  private syncStatus: CloudSyncStatus = {
    isConnected: false,
    lastSync: null,
    lastBackup: null,
    syncInProgress: false,
    backupInProgress: false,
    error: null,
  };

  // Callbacks for UI updates
  private onStatusChange: ((status: CloudSyncStatus) => void) | null = null;
  private conflictResolver: ConflictResolver | null = null;
  private hasInitializedFromSavedState = false;
  private isLoadingFromCloud = false;
  private initializationPromise: Promise<void> | null = null;

  // Hash tracking for defensive saves
  private lastSavedDataHash: string | null = null;

  constructor() {
    this.registerProvider(new GoogleDriveAppDataProvider());
    this.loadSettings();
    this.loadStatus();
  }

  private registerProvider(provider: CloudStorageProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProviders(): CloudStorageProvider[] {
    return Array.from(this.providers.values());
  }

  getActiveProvider(): CloudStorageProvider | null {
    return this.activeProvider;
  }

  getStatus(): CloudSyncStatus {
    return { ...this.syncStatus };
  }

  getSettings(): CloudSyncSettings {
    return { ...this.syncSettings };
  }

  setStatusChangeCallback(callback: (status: CloudSyncStatus) => void): void {
    this.onStatusChange = callback;
  }

  setConflictResolver(resolver: ConflictResolver): void {
    this.conflictResolver = resolver;
  }

  // Method to update the last saved data hash (used by backup manager during restore)
  updateLastSavedDataHash(hash: string): void {
    this.lastSavedDataHash = hash;
    logger.log('CLOUD: Updated last saved data hash:', hash);
  }

  private updateStatus(updates: Partial<CloudSyncStatus>): void {
    this.syncStatus = { ...this.syncStatus, ...updates };
    if (this.onStatusChange) {
      this.onStatusChange(this.getStatus());
    }
  }

  updateSettings(updates: Partial<CloudSyncSettings>): void {
    this.syncSettings = { ...this.syncSettings, ...updates };
    this.saveSettings();
  }

  async setActiveProvider(
    providerName: string,
    databaseService?: any
  ): Promise<boolean> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    try {
      this.updateStatus({ syncInProgress: true, error: null });

      await provider.initialize();
      const success = await provider.signIn();

      if (success) {
        this.activeProvider = provider;
        this.updateStatus({ isConnected: true, syncInProgress: false });

        // Enable auto-sync when connecting
        this.updateSettings({ autoSync: true });

        // Save active provider state
        localStorage.setItem('activeCloudProvider', providerName);

        // Try to load data from cloud on first connection
        await this.loadFromCloud();

        return true;
      } else {
        this.updateStatus({
          syncInProgress: false,
          error: 'Authentication failed',
        });
        return false;
      }
    } catch (error) {
      this.updateStatus({
        syncInProgress: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.activeProvider) {
      try {
        await this.activeProvider.signOut();
      } catch (error) {
        logger.error('Error during provider sign out:', error);
      }
      this.activeProvider = null;
    }

    this.updateSettings({ autoSync: false });
    this.updateStatus({
      isConnected: false,
      lastSync: null,
      syncInProgress: false,
      error: null,
    });

    localStorage.removeItem('activeCloudProvider');
    this.saveStatus();
  }

  async saveToCloud(databaseService?: any): Promise<void> {
    if (!this.activeProvider || !this.syncSettings.autoSync) {
      logger.log('CLOUD: Skipping save - no provider or auto-sync disabled');
      return;
    }

    if (this.syncStatus.syncInProgress) {
      logger.log('CLOUD: Sync already in progress, skipping save');
      return;
    }

    try {
      logger.log('CLOUD: Starting saveToCloud operation');
      this.updateStatus({ syncInProgress: true, error: null });

      // Calculate hash of current data using WatermelonDB compatibility layer
      const currentDataHash = await databaseCompatibility.getContentHash();

      // Check if data has actually changed since last save
      if (
        this.lastSavedDataHash &&
        currentDataHash === this.lastSavedDataHash
      ) {
        logger.log(
          'CLOUD: Data unchanged since last save, skipping cloud save. Last saved hash: ' +
            this.lastSavedDataHash +
            ' Current hash: ' +
            currentDataHash
        );
        this.updateStatus({ syncInProgress: false });
        return;
      }

      // Get current database data and hash
      const databaseData = await databaseCompatibility.exportDatabaseAsync();
      const hashBytes = new TextEncoder().encode(currentDataHash);
      const dataWithHash = new Uint8Array(
        databaseData.length + hashBytes.length
      );
      dataWithHash.set(databaseData, 0);
      dataWithHash.set(hashBytes, databaseData.length);

      await this.activeProvider.saveData(dataWithHash);

      // Update the hash after successful save
      this.lastSavedDataHash = currentDataHash;

      this.updateStatus({
        lastSync: new Date(),
        syncInProgress: false,
        error: null,
      });

      this.saveStatus();
      logger.log('Data saved to cloud successfully');
    } catch (error) {
      this.updateStatus({
        syncInProgress: false,
        error: error instanceof Error ? error.message : 'Save failed',
      });
      logger.error('Failed to save to cloud:', error);
      throw error;
    }
  }

  async loadFromCloud(): Promise<boolean> {
    if (!this.activeProvider) {
      return false;
    }

    // Prevent concurrent load operations
    if (this.isLoadingFromCloud) {
      logger.log('CLOUD: Load already in progress, skipping duplicate request');
      return false;
    }

    try {
      logger.log('CLOUD: Starting loadFromCloud operation');
      this.isLoadingFromCloud = true;
      this.updateStatus({ syncInProgress: true, error: null });

      const cloudData = await this.activeProvider.loadData();

      if (cloudData) {
        // Extract hash from cloud data (last 64 characters)
        if (cloudData.length < 64) {
          logger.error(
            'CLOUD: Invalid cloud data format - too short to contain hash'
          );
          this.updateStatus({
            syncInProgress: false,
            error: 'Invalid cloud data format',
          });
          return false;
        }

        // Separate database data and hash
        const cloudDatabaseData = cloudData.slice(0, cloudData.length - 64);
        const cloudHashBytes = cloudData.slice(cloudData.length - 64);
        const cloudHash = new TextDecoder().decode(cloudHashBytes);

        // Get current local data for comparison
        const localData = await databaseCompatibility.exportDatabaseAsync();
        const localHash = await databaseCompatibility.getContentHash();

        // Check if there's a conflict
        if (localHash !== cloudHash) {
          logger.log(
            'CLOUD: Data conflict detected - local and cloud hashes differ'
          );

          // If we have a conflict resolver, use it
          if (this.conflictResolver) {
            const conflictData: ConflictData = {
              localData,
              cloudData: cloudDatabaseData,
              localHash,
              cloudHash,
            };

            try {
              const resolution = await this.conflictResolver(conflictData);

              switch (resolution) {
                case 'use-local':
                  logger.log('CLOUD: User chose to keep local data');
                  // Save local data to cloud to resolve conflict
                  const localDataHash =
                    await databaseCompatibility.getContentHash();
                  const localHashBytes = new TextEncoder().encode(
                    localDataHash
                  );
                  const localDataWithHash = new Uint8Array(
                    localData.length + localHashBytes.length
                  );
                  localDataWithHash.set(localData, 0);
                  localDataWithHash.set(localHashBytes, localData.length);
                  await this.activeProvider.saveData(localDataWithHash);
                  this.lastSavedDataHash = localHash;
                  break;

                case 'use-cloud':
                  logger.log('CLOUD: User chose to keep cloud data');
                  // Import cloud data
                  await databaseCompatibility.importDatabase(cloudDatabaseData);
                  this.lastSavedDataHash = cloudHash;
                  // reload with new state
                  window.location.reload();
                  break;

                case 'cancel':
                  logger.log('CLOUD: User cancelled conflict resolution');
                  this.updateStatus({ syncInProgress: false, error: null });
                  return false;
              }
            } catch (error) {
              logger.error('Conflict resolution failed:', error);
              this.updateStatus({
                syncInProgress: false,
                error: 'Conflict resolution failed',
              });
              return false;
            }
          } else {
            // No conflict resolver set - default to cloud data (original behavior)
            logger.log(
              'CLOUD: No conflict resolver set, using cloud data by default'
            );
            await databaseCompatibility.importDatabase(cloudDatabaseData);
            this.lastSavedDataHash = cloudHash;
          }
        } else {
          // No conflict - data is the same
          logger.log('CLOUD: No conflict detected, data is already in sync');
          this.lastSavedDataHash = cloudHash;
        }

        this.updateStatus({
          lastSync: new Date(),
          syncInProgress: false,
          error: null,
        });

        this.saveStatus();
        logger.log('Data loaded from cloud successfully');
        return true;
      } else {
        // No data in cloud, continue with local data
        this.updateStatus({ syncInProgress: false, error: null });
        logger.log('No data found in cloud, using local data');
        return false;
      }
    } catch (error) {
      logger.error('Failed to load from cloud:', error);
      this.updateStatus({
        syncInProgress: false,
        error: error instanceof Error ? error.message : 'Load failed',
      });
      return false;
    } finally {
      this.isLoadingFromCloud = false;
    }
  }

  private saveSettings(): void {
    localStorage.setItem(
      'cloudSyncSettings',
      JSON.stringify(this.syncSettings)
    );
  }

  private loadSettings(): void {
    const saved = localStorage.getItem('cloudSyncSettings');
    if (saved) {
      try {
        this.syncSettings = JSON.parse(saved);
      } catch (error) {
        logger.error('Failed to load cloud sync settings:', error);
      }
    }
  }

  private saveStatus(): void {
    const statusToSave = {
      lastSync: this.syncStatus.lastSync?.toISOString(),
    };
    localStorage.setItem('cloudSyncStatus', JSON.stringify(statusToSave));
  }

  private loadStatus(): void {
    const saved = localStorage.getItem('cloudSyncStatus');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.syncStatus = {
          ...this.syncStatus,
          lastSync: parsed.lastSync ? new Date(parsed.lastSync) : null,
        };
      } catch (error) {
        logger.error('Failed to load cloud sync status:', error);
      }
    }
  }

  // Initialize from saved state on app start
  async initializeFromSavedState(): Promise<void> {
    if (this.hasInitializedFromSavedState) {
      logger.log('CLOUD: Already initialized from saved state, skipping');
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      logger.log('CLOUD: Initialization already in progress, waiting...');
      return this.initializationPromise;
    }

    logger.log('CLOUD: Initializing from saved state...');

    this.initializationPromise = this._performInitialization();
    await this.initializationPromise;
    this.initializationPromise = null;
  }

  private async _performInitialization(): Promise<void> {
    this.hasInitializedFromSavedState = true;

    const savedProvider = localStorage.getItem('activeCloudProvider');
    if (savedProvider && this.providers.has(savedProvider)) {
      const provider = this.providers.get(savedProvider)!;

      try {
        // Add timeout to provider initialization
        const initPromise = provider.initialize();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Cloud provider initialization timed out'));
          }, 15000);
        });

        await Promise.race([initPromise, timeoutPromise]);

        if (provider.isAuthenticated()) {
          this.activeProvider = provider;
          this.updateStatus({ isConnected: true });

          // Load data from cloud on app startup with timeout
          logger.log('CLOUD: Provider authenticated, loading data from cloud');

          const loadPromise = this.loadFromCloud();
          const loadTimeoutPromise = new Promise(resolve => {
            setTimeout(() => {
              logger.log(
                'CLOUD: Load operation timed out, continuing with local data'
              );
              resolve(false);
            }, 10000);
          });

          const loadSuccess = await Promise.race([
            loadPromise,
            loadTimeoutPromise,
          ]);

          // Ensure sync status is properly reset after initialization
          if (loadSuccess || !this.syncStatus.syncInProgress) {
            this.updateStatus({ syncInProgress: false, error: null });
          }
        } else {
          logger.log('CLOUD: Provider not authenticated, using local data');
        }
      } catch (error) {
        logger.error('Failed to restore cloud provider state:', error);
        localStorage.removeItem('activeCloudProvider');
        // Ensure status is reset on error
        this.updateStatus({ syncInProgress: false, error: null });
      }
    } else {
      logger.log('CLOUD: No saved provider found or provider not available');
    }
  }
}

export const cloudStorageManager = new CloudStorageManager();
