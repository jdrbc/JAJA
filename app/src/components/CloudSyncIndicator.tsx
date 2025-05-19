import React from 'react';
import { useCloudStorage } from '../hooks/useCloudStorage';

interface CloudSyncIndicatorProps {
  databaseService: any;
  onClick?: () => void;
}

export function CloudSyncIndicator({ onClick }: CloudSyncIndicatorProps) {
  const { isConnected, syncInProgress, lastSync, error, activeProvider } =
    useCloudStorage();

  if (!isConnected) {
    return (
      <button
        onClick={onClick}
        className='flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm'
        title='Click to set up cloud sync'
      >
        <span>☁️</span>
        <span>Connect Cloud</span>
      </button>
    );
  }

  const getStatusColor = () => {
    if (error) return 'text-red-600';
    if (syncInProgress) return 'text-blue-600';
    return 'text-green-600';
  };

  const getStatusText = () => {
    if (error) return 'Sync Error';
    if (syncInProgress) return 'Syncing...';
    if (lastSync) {
      const now = Date.now();
      const syncTime = lastSync.getTime();
      const diffMinutes = Math.floor((now - syncTime) / (1000 * 60));

      if (diffMinutes < 1) return 'Just synced';
      if (diffMinutes < 60) return `Synced ${diffMinutes}m ago`;

      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `Synced ${diffHours}h ago`;

      const diffDays = Math.floor(diffHours / 24);
      return `Synced ${diffDays}d ago`;
    }
    return 'Ready to sync';
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-colors ${
        error
          ? 'bg-red-100 hover:bg-red-200'
          : 'bg-green-100 hover:bg-green-200'
      }`}
      title={
        error
          ? `Error: ${error}`
          : `Connected to ${activeProvider?.displayName}`
      }
    >
      <span>{activeProvider?.icon}</span>
      <span className={getStatusColor()}>{getStatusText()}</span>
      {syncInProgress && (
        <div className='w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin'></div>
      )}
    </button>
  );
}
