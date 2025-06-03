import React, { useState, useEffect } from 'react';
import { BackupInfo } from '../types/cloudStorage';
import { backupManager } from '../services/backupManager';
import { useSync } from '../services/unifiedSyncService';
import { logger } from '../utils/logger';

export function BackupRestoreSettings() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const { isCloudEnabled, activeProvider } = useSync();

  const loadBackups = async () => {
    if (!isCloudEnabled) return;

    setLoading(true);
    try {
      const backupList = await backupManager.listBackups();
      setBackups(backupList);
    } catch (error) {
      logger.error('Failed to load backups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, [isCloudEnabled]);

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    setBackupError(null);
    try {
      await backupManager.createBackup(true); // Manual backup
      await loadBackups(); // Refresh the list
      logger.log('Manual backup created successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create backup';
      setBackupError(errorMessage);
      logger.error('Failed to create backup:', error);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (backupId: string, backupName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to restore from "${backupName}"? This will replace all current data and the page will reload.`
    );

    if (!confirmed) return;

    setRestoring(backupId);
    try {
      const success = await backupManager.restoreFromBackup(backupId);
      if (success) {
        logger.log('Backup restored successfully');
        // Reload the page to reflect the restored data
        window.location.reload();
      } else {
        logger.error('Failed to restore backup');
      }
    } catch (error) {
      logger.error('Failed to restore backup:', error);
    } finally {
      setRestoring(null);
    }
  };

  const handleDeleteBackup = async (backupId: string, backupName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the backup "${backupName}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const success = await backupManager.deleteBackup(backupId);
      if (success) {
        await loadBackups(); // Refresh the list
      }
    } catch (error) {
      logger.error('Failed to delete backup:', error);
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes < 1 ? 'Just now' : `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return (
        timestamp.toLocaleDateString() + ' ' + timestamp.toLocaleTimeString()
      );
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isCloudEnabled) {
    return (
      <div className='bg-gray-50 border border-gray-200 rounded-lg p-6'>
        <h3 className='text-lg font-semibold text-gray-800 mb-2'>
          Backup & Restore
        </h3>
        <p className='text-gray-600'>
          Connect to cloud storage to enable automatic backups and restore
          functionality.
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <h3 className='text-lg font-semibold text-gray-800 mb-2'>
          Backup & Restore
        </h3>
        <p className='text-gray-600 mb-4'>
          Your journal is automatically backed up every 5 minutes and when you
          make changes. The 50 most recent backups are kept.
        </p>
      </div>

      {/* Manual Backup Button */}
      <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h4 className='font-medium text-blue-800'>Create Backup Now</h4>
            <p className='text-sm text-blue-600'>
              Create an immediate backup of your current journal data
            </p>
          </div>
          <button
            onClick={handleCreateBackup}
            disabled={creatingBackup}
            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {creatingBackup ? 'Creating...' : 'Create Backup'}
          </button>
        </div>
      </div>

      {/* Backup Error Display */}
      {backupError && (
        <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
          <div className='flex items-center'>
            <span className='text-red-500 mr-2'>⚠️</span>
            <div>
              <h4 className='font-medium text-red-800'>Backup Failed</h4>
              <p className='text-sm text-red-600 mt-1'>{backupError}</p>
              {backupError.includes('not authenticated') && (
                <p className='text-sm text-red-600 mt-2'>
                  Try disconnecting and reconnecting your cloud storage
                  provider.
                </p>
              )}
              {backupError.includes(
                'provider or database service not available'
              ) && (
                <p className='text-sm text-red-600 mt-2'>
                  Make sure you're connected to a cloud storage provider in the
                  sync settings.
                </p>
              )}
            </div>
            <button
              onClick={() => setBackupError(null)}
              className='ml-auto text-red-400 hover:text-red-600'
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Backup List */}
      <div>
        <div className='flex items-center justify-between mb-4'>
          <h4 className='font-medium text-gray-800'>Available Backups</h4>
          <button
            onClick={loadBackups}
            disabled={loading}
            className='px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50'
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading && backups.length === 0 ? (
          <div className='text-center py-8 text-gray-500'>
            Loading backups...
          </div>
        ) : backups.length === 0 ? (
          <div className='text-center py-8 text-gray-500'>
            No backups found. Backups will appear here automatically as they are
            created.
          </div>
        ) : (
          <div className='space-y-2 max-h-96 overflow-y-auto'>
            {backups.map(backup => (
              <div
                key={backup.id}
                className='border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors'
              >
                <div className='flex items-center justify-between'>
                  <div className='flex-1'>
                    <div className='flex items-center space-x-3'>
                      <span className='text-2xl'>💾</span>
                      <div>
                        <h5 className='font-medium text-gray-800'>
                          {formatTimestamp(backup.timestamp)}
                        </h5>
                        <p className='text-sm text-gray-600'>
                          {formatFileSize(backup.size)} •{' '}
                          {backup.timestamp.toLocaleDateString()} at{' '}
                          {backup.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <button
                      onClick={() =>
                        handleRestoreBackup(
                          backup.id,
                          formatTimestamp(backup.timestamp)
                        )
                      }
                      disabled={restoring === backup.id}
                      className='px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      {restoring === backup.id ? 'Restoring...' : 'Restore'}
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteBackup(
                          backup.id,
                          formatTimestamp(backup.timestamp)
                        )
                      }
                      disabled={restoring === backup.id}
                      className='px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
        <h4 className='font-medium text-yellow-800 mb-2'>How Backups Work</h4>
        <ul className='text-sm text-yellow-700 space-y-1'>
          <li>• Automatic backups occur every 5 minutes when data changes</li>
          <li>
            • Manual backups can be created anytime using the button above
          </li>
          <li>
            • Up to 50 recent backups are kept, older ones are automatically
            deleted
          </li>
          <li>
            • Backups are compressed and stored securely in your{' '}
            {activeProvider?.displayName}
          </li>
          <li>
            • Restoring a backup will replace all current data and reload the
            app
          </li>
        </ul>
      </div>
    </div>
  );
}
