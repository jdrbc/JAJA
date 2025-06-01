import { useState, useCallback, useRef } from 'react';
import { useCloudStorage } from './useCloudStorage';

export type SaveStatus = 'pending' | 'saving' | 'synced';

export function useSaveStatus() {
  const [localSaveStatus, setLocalSaveStatus] = useState<SaveStatus>('synced');
  const { syncInProgress } = useCloudStorage();
  const pendingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any existing timeout when component unmounts
  const clearPendingTimeout = useCallback(() => {
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
  }, []);

  // Mark that changes are pending (user made a change)
  const markPending = useCallback(() => {
    clearPendingTimeout();
    setLocalSaveStatus('pending');

    // Auto-transition to saving after a short delay to account for debouncing
    pendingTimeoutRef.current = setTimeout(() => {
      setLocalSaveStatus('saving');
    }, 100);
  }, [clearPendingTimeout]);

  // Mark that local save is complete
  const markLocalSaved = useCallback(() => {
    clearPendingTimeout();
    // If cloud sync is in progress, stay in saving state
    if (syncInProgress) {
      setLocalSaveStatus('saving');
    } else {
      setLocalSaveStatus('synced');
    }
  }, [clearPendingTimeout, syncInProgress]);

  // Mark that an error occurred
  const markError = useCallback(() => {
    clearPendingTimeout();
    setLocalSaveStatus('synced'); // Reset to synced state on error
  }, [clearPendingTimeout]);

  // Determine final status considering both local and cloud
  const finalStatus: SaveStatus = syncInProgress ? 'saving' : localSaveStatus;

  const getStatusText = (): string => {
    switch (finalStatus) {
      case 'pending':
        return 'Unsaved changes';
      case 'saving':
        return 'Saving...';
      case 'synced':
        return 'All changes saved';
    }
  };

  const getStatusColor = (): string => {
    switch (finalStatus) {
      case 'pending':
        return 'text-orange-600';
      case 'saving':
        return 'text-blue-600';
      case 'synced':
        return 'text-green-600';
    }
  };

  return {
    status: finalStatus,
    statusText: getStatusText(),
    statusColor: getStatusColor(),
    markPending,
    markLocalSaved,
    markError,
  };
}
