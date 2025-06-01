import React from 'react';
import {
  useSyncStatus,
  useSyncError,
  useSyncLastSync,
  getSyncStatusText,
  getSyncStatusColor,
} from '../stores/syncStore';

interface SaveIndicatorProps {
  variant?: 'desktop' | 'mobile';
}

export function SaveIndicator({ variant = 'desktop' }: SaveIndicatorProps) {
  const status = useSyncStatus();
  const error = useSyncError();
  const lastSync = useSyncLastSync();

  const statusText = getSyncStatusText(status, error);
  const statusColor = getSyncStatusColor(status);

  if (variant === 'mobile') {
    return (
      <div className='fixed bottom-4 right-4 z-50 lg:hidden'>
        <div className='flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-full shadow-lg text-xs'>
          {(status === 'syncing' || status === 'pending') && (
            <div className='w-2 h-2 border border-blue-600 border-t-transparent rounded-full animate-spin'></div>
          )}
          <span className={statusColor}>
            {status === 'idle' && '✓'}
            {status === 'pending' && '○'}
            {status === 'syncing' && '↻'}
            {status === 'error' && '!'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className='flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg text-sm'>
      {(status === 'syncing' || status === 'pending') && (
        <div className='w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin'></div>
      )}
      <span className={statusColor}>{statusText}</span>
      {lastSync && status === 'idle' && (
        <span className='text-gray-500 text-xs ml-2'>
          {lastSync.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
