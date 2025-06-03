export interface StorageQuota {
  used: number;
  total: number;
}

export interface CloudStorageProvider {
  readonly name: string;
  readonly displayName: string;
  readonly icon: string;

  // Authentication
  initialize(): Promise<void>;
  isAuthenticated(): boolean;
  signIn(): Promise<boolean>;
  signOut(): Promise<void>;

  // File Operations - simplified for auto-sync
  saveData(data: Uint8Array): Promise<void>;
  loadData(): Promise<Uint8Array | null>;

  // Backup Operations
  saveBackup(data: Uint8Array, timestamp: Date): Promise<void>;
  listBackups(): Promise<BackupInfo[]>;
  loadBackup(backupId: string): Promise<Uint8Array | null>;
  deleteBackup(backupId: string): Promise<void>;
  cleanupOldBackups(keepCount: number): Promise<void>;

  // Metadata
  getStorageQuota(): Promise<StorageQuota>;
  getLastSyncTime(): Promise<Date | null>;
}

export interface BackupInfo {
  id: string;
  timestamp: Date;
  size: number;
  name: string;
}

export interface CloudSyncSettings {
  autoSync: boolean;
  autoBackup: boolean;
  backupIntervalMinutes: number;
  maxBackups: number;
}

export interface CloudSyncStatus {
  isConnected: boolean;
  lastSync: Date | null;
  lastBackup: Date | null;
  syncInProgress: boolean;
  backupInProgress: boolean;
  error: string | null;
}

export interface ConflictData {
  localData: Uint8Array;
  cloudData: Uint8Array;
  localHash: string;
  cloudHash: string;
}

export type ConflictResolution = 'use-local' | 'use-cloud' | 'cancel';

export interface ConflictResolver {
  (conflict: ConflictData): Promise<ConflictResolution>;
}
