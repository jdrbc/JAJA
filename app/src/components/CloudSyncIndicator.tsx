import React from 'react';
import { useSync } from '../services/unifiedSyncService';

interface CloudSyncIndicatorProps {
  onClick?: () => void;
}

export function CloudSyncIndicator({ onClick }: CloudSyncIndicatorProps) {
  const { isCloudEnabled, activeProvider } = useSync();

  if (!isCloudEnabled) {
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

  return (
    <button
      onClick={onClick}
      className='flex items-center gap-2 px-3 py-1 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 text-sm'
      title={`Connected to ${activeProvider?.displayName}`}
    >
      <span>{activeProvider?.icon}</span>
      <span>Connected</span>
    </button>
  );
}
