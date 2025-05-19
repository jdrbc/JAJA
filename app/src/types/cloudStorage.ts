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

  // Metadata
  getStorageQuota(): Promise<StorageQuota>;
  getLastSyncTime(): Promise<Date | null>;
}

export interface CloudSyncSettings {
  autoSync: boolean;
}

export interface CloudSyncStatus {
  isConnected: boolean;
  lastSync: Date | null;
  syncInProgress: boolean;
  error: string | null;
}
