import {
  CloudStorageProvider,
  StorageQuota,
  BackupInfo,
} from '../../types/cloudStorage';

import { logger } from '../../utils/logger';

declare global {
  interface Window {
    google: any;
  }
}

// Types for Google Identity Services
interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface TokenClient {
  requestAccessToken(): void;
  callback: (response: TokenResponse) => void;
}

export class GoogleDriveAppDataProvider implements CloudStorageProvider {
  readonly name = 'google-drive';
  readonly displayName = 'Google Drive';
  readonly icon = '📚';

  private readonly CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
  private readonly SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  private accessToken: string = '';
  private isInitializedFlag = false;
  private readonly JOURNAL_FILE_NAME = 'journal-data.db';
  private tokenClient: TokenClient | null = null;

  async initialize(): Promise<void> {
    if (this.isInitializedFlag) {
      return;
    }

    return new Promise((resolve, reject) => {
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(
          new Error('Google Drive initialization timed out after 10 seconds')
        );
      }, 10000);

      const cleanup = () => {
        clearTimeout(timeout);
      };

      // Check if Google API is already loaded
      if (window.google?.accounts?.oauth2) {
        this.setupTokenClient();
        this.restoreSession();
        this.isInitializedFlag = true;
        logger.log(
          'Google Drive provider initialized (using existing Google API)'
        );
        cleanup();
        resolve();
        return;
      }

      // Load Google Identity Services if not already loaded
      let script = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]'
      ) as HTMLScriptElement;

      if (script) {
        // Script already exists, wait for it to load
        if (window.google?.accounts?.oauth2) {
          this.setupTokenClient();
          this.restoreSession();
          this.isInitializedFlag = true;
          logger.log(
            'Google Drive provider initialized (script already loaded)'
          );
          cleanup();
          resolve();
        } else {
          script.addEventListener('load', () => {
            this.setupTokenClient();
            this.restoreSession();
            this.isInitializedFlag = true;
            logger.log('Google Drive provider initialized');
            cleanup();
            resolve();
          });
          script.addEventListener('error', () => {
            cleanup();
            reject(new Error('Failed to load Google Identity Services script'));
          });
        }
        return;
      }

      // Create new script
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        try {
          this.setupTokenClient();
          this.restoreSession();
          this.isInitializedFlag = true;
          logger.log('Google Drive provider initialized');
          cleanup();
          resolve();
        } catch (error) {
          logger.error('Google Drive initialization failed:', error);
          cleanup();
          reject(error);
        }
      };
      script.onerror = () => {
        cleanup();
        reject(new Error('Failed to load Google Identity Services script'));
      };
      document.head.appendChild(script);
    });
  }

  private setupTokenClient(): void {
    // Initialize the token client
    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: this.CLIENT_ID,
      scope: this.SCOPE,
      callback: (response: TokenResponse) => {
        if (response.access_token) {
          this.accessToken = response.access_token;
          // Store token with expiration info
          const expirationTime = Date.now() + response.expires_in * 1000;
          localStorage.setItem(
            'googleDriveAuth',
            JSON.stringify({
              access_token: response.access_token,
              expires_at: expirationTime,
            })
          );
          logger.log('Google Drive authentication successful');
        }
      },
    });
  }

  private restoreSession(): void {
    // Try to restore existing session
    const stored = localStorage.getItem('googleDriveAuth');
    if (stored) {
      try {
        const authData = JSON.parse(stored);
        if (authData.expires_at > Date.now()) {
          this.accessToken = authData.access_token;
          logger.log('Google Drive session restored');
        } else {
          logger.log('Google Drive session expired, removing token');
          localStorage.removeItem('googleDriveAuth');
        }
      } catch (e) {
        logger.log('Error parsing Google Drive auth data, removing token');
        localStorage.removeItem('googleDriveAuth');
      }
    } else {
      logger.log('No stored Google Drive session found');
    }
  }

  isAuthenticated(): boolean {
    if (!this.accessToken || !this.isInitializedFlag) {
      return false;
    }

    // Check if token is still valid
    const stored = localStorage.getItem('googleDriveAuth');
    if (stored) {
      try {
        const authData = JSON.parse(stored);
        if (authData.expires_at <= Date.now()) {
          this.accessToken = '';
          localStorage.removeItem('googleDriveAuth');
          return false;
        }
      } catch (e) {
        this.accessToken = '';
        localStorage.removeItem('googleDriveAuth');
        return false;
      }
    }

    return true;
  }

  async signIn(): Promise<boolean> {
    if (!this.isInitializedFlag) {
      await this.initialize();
    }

    if (!this.tokenClient) {
      logger.error('Token client not initialized');
      return false;
    }

    try {
      return new Promise(resolve => {
        // Set up callback for this specific sign-in attempt
        const originalCallback = this.tokenClient!.callback;
        this.tokenClient!.callback = (response: TokenResponse) => {
          originalCallback(response);
          resolve(!!response.access_token);
        };

        // Request access token
        this.tokenClient!.requestAccessToken();
      });
    } catch (error) {
      logger.error('Google Drive authentication failed:', error);
      return false;
    }
  }

  async signOut(): Promise<void> {
    try {
      if (this.accessToken) {
        // Revoke the access token
        window.google?.accounts?.oauth2?.revoke(this.accessToken, () => {
          logger.log('Access token revoked');
        });
      }

      localStorage.removeItem('googleDriveAuth');
      this.accessToken = '';
    } catch (error) {
      logger.error('Google sign-out failed:', error);
      throw error;
    }
  }

  async saveData(data: Uint8Array): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      // Check if journal file already exists
      const existingFileId = await this.findJournalFile();

      if (existingFileId) {
        // Update existing file
        await this.updateFile(existingFileId, data);
      } else {
        // Create new file
        await this.createFile(data);
      }

      logger.log('Journal data saved to Google Drive successfully');
    } catch (error) {
      logger.error('Save data error:', error);
      throw new Error(`Failed to save data: ${error}`);
    }
  }

  async loadData(): Promise<Uint8Array | null> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      const fileId = await this.findJournalFile();
      if (!fileId) {
        logger.log('No journal data found in Google Drive');
        return null;
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load data: ${response.status} ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      logger.log('Journal data loaded from Google Drive successfully');
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      logger.error('Load data error:', error);
      throw new Error(`Failed to load data: ${error}`);
    }
  }

  private async findJournalFile(): Promise<string | null> {
    try {
      const query = `parents in 'appDataFolder' and name='${this.JOURNAL_FILE_NAME}' and trashed=false`;
      const fields = 'files(id)';

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${fields}&spaces=appDataFolder`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = await response.json();
      return result.files.length > 0 ? result.files[0].id : null;
    } catch (error) {
      logger.error('Find journal file error:', error);
      return null;
    }
  }

  private async createFile(data: Uint8Array, fileName?: string): Promise<void> {
    const actualFileName = fileName || this.JOURNAL_FILE_NAME;

    const fileMetadata = {
      name: actualFileName,
      parents: ['appDataFolder'],
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' })
    );
    form.append('file', new Blob([data], { type: 'application/octet-stream' }));

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: form,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create file: ${response.status} ${errorText}`);
    }
  }

  private async updateFile(fileId: string, data: Uint8Array): Promise<void> {
    const response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/octet-stream',
        },
        body: data,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update file: ${response.status} ${errorText}`);
    }
  }

  async getStorageQuota(): Promise<StorageQuota> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        'https://www.googleapis.com/drive/v3/about?fields=storageQuota',
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = await response.json();
      const quota = result.storageQuota;
      return {
        used: parseInt(quota.usage || '0'),
        total: parseInt(quota.limit || '0'),
      };
    } catch (error) {
      logger.error('Failed to get storage quota:', error);
      return {
        used: 0,
        total: 0,
      };
    }
  }

  async getLastSyncTime(): Promise<Date | null> {
    const timestamp = localStorage.getItem('googleDriveLastSync');
    return timestamp ? new Date(parseInt(timestamp)) : null;
  }

  // Backup Operations
  async saveBackup(data: Uint8Array, timestamp: Date): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      const fileName = this.generateBackupFileName(timestamp);
      await this.createFile(data, fileName);
      logger.log(`Backup saved to Google Drive: ${fileName}`);
    } catch (error) {
      logger.error('Save backup error:', error);
      throw new Error(`Failed to save backup: ${error}`);
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      const query = `parents in 'appDataFolder' and name contains 'journal-backup-' and trashed=false`;
      const fields = 'files(id,name,size,modifiedTime)';

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${fields}&spaces=appDataFolder`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = await response.json();
      const backups: BackupInfo[] = result.files.map((file: any) => ({
        id: file.id,
        name: file.name,
        timestamp: new Date(file.modifiedTime),
        size: parseInt(file.size || '0'),
      }));

      return backups;
    } catch (error) {
      logger.error('List backups error:', error);
      throw new Error(`Failed to list backups: ${error}`);
    }
  }

  async loadBackup(backupId: string): Promise<Uint8Array | null> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${backupId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to load backup: ${response.status} ${errorText}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      logger.log('Backup loaded from Google Drive successfully');
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      logger.error('Load backup error:', error);
      throw new Error(`Failed to load backup: ${error}`);
    }
  }

  async deleteBackup(backupId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${backupId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to delete backup: ${response.status} ${errorText}`
        );
      }

      logger.log('Backup deleted from Google Drive successfully');
    } catch (error) {
      logger.error('Delete backup error:', error);
      throw new Error(`Failed to delete backup: ${error}`);
    }
  }

  async cleanupOldBackups(keepCount: number): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Google Drive');
    }

    try {
      const backups = await this.listBackups();

      // Sort by timestamp descending (newest first)
      const sortedBackups = backups.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );

      // Delete backups beyond the keep count
      const backupsToDelete = sortedBackups.slice(keepCount);

      for (const backup of backupsToDelete) {
        await this.deleteBackup(backup.id);
        logger.log(`Cleaned up old backup: ${backup.name}`);
      }

      if (backupsToDelete.length > 0) {
        logger.log(`Cleaned up ${backupsToDelete.length} old backups`);
      }
    } catch (error) {
      logger.error('Cleanup old backups error:', error);
      throw new Error(`Failed to cleanup old backups: ${error}`);
    }
  }

  private generateBackupFileName(timestamp: Date): string {
    // Format: journal-backup-2024-12-19T10-30-45-123Z.db.gz
    const isoString = timestamp.toISOString();
    const fileName = `journal-backup-${isoString.replace(/[:.]/g, '-')}.db.gz`;
    return fileName;
  }
}
