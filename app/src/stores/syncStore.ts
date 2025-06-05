import { create } from 'zustand';
import { logger } from '../utils/logger';

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'error';

interface SyncState {
  // Sync status
  status: SyncStatus;
  lastSync: Date | null;
  error: string | null;
  isCloudConnected: boolean;
  activeProvider: string | null;
  autoSync: boolean;
  autoBackup: boolean;

  // Actions
  setPending: () => void;
  startSync: () => void;
  completeSync: () => void;
  failSync: (error: string) => void;
  reset: () => void;

  // Cloud actions (consolidated)
  setCloudConnected: (connected: boolean, provider?: string) => void;
  setSettings: (
    settings: Partial<Pick<SyncState, 'autoSync' | 'autoBackup'>>
  ) => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  // State
  status: 'idle',
  lastSync: null,
  error: null,
  isCloudConnected: false,
  activeProvider: null,
  autoSync: false,
  autoBackup: true,

  // Sync actions
  setPending: () => {
    logger.log('SYNC: Changes pending save');
    set({ status: 'pending', error: null });
  },

  startSync: () => {
    logger.log('SYNC: Starting sync operation');
    set({ status: 'syncing', error: null });
  },

  completeSync: () => {
    logger.log('SYNC: Sync completed successfully');
    set({
      status: 'idle',
      lastSync: new Date(),
      error: null,
    });
  },

  failSync: (error: string) => {
    logger.error('SYNC: Sync failed:', error);
    set({ status: 'error', error });
  },

  reset: () => {
    set({
      status: 'idle',
      lastSync: null,
      error: null,
      isCloudConnected: false,
      activeProvider: null,
    });
  },

  // Cloud actions
  setCloudConnected: (connected: boolean, provider?: string) => {
    set({
      isCloudConnected: connected,
      activeProvider: connected ? provider || null : null,
    });
  },

  setSettings: settings => {
    set(settings);
  },
}));

// Selector helpers for better performance
export const useSyncStatus = () => useSyncStore(state => state.status);
export const useSyncError = () => useSyncStore(state => state.error);
export const useSyncLastSync = () => useSyncStore(state => state.lastSync);
export const useCloudStatus = () =>
  useSyncStore(state => ({
    isConnected: state.isCloudConnected,
    provider: state.activeProvider,
    autoSync: state.autoSync,
  }));

// Status text helpers
export const getSyncStatusText = (
  status: SyncStatus,
  error?: string | null
): string => {
  switch (status) {
    case 'idle':
      return 'All changes saved';
    case 'pending':
      return 'Saving changes...';
    case 'syncing':
      return 'Syncing...';
    case 'error':
      return error || 'Sync failed';
    default:
      return 'Unknown status';
  }
};

export const getSyncStatusColor = (status: SyncStatus): string => {
  switch (status) {
    case 'idle':
      return 'text-green-600';
    case 'pending':
      return 'text-yellow-600';
    case 'syncing':
      return 'text-blue-600';
    case 'error':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};
