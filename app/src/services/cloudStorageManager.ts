import {
  CloudStorageProvider,
  CloudSyncSettings,
  CloudSyncStatus,
} from '../types/cloudStorage';
import { logger } from '../utils/logger';
import { GoogleDriveAppDataProvider } from './providers/googleDriveProvider';
import { createDebouncedCloudSave } from '../utils/debounceUtils';

class CloudStorageManager {
  private providers: Map<string, CloudStorageProvider> = new Map();
  private activeProvider: CloudStorageProvider | null = null;
  private syncSettings: CloudSyncSettings = {
    autoSync: false,
  };
  private syncStatus: CloudSyncStatus = {
    isConnected: false,
    lastSync: null,
    syncInProgress: false,
    error: null,
  };

  // Callbacks for UI updates
  private onStatusChange: ((status: CloudSyncStatus) => void) | null = null;
  private onDataChange: (() => void) | null = null;
  private debouncedCloudSave: ((databaseService: any) => void) | null = null;

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

  getSettings(): CloudSyncSettings {
    return { ...this.syncSettings };
  }

  getStatus(): CloudSyncStatus {
    return { ...this.syncStatus };
  }

  setStatusChangeCallback(callback: (status: CloudSyncStatus) => void): void {
    this.onStatusChange = callback;
  }

  setDataChangeCallback(callback: () => void): void {
    this.onDataChange = callback;
  }

  async setActiveProvider(providerName: string): Promise<boolean> {
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

  async saveToCloud(databaseService: any): Promise<void> {
    if (!this.activeProvider || !this.syncSettings.autoSync) {
      return;
    }

    if (this.syncStatus.syncInProgress) {
      logger.log('Sync already in progress, skipping');
      return;
    }

    try {
      this.updateStatus({ syncInProgress: true, error: null });

      const dbData = databaseService.exportDatabase();
      await this.activeProvider.saveData(dbData);

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

    try {
      this.updateStatus({ syncInProgress: true, error: null });

      const data = await this.activeProvider.loadData();

      if (data) {
        // Get database service from global window object
        const databaseService = (window as any).databaseService;
        if (databaseService) {
          await databaseService.importDatabase(data);

          this.updateStatus({
            lastSync: new Date(),
            syncInProgress: false,
            error: null,
          });

          this.saveStatus();

          // Notify listeners that data has changed
          if (this.onDataChange) {
            this.onDataChange();
          }

          logger.log('Data loaded from cloud successfully');
          return true;
        } else {
          throw new Error('Database service not available');
        }
      } else {
        // No data in cloud, continue with local data
        this.updateStatus({ syncInProgress: false, error: null });
        logger.log('No data found in cloud, using local data');
        return false;
      }
    } catch (error) {
      this.updateStatus({
        syncInProgress: false,
        error: error instanceof Error ? error.message : 'Load failed',
      });
      logger.error('Failed to load from cloud:', error);
      return false;
    }
  }

  updateSettings(newSettings: Partial<CloudSyncSettings>): void {
    this.syncSettings = { ...this.syncSettings, ...newSettings };
    this.saveSettings();
  }

  private updateStatus(statusUpdate: Partial<CloudSyncStatus>): void {
    this.syncStatus = { ...this.syncStatus, ...statusUpdate };
    if (this.onStatusChange) {
      this.onStatusChange(this.syncStatus);
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
        this.syncSettings = { ...this.syncSettings, ...JSON.parse(saved) };
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
    const savedProvider = localStorage.getItem('activeCloudProvider');
    if (savedProvider && this.providers.has(savedProvider)) {
      const provider = this.providers.get(savedProvider)!;

      try {
        await provider.initialize();
        if (provider.isAuthenticated()) {
          this.activeProvider = provider;
          this.updateStatus({ isConnected: true });

          // Load data from cloud on app startup
          await this.loadFromCloud();
        }
      } catch (error) {
        logger.error('Failed to restore cloud provider state:', error);
        localStorage.removeItem('activeCloudProvider');
      }
    }
  }

  // Called by database service when data changes
  onDatabaseChange(databaseService: any): void {
    if (this.syncSettings.autoSync && this.activeProvider) {
      // Initialize debounced save if not already created
      if (!this.debouncedCloudSave) {
        this.debouncedCloudSave = createDebouncedCloudSave((dbService: any) =>
          this.saveToCloud(dbService)
        );
      }

      this.debouncedCloudSave(databaseService);
    }
  }
}

export const cloudStorageManager = new CloudStorageManager();
