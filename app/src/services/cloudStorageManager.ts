import {
  CloudStorageProvider,
  ConflictResolver,
  ConflictData,
} from '../types/cloudStorage';
import { logger } from '../utils/logger';
import { GoogleDriveAppDataProvider } from './providers/googleDriveProvider';
import { databaseCompatibility } from '../database/watermelon/database';

class CloudStorageManager {
  private providers: Map<string, CloudStorageProvider> = new Map();
  private activeProvider: CloudStorageProvider | null = null;
  private conflictResolver: ConflictResolver | null = null;
  private hasInitializedFromSavedState = false;
  private isLoadingFromCloud = false;
  private initializationPromise: Promise<void> | null = null;

  // Hash tracking for defensive saves
  private lastSavedDataHash: string | null = null;

  constructor() {
    this.registerProvider(new GoogleDriveAppDataProvider());
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

  setConflictResolver(resolver: ConflictResolver): void {
    this.conflictResolver = resolver;
  }

  updateLastSavedDataHash(hash: string): void {
    this.lastSavedDataHash = hash;
    logger.log('CLOUD: Updated last saved data hash:', hash);
  }

  async setActiveProvider(providerName: string): Promise<boolean> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    try {
      await provider.initialize();
      const success = await provider.signIn();

      if (success) {
        this.activeProvider = provider;
        localStorage.setItem('activeCloudProvider', providerName);

        // Try to load data from cloud on first connection
        await this.loadFromCloud();
        return true;
      } else {
        return false;
      }
    } catch (error) {
      logger.error('Failed to connect provider:', error);
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
    localStorage.removeItem('activeCloudProvider');
  }

  async saveToCloud(): Promise<void> {
    if (!this.activeProvider) {
      logger.log('CLOUD: No active provider for save');
      return;
    }

    try {
      logger.log('CLOUD: Starting saveToCloud operation');

      // Calculate hash of current data
      const currentDataHash = await databaseCompatibility.getContentHash();

      // Check if data has actually changed since last save
      if (
        this.lastSavedDataHash &&
        currentDataHash === this.lastSavedDataHash
      ) {
        logger.log('CLOUD: Data unchanged since last save, skipping');
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

      logger.log('CLOUD: Data saved successfully');
    } catch (error) {
      logger.error('CLOUD: Failed to save:', error);
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

      const cloudData = await this.activeProvider.loadData();

      if (cloudData) {
        // Extract hash from cloud data (last 64 characters)
        if (cloudData.length < 64) {
          logger.error('CLOUD: Invalid cloud data format - too short');
          return false;
        }

        // Separate database data and hash
        const cloudDatabaseData = cloudData.slice(0, cloudData.length - 64);
        const cloudHashBytes = cloudData.slice(cloudData.length - 64);
        const cloudHash = new TextDecoder().decode(cloudHashBytes);

        // Get current local data for comparison
        const localData = await databaseCompatibility.exportDatabaseAsync();
        const localHash = await databaseCompatibility.getContentHash();

        // Check for conflicts
        if (localHash !== cloudHash) {
          logger.log('CLOUD: Data conflict detected');

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
                  await databaseCompatibility.importDatabase(cloudDatabaseData);
                  this.lastSavedDataHash = cloudHash;
                  window.location.reload();
                  break;

                case 'cancel':
                  logger.log('CLOUD: User cancelled conflict resolution');
                  return false;
              }
            } catch (error) {
              logger.error('CLOUD: Conflict resolution failed:', error);
              return false;
            }
          } else {
            // No conflict resolver - use cloud data by default
            logger.log('CLOUD: No conflict resolver, using cloud data');
            await databaseCompatibility.importDatabase(cloudDatabaseData);
            this.lastSavedDataHash = cloudHash;
          }
        } else {
          // No conflict
          logger.log('CLOUD: No conflict detected, data in sync');
          this.lastSavedDataHash = cloudHash;
        }

        logger.log('CLOUD: Data loaded successfully');
        return true;
      } else {
        // No data in cloud
        logger.log('CLOUD: No data found in cloud');
        return false;
      }
    } catch (error) {
      logger.error('CLOUD: Failed to load:', error);
      return false;
    } finally {
      this.isLoadingFromCloud = false;
    }
  }

  // Initialize from saved state on app start
  async initializeFromSavedState(): Promise<void> {
    if (this.hasInitializedFromSavedState) {
      logger.log('CLOUD: Already initialized from saved state');
      return;
    }

    if (this.initializationPromise) {
      logger.log('CLOUD: Initialization in progress, waiting...');
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
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Cloud provider initialization timed out'));
          }, 15000);
        });

        await Promise.race([initPromise, timeoutPromise]);

        if (provider.isAuthenticated()) {
          this.activeProvider = provider;
          logger.log('CLOUD: Provider authenticated, loading data');

          // Load data with timeout
          const loadPromise = this.loadFromCloud();
          const loadTimeoutPromise = new Promise<boolean>(resolve => {
            setTimeout(() => {
              logger.log('CLOUD: Load timed out, continuing with local data');
              resolve(false);
            }, 10000);
          });

          await Promise.race([loadPromise, loadTimeoutPromise]);
        } else {
          logger.log('CLOUD: Provider not authenticated');
        }
      } catch (error) {
        logger.error('CLOUD: Failed to restore provider state:', error);
        localStorage.removeItem('activeCloudProvider');
      }
    } else {
      logger.log('CLOUD: No saved provider found');
    }
  }
}

export const cloudStorageManager = new CloudStorageManager();
