import { create } from 'zustand';
import { logger } from '../utils/logger';

export type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncState {
  status: SyncStatus;
  lastSync: Date | null;
  error: string | null;

  // Actions
  startSync: () => void;
  completeSync: () => void;
  failSync: (error: string) => void;
  reset: () => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'idle',
  lastSync: null,
  error: null,

  startSync: () => {
    logger.log('SYNC: Starting sync operation');
    set({
      status: 'syncing',
      error: null,
    });
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
    set({
      status: 'error',
      error,
    });
  },

  reset: () => {
    set({
      status: 'idle',
      lastSync: null,
      error: null,
    });
  },
}));

// Selector helpers for better performance
export const useSyncStatus = () => useSyncStore(state => state.status);
export const useSyncError = () => useSyncStore(state => state.error);
export const useSyncLastSync = () => useSyncStore(state => state.lastSync);

// Status text helpers
export const getSyncStatusText = (
  status: SyncStatus,
  error?: string | null
): string => {
  switch (status) {
    case 'idle':
      return 'All changes saved';
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
    case 'syncing':
      return 'text-blue-600';
    case 'error':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};
