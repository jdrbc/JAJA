import { CloudStorageProvider, BackupInfo } from '../types/cloudStorage';
import { logger } from '../utils/logger';
import { databaseCompatibility } from '../database/watermelon/database';
import { unifiedSyncService } from './unifiedSyncService';

export class BackupManager {
  private provider: CloudStorageProvider | null = null;
  private backupInterval: NodeJS.Timeout | null = null;
  private lastBackupTime: Date | null = null;

  private readonly BACKUP_INTERVAL_MINUTES = 5;
  private readonly MAX_BACKUPS = 50;
  private readonly COMPRESSION_ENABLED = true;

  setProvider(provider: CloudStorageProvider | null): void {
    logger.log(
      'BACKUP: setProvider called, provider:',
      provider?.name || 'null'
    );
    this.provider = provider;

    if (provider) {
      this.startPeriodicBackup();
    } else {
      this.stopPeriodicBackup();
    }
  }

  private startPeriodicBackup(): void {
    this.stopPeriodicBackup();

    logger.log(
      `BACKUP: Starting periodic backup every ${this.BACKUP_INTERVAL_MINUTES} minutes`
    );

    this.backupInterval = setInterval(
      () => {
        this.createBackup().catch(error => {
          logger.error('BACKUP: Periodic backup failed:', error);
        });
      },
      this.BACKUP_INTERVAL_MINUTES * 60 * 1000
    );
  }

