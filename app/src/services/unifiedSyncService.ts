import { useSyncStore } from '../stores/syncStore';
import { cloudStorageManager } from './cloudStorageManager';
import { backupManager } from './backupManager';
import { logger } from '../utils/logger';

// Simple event emitter for data changes
class DataChangeEmitter {
  private listeners = new Set<() => void>();

  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit() {
    this.listeners.forEach(callback => callback());
  }
}

export const dataChangeEmitter = new DataChangeEmitter();

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
  private debouncedSync: () => void;
  private debouncedBackup: () => void;
  private isInitialized = false;
  private isPaused = false;

  constructor() {
    this.debouncedSync = debounce(this.performSync.bind(this), 2000);
    this.debouncedBackup = debounce(this.performBackup.bind(this), 5000);

    // Listen to data changes
    dataChangeEmitter.subscribe(() => {
      this.scheduleSync();
    });
  }

  async initialize() {
    if (this.isInitialized) return;

    logger.log('UNIFIED_SYNC: Initializing unified sync service');

    // Initialize cloud storage
    await cloudStorageManager.initializeFromSavedState();

    // Set backup manager provider after cloud storage initialization
    const activeProvider = cloudStorageManager.getActiveProvider();
    if (activeProvider) {
      backupManager.setProvider(activeProvider);
      // Update sync store
      useSyncStore.getState().setCloudConnected(true, activeProvider.name);
    }

    // Initialize backup cleanup
    await backupManager.initializeCleanup();

    this.isInitialized = true;
    logger.log('UNIFIED_SYNC: Initialization complete');
  }

  // Public method to trigger sync
  scheduleSync() {
    if (!this.isInitialized || this.isPaused) {
      return;
    }

    const { isCloudConnected, autoSync } = useSyncStore.getState();
    if (!isCloudConnected || !autoSync) {
      return;
    }

    logger.log('UNIFIED_SYNC: Scheduling sync...');
    useSyncStore.getState().setPending();
    this.debouncedSync();
    this.debouncedBackup();
  }

  private async performSync() {
    const { status, startSync, completeSync, failSync } =
      useSyncStore.getState();

    if (status === 'syncing') {
      logger.log('UNIFIED_SYNC: Sync already in progress, skipping');
      return;
    }

    try {
      startSync();
      logger.log('UNIFIED_SYNC: Starting sync operation');

      await cloudStorageManager.saveToCloud();

      completeSync();
      logger.log('UNIFIED_SYNC: Sync completed successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown sync error';
      failSync(errorMessage);
      logger.error('UNIFIED_SYNC: Sync failed:', error);
    }
  }

  private async performBackup() {
    try {
      logger.log('UNIFIED_SYNC: Performing backup...');
      await backupManager.onDataChange();
      logger.log('UNIFIED_SYNC: Backup completed');
    } catch (error) {
      logger.error('UNIFIED_SYNC: Backup failed:', error);
    }
  }

  // Cloud provider management
  async connectProvider(providerName: string): Promise<boolean> {
    try {
      const success = await cloudStorageManager.setActiveProvider(providerName);
      if (success) {
        logger.log('UNIFIED_SYNC: Cloud provider connected:', providerName);

        // Update sync store
        useSyncStore.getState().setCloudConnected(true, providerName);
        useSyncStore.getState().setSettings({ autoSync: true });

        // Set provider for backup manager
        const activeProvider = cloudStorageManager.getActiveProvider();
        backupManager.setProvider(activeProvider);

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
      backupManager.setProvider(null);
      useSyncStore.getState().reset();
      logger.log('UNIFIED_SYNC: Cloud provider disconnected');
    } catch (error) {
      logger.error('UNIFIED_SYNC: Failed to disconnect provider:', error);
    }
  }

  // Simplified getters
  getProviders() {
    return cloudStorageManager.getProviders();
  }

  getActiveProvider() {
    return cloudStorageManager.getActiveProvider();
  }

  // Manual sync trigger
  async forceSync(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Sync service not initialized');
    }
    await this.performSync();
  }

  // Methods to pause/resume sync
  pauseSync(): void {
    this.isPaused = true;
    logger.log('UNIFIED_SYNC: Sync operations paused');
  }

  resumeSync(): void {
    this.isPaused = false;
    logger.log('UNIFIED_SYNC: Sync operations resumed');
  }
}

export const unifiedSyncService = new UnifiedSyncService();

// Simplified React hook
export function useSync() {
  const syncStore = useSyncStore();

  return {
    ...syncStore,
    isCloudConnected: syncStore.isCloudConnected, // Backwards compatibility
    connectProvider:
      unifiedSyncService.connectProvider.bind(unifiedSyncService),
    disconnectProvider:
      unifiedSyncService.disconnectProvider.bind(unifiedSyncService),
    forceSync: unifiedSyncService.forceSync.bind(unifiedSyncService),
    providers: unifiedSyncService.getProviders(),
    activeProvider: unifiedSyncService.getActiveProvider(),
  };
}
