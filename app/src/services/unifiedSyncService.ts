import { useSyncStore } from '../stores/syncStore';
import { reactiveDataService } from './reactiveDataService';
import { cloudStorageManager } from './cloudStorageManager';
import { logger } from '../utils/logger';

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

class UnifiedSyncService {
  private syncStore = useSyncStore.getState();
  private debouncedSync: () => void;
  private isInitialized = false;

  constructor() {
    this.debouncedSync = debounce(this.performSync.bind(this), 2000);
  }

  async initialize() {
    if (this.isInitialized) return;

    logger.log('UNIFIED_SYNC: Initializing unified sync service');

    // Subscribe to sync store changes
    useSyncStore.subscribe((state: any) => {
      this.syncStore = state;
    });

    // Connect reactive data service
    reactiveDataService.setSyncService(this);

    // Initialize cloud storage if needed
    await cloudStorageManager.initializeFromSavedState();

    this.isInitialized = true;
    logger.log('UNIFIED_SYNC: Initialization complete');
  }

  // Public method to trigger sync (used by reactive data service)
  scheduleSync() {
    if (!this.isInitialized) {
      logger.log('UNIFIED_SYNC: Service not initialized, skipping sync');
      return;
    }

    if (!cloudStorageManager.getActiveProvider()) {
      logger.log('UNIFIED_SYNC: No cloud provider active, skipping sync');
      return;
    }

    logger.log('UNIFIED_SYNC: Scheduling sync...');
    this.debouncedSync();
  }

  private async performSync() {
    if (this.syncStore.status === 'syncing') {
      logger.log('UNIFIED_SYNC: Sync already in progress, skipping');
      return;
    }

    try {
      this.syncStore.startSync();
      logger.log('UNIFIED_SYNC: Starting sync operation');

      // Get database service for cloud sync
      const databaseService = (window as any).databaseService;
      if (!databaseService) {
        throw new Error('Database service not available');
      }

      // Perform cloud sync
      await cloudStorageManager.saveToCloud(databaseService);

      this.syncStore.completeSync();
      logger.log('UNIFIED_SYNC: Sync completed successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown sync error';
      this.syncStore.failSync(errorMessage);
      logger.error('UNIFIED_SYNC: Sync failed:', error);
    }
  }

  // Cloud provider management
  async connectProvider(providerName: string): Promise<boolean> {
    try {
      const success = await cloudStorageManager.setActiveProvider(providerName);
      if (success) {
        logger.log('UNIFIED_SYNC: Cloud provider connected:', providerName);
        // Trigger initial sync
        this.scheduleSync();
      }
      return success;
    } catch (error) {
      logger.error('UNIFIED_SYNC: Failed to connect provider:', error);
      return false;
    }
  }

  async disconnectProvider(): Promise<void> {
    try {
      await cloudStorageManager.disconnect();
      useSyncStore.getState().reset();
      logger.log('UNIFIED_SYNC: Cloud provider disconnected');
    } catch (error) {
      logger.error('UNIFIED_SYNC: Failed to disconnect provider:', error);
    }
  }

  // Status getters
  getProviders() {
    return cloudStorageManager.getProviders();
  }

  getActiveProvider() {
    return cloudStorageManager.getActiveProvider();
  }

  isCloudEnabled(): boolean {
    return !!cloudStorageManager.getActiveProvider();
  }

  // Manual sync trigger
  async forceSync(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Sync service not initialized');
    }

    await this.performSync();
  }
}

export const unifiedSyncService = new UnifiedSyncService();

// React hook for sync functionality
export function useSync() {
  const syncStore = useSyncStore();

  return {
    status: syncStore.status,
    lastSync: syncStore.lastSync,
    error: syncStore.error,
    isCloudEnabled: unifiedSyncService.isCloudEnabled(),
    connectProvider:
      unifiedSyncService.connectProvider.bind(unifiedSyncService),
    disconnectProvider:
      unifiedSyncService.disconnectProvider.bind(unifiedSyncService),
    forceSync: unifiedSyncService.forceSync.bind(unifiedSyncService),
    providers: unifiedSyncService.getProviders(),
    activeProvider: unifiedSyncService.getActiveProvider(),
  };
}