  private stopPeriodicBackup(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      logger.log('BACKUP: Stopped periodic backup');
    }
  }

  async createBackup(isManual: boolean = false): Promise<void> {
    // Debug logging to identify the issue
    logger.log('BACKUP: createBackup called, isManual:', isManual);
    logger.log('BACKUP: provider available:', !!this.provider);
    logger.log('BACKUP: provider name:', this.provider?.name || 'none');

    if (this.provider) {
      logger.log(
        'BACKUP: provider authenticated:',
        this.provider.isAuthenticated()
      );
    }

    if (!this.provider) {
      const error = 'Cannot create backup - provider not available';
      logger.log('BACKUP:', error);
      throw new Error(error);
    }

    if (!this.provider.isAuthenticated()) {
      const error = 'Cannot create backup - not authenticated';
      logger.log('BACKUP:', error);
      throw new Error(error);
    }

    try {
      logger.log('BACKUP: Creating backup...');

      // Get current database data using WatermelonDB compatibility layer
      const databaseData = await databaseCompatibility.exportDatabaseAsync();

      // Skip backup if data hasn't changed (unless manual)
      if (!isManual && this.lastBackupTime) {
        const timeSinceLastBackup = Date.now() - this.lastBackupTime.getTime();
        const minTimeBetweenBackups = 5 * 60 * 1000; // 5 minutes

        if (timeSinceLastBackup < minTimeBetweenBackups) {
          logger.log('BACKUP: Skipping backup - too soon since last backup');
          return;
        }
      }

      // Compress the data if enabled
      const dataToBackup = this.COMPRESSION_ENABLED
        ? await this.compressData(databaseData)
        : databaseData;

      // Create backup with timestamp
      const timestamp = new Date();
      await this.provider.saveBackup(dataToBackup, timestamp);

      // Update last backup time
      this.lastBackupTime = timestamp;

      // Clean up old backups
      await this.cleanupOldBackups();

      logger.log(
        'BACKUP: Backup created successfully at',
        timestamp.toISOString()
      );
    } catch (error) {
      logger.error('BACKUP: Failed to create backup:', error);
      throw error;
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    if (!this.provider) {
      return [];
    }

    try {
      const backups = await this.provider.listBackups();
      // Sort by timestamp descending (newest first)
      return backups.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
    } catch (error) {
      logger.error('BACKUP: Failed to list backups:', error);
      return [];
    }
  }

  async restoreFromBackup(backupId: string): Promise<boolean> {
    if (!this.provider) {
      logger.error('BACKUP: Cannot restore - provider not available');
      return false;
    }

    try {
      logger.log('BACKUP: Restoring from backup:', backupId);

      // Pause sync operations during restore to prevent race conditions
      unifiedSyncService.pauseSync();

      try {
        // Load backup data
        const backupData = await this.provider.loadBackup(backupId);
        if (!backupData) {
          logger.error('BACKUP: Backup data not found:', backupId);
          return false;
        }

        // Decompress if needed
        const restoredData = this.COMPRESSION_ENABLED
          ? await this.decompressData(backupData)
          : backupData;

        // Import the backup data using WatermelonDB compatibility layer
        await databaseCompatibility.importDatabase(restoredData);

        // CRITICAL: Coordinate with cloud sync to prevent race conditions
        // Import the cloudStorageManager to update cloud storage and hash tracking
        const { cloudStorageManager } = await import('./cloudStorageManager');

        // Save the restored data as the new current version in cloud storage
        // This prevents conflicts when the sync service runs after restore
        try {
          logger.log(
            'BACKUP: Updating cloud storage with restored data to prevent conflicts'
          );

          // Calculate hash of the restored data
          const restoredHash = await databaseCompatibility.getContentHash();
          const restoredHashBytes = new TextEncoder().encode(restoredHash);

          // Prepare data with hash for cloud storage
          const restoredDataWithHash = new Uint8Array(
            restoredData.length + restoredHashBytes.length
          );
          restoredDataWithHash.set(restoredData, 0);
          restoredDataWithHash.set(restoredHashBytes, restoredData.length);

          // Save to cloud storage to establish this as the current version
          await this.provider.saveData(restoredDataWithHash);

          // Update the cloud storage manager's hash tracking to prevent conflicts
          cloudStorageManager.updateLastSavedDataHash(restoredHash);

          logger.log(
            'BACKUP: Successfully updated cloud storage with restored data'
          );
        } catch (cloudError) {
          logger.error(
            'BACKUP: Failed to update cloud storage after restore:',
            cloudError
          );
          // Continue anyway - the restore to local database succeeded
          // The user will just see a conflict dialog on next sync
        }

        logger.log('BACKUP: Successfully restored from backup:', backupId);
        return true;
      } finally {
        // Always resume sync operations, even if restore failed
        unifiedSyncService.resumeSync();
      }
    } catch (error) {
      logger.error('BACKUP: Failed to restore from backup:', error);
      return false;
    }
  }

  async deleteBackup(backupId: string): Promise<boolean> {
    if (!this.provider) {
      return false;
    }

    try {
      await this.provider.deleteBackup(backupId);
      logger.log('BACKUP: Deleted backup:', backupId);
      return true;
    } catch (error) {
      logger.error('BACKUP: Failed to delete backup:', error);
      return false;
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    if (!this.provider) {
      return;
    }

    try {
      await this.provider.cleanupOldBackups(this.MAX_BACKUPS);
      logger.log(
        'BACKUP: Cleaned up old backups, keeping latest',
        this.MAX_BACKUPS
      );
    } catch (error) {
      logger.error('BACKUP: Failed to cleanup old backups:', error);
    }
  }

  private async compressData(data: Uint8Array): Promise<Uint8Array> {
    try {
      // Use CompressionStream if available (modern browsers)
      if (typeof CompressionStream !== 'undefined') {
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(data);
        writer.close();

        const chunks: Uint8Array[] = [];
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            chunks.push(value);
          }
        }

        // Combine chunks
        const totalLength = chunks.reduce(
          (sum, chunk) => sum + chunk.length,
          0
        );
        const compressed = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
          compressed.set(chunk, offset);
          offset += chunk.length;
        }

        logger.log(
          `BACKUP: Compressed data from ${data.length} to ${compressed.length} bytes`
        );
        return compressed;
      } else {
        // Fallback: return uncompressed data
        logger.log(
          'BACKUP: Compression not available, using uncompressed data'
        );
        return data;
      }
    } catch (error) {
      logger.error(
        'BACKUP: Compression failed, using uncompressed data:',
        error
      );
      return data;
    }
  }

  private async decompressData(data: Uint8Array): Promise<Uint8Array> {
    try {
      // Use DecompressionStream if available (modern browsers)
      if (typeof DecompressionStream !== 'undefined') {
        const stream = new DecompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(data);
        writer.close();

        const chunks: Uint8Array[] = [];
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            chunks.push(value);
          }
        }

        // Combine chunks
        const totalLength = chunks.reduce(
          (sum, chunk) => sum + chunk.length,
          0
        );
        const decompressed = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
          decompressed.set(chunk, offset);
          offset += chunk.length;
        }

        logger.log(
          `BACKUP: Decompressed data from ${data.length} to ${decompressed.length} bytes`
        );
        return decompressed;
      } else {
        // Fallback: assume data is uncompressed
        logger.log(
          'BACKUP: Decompression not available, assuming uncompressed data'
        );
        return data;
      }
    } catch (error) {
      logger.error(
        'BACKUP: Decompression failed, assuming uncompressed data:',
        error
      );
      return data;
    }
  }

  // Trigger backup on significant changes (called by sync service)
  async onDataChange(): Promise<void> {
    if (!this.provider) {
      return;
    }

    // Create backup immediately if this is the first change in a while
    const now = Date.now();
    const timeSinceLastBackup = this.lastBackupTime
      ? now - this.lastBackupTime.getTime()
      : Infinity;

    // Create immediate backup if it's been more than 10 minutes
    if (timeSinceLastBackup > 10 * 60 * 1000) {
      await this.createBackup();
    }
  }

  getLastBackupTime(): Date | null {
    return this.lastBackupTime;
  }

  // Initialize cleanup on startup
  async initializeCleanup(): Promise<void> {
    if (this.provider) {
      try {
        logger.log('BACKUP: Initializing cleanup of old backups...');
        await this.cleanupOldBackups();
      } catch (error) {
        // Don't let cleanup failures prevent app initialization
        logger.error(
          'BACKUP: Cleanup initialization failed, but continuing:',
          error
        );
      }
    }
  }
}

export const backupManager = new BackupManager();
