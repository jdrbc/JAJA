import { useState, useEffect, useCallback } from 'react';
import { cloudStorageManager } from '../services/cloudStorageManager';
import {
  CloudSyncSettings,
  CloudSyncStatus,
  CloudStorageProvider,
} from '../types/cloudStorage';
import { logger } from '../utils/logger';

export function useCloudStorage() {
  const [status, setStatus] = useState<CloudSyncStatus>(
    cloudStorageManager.getStatus()
  );
  const [settings, setSettings] = useState<CloudSyncSettings>(
    cloudStorageManager.getSettings()
  );
  const [providers] = useState<CloudStorageProvider[]>(
    cloudStorageManager.getProviders()
  );
  const [loading, setLoading] = useState(false);

  // Set up status change callback
  useEffect(() => {
    cloudStorageManager.setStatusChangeCallback(setStatus);

    // Initialize from saved state on mount
    cloudStorageManager.initializeFromSavedState();

    return () => {
      cloudStorageManager.setStatusChangeCallback(() => {});
    };
  }, []);

  // Connect to a cloud provider
  const connectProvider = useCallback(
    async (providerName: string): Promise<boolean> => {
      setLoading(true);
      try {
        const success =
          await cloudStorageManager.setActiveProvider(providerName);
        return success;
      } catch (error) {
        logger.error('Failed to connect provider:', error);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Disconnect from current provider
  const disconnect = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await cloudStorageManager.disconnect();
    } catch (error) {
      logger.error('Failed to disconnect:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update settings
  const updateSettings = useCallback(
    (newSettings: Partial<CloudSyncSettings>): void => {
      cloudStorageManager.updateSettings(newSettings);
      setSettings(cloudStorageManager.getSettings());
    },
    []
  );

  // Get current active provider
  const activeProvider = cloudStorageManager.getActiveProvider();

  return {
    // State
    status,
    settings,
    providers,
    loading,
    activeProvider,

    // Actions
    connectProvider,
    disconnect,
    updateSettings,

    // Derived state
    isConnected: status.isConnected,
    syncInProgress: status.syncInProgress,
    lastSync: status.lastSync,
    error: status.error,
  };
}
