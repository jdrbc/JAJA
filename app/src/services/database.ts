import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { logger } from '../utils/logger';

// todo this seems weird
// Import cloud storage manager for auto-sync
let cloudStorageManager: any = null;
try {
  // Dynamic import to avoid circular dependencies
  cloudStorageManager = require('./cloudStorageManager').cloudStorageManager;
} catch (error) {
  logger.log('Cloud storage manager not available');
}

export interface DatabaseConnection {
  db: any;
  exec: (sql: string) => any;
  prepare: (sql: string) => any;
  close: () => void;
}

class DatabaseService {
  private sqlite3: any = null;
  private db: any = null;
  private isInitialized = false;
  private readonly DB_NAME = 'journal-app-db';
  private readonly DB_STORE_NAME = 'database';
  private readonly DB_KEY = 'journal.db';

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.log('Initializing SQLite WASM...');
      this.sqlite3 = await sqlite3InitModule({
        print: logger.log,
        printErr: logger.error,
      });

      logger.log('SQLite WASM initialized successfully');

      // Try to restore database from IndexedDB first
      const restoredData = await this.loadDatabaseFromIndexedDB();

      if (restoredData) {
        logger.log('Restoring database from IndexedDB...');
        this.db = new this.sqlite3.oo1.DB(':memory:');
        // Allocate WASM memory for the data
        const pData = this.sqlite3.wasm.alloc(restoredData.length);
        try {
          // Copy data to WASM memory
          this.sqlite3.wasm.heap8u().set(restoredData, pData);
          // Use sqlite3_deserialize to restore the database
          const rc = this.sqlite3.capi.sqlite3_deserialize(
            this.db.pointer,
            'main',
            pData,
            restoredData.length,
            restoredData.length,
            this.sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
              this.sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE
          );
          if (rc !== this.sqlite3.capi.SQLITE_OK) {
            throw new Error(`Failed to deserialize database: ${rc}`);
          }
          // Don't free pData here - sqlite3_deserialize takes ownership when FREEONCLOSE is used
        } catch (error) {
          // Free memory on error
          this.sqlite3.wasm.dealloc(pData);
          throw error;
        }
        logger.log('Database restored from IndexedDB successfully');
      } else {
        logger.log('No existing database found, creating new one...');
        // Create database in memory
        this.db = new this.sqlite3.oo1.DB(':memory:');

        // Initialize schema for new database
        await this.initializeSchema();
      }

      // Set up auto-save mechanism
      this.setupAutoSave();

      this.isInitialized = true;
      logger.log('Database service initialized');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async loadDatabaseFromIndexedDB(): Promise<Uint8Array | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onerror = () => {
        logger.log('IndexedDB not available or error occurred');
        resolve(null);
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.DB_STORE_NAME)) {
          db.createObjectStore(this.DB_STORE_NAME);
        }
      };

      request.onsuccess = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction([this.DB_STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.DB_STORE_NAME);
        const getRequest = store.get(this.DB_KEY);

        getRequest.onsuccess = () => {
          const result = getRequest.result;
          if (result && result.data) {
            resolve(new Uint8Array(result.data));
          } else {
            resolve(null);
          }
        };

        getRequest.onerror = () => {
          logger.log('Error reading from IndexedDB');
          resolve(null);
        };
      };
    });
  }

  private async saveDatabaseToIndexedDB(): Promise<void> {
    if (!this.db) return;

    try {
      const dbData = this.exportDatabase();

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.DB_NAME, 1);

        request.onerror = () => {
          logger.error('Failed to open IndexedDB for saving');
          reject(new Error('IndexedDB not available'));
        };

        request.onupgradeneeded = event => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.DB_STORE_NAME)) {
            db.createObjectStore(this.DB_STORE_NAME);
          }
        };

        request.onsuccess = event => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction([this.DB_STORE_NAME], 'readwrite');
          const store = transaction.objectStore(this.DB_STORE_NAME);

          const saveRequest = store.put(
            {
              data: Array.from(dbData),
              timestamp: Date.now(),
            },
            this.DB_KEY
          );

          saveRequest.onsuccess = () => {
            logger.log('Database saved to IndexedDB successfully');
            resolve();
          };

          saveRequest.onerror = () => {
            logger.error('Failed to save database to IndexedDB');
            reject(new Error('Failed to save to IndexedDB'));
          };
        };
      });
    } catch (error) {
      logger.error('Error saving database to IndexedDB:', error);
    }
  }

  private setupAutoSave(): void {
    // Save database when there are changes
    let saveTimeout: NodeJS.Timeout | null = null;
    let hasChanges = false;

    // Helper function to check if SQL modifies data
    const isModifyingSQL = (sql: string): boolean => {
      const trimmedSQL = sql.trim().toUpperCase();
      return (
        trimmedSQL.startsWith('INSERT') ||
        trimmedSQL.startsWith('UPDATE') ||
        trimmedSQL.startsWith('DELETE') ||
        trimmedSQL.startsWith('CREATE') ||
        trimmedSQL.startsWith('DROP') ||
        trimmedSQL.startsWith('ALTER')
      );
    };

    // Override exec method to detect changes
    const originalExec = this.db.exec.bind(this.db);

    this.db.exec = (sql: string) => {
      const result = originalExec(sql);
      if (isModifyingSQL(sql)) {
        hasChanges = true;
        this.scheduleAutoSave();
      }
      return result;
    };

    // Override prepare method to detect changes only when statements are executed
    const originalPrepare = this.db.prepare.bind(this.db);

    this.db.prepare = (sql: string) => {
      const stmt = originalPrepare(sql);

      // Only override step for modifying statements
      if (isModifyingSQL(sql)) {
        const originalStep = stmt.step.bind(stmt);

        stmt.step = () => {
          const result = originalStep();
          // For modifying statements, trigger save regardless of return value
          // because step() can return false for successful UPDATE/INSERT/DELETE operations
          hasChanges = true;
          logger.log('Database change detected, scheduling auto-save...');
          this.scheduleAutoSave();
          return result;
        };
      }

      return stmt;
    };

    const scheduleAutoSave = () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      saveTimeout = setTimeout(async () => {
        if (hasChanges) {
          try {
            logger.log('Auto-saving database to IndexedDB...');
            await this.saveDatabaseToIndexedDB();
            hasChanges = false;
            logger.log('Auto-save completed successfully');

            // Trigger cloud storage sync if available
            if (cloudStorageManager) {
              cloudStorageManager.onDatabaseChange(this);
            }
          } catch (error) {
            logger.error('Auto-save failed:', error);
          }
        }
      }, 2000); // Save 2 seconds after last change
    };

    this.scheduleAutoSave = scheduleAutoSave;

    // Also save when the page is about to unload
    window.addEventListener('beforeunload', () => {
      if (hasChanges) {
        // For page unload, try to save synchronously
        try {
          // Note: This is best effort - browsers may not wait for async operations
          this.saveDatabaseToIndexedDB();
        } catch (error) {
          logger.error('Failed to save database on page unload:', error);
        }
      }
    });
  }

  private scheduleAutoSave: () => void = () => {};

  private async initializeSchema(): Promise<void> {
    const schema = `
      -- Journal Entries table
      CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Sections table
      CREATE TABLE IF NOT EXISTS sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        refresh_frequency TEXT NOT NULL DEFAULT 'daily',
        content_type TEXT NOT NULL DEFAULT 'text',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entry_id) REFERENCES journal_entries (id) ON DELETE CASCADE
      );

      -- Template Columns table
      CREATE TABLE IF NOT EXISTS template_columns (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        width INTEGER NOT NULL,
        display_order INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Template Sections table
      CREATE TABLE IF NOT EXISTS template_sections (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        refresh_frequency TEXT NOT NULL DEFAULT 'daily',
        display_order INTEGER NOT NULL,
        placeholder TEXT DEFAULT '',
        default_content TEXT DEFAULT '',
        content_type TEXT NOT NULL DEFAULT 'text',
        column_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (column_id) REFERENCES template_columns (id) ON DELETE SET NULL
      );

      -- Indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
      CREATE INDEX IF NOT EXISTS idx_sections_entry_id ON sections(entry_id);
      CREATE INDEX IF NOT EXISTS idx_sections_type ON sections(type);
      CREATE INDEX IF NOT EXISTS idx_template_sections_column_id ON template_sections(column_id);
    `;

    try {
      this.db.exec(schema);
      logger.log('Database schema initialized');

      // Run migrations for existing databases
      await this.runMigrations();

      // Initialize with default template if no templates exist
      await this.initializeDefaultTemplate();
    } catch (error) {
      logger.error('Failed to initialize schema:', error);
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    try {
      // Check if we need to migrate width column from TEXT to INTEGER
      const tableInfo = this.db.exec('PRAGMA table_info(template_columns)');
      if (tableInfo.length > 0) {
        const columns = tableInfo[0].values;
        const widthColumn = columns.find((col: any) => col[1] === 'width');

        if (widthColumn && widthColumn[2] === 'TEXT') {
          logger.log('Migrating width column from TEXT to INTEGER...');

          // Create a backup table with the new schema
          this.db.exec(`
            CREATE TABLE template_columns_new (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              width INTEGER NOT NULL,
              display_order INTEGER NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
          `);

          // Copy data, converting width values
          const stmt = this.db.prepare('SELECT * FROM template_columns');
          const insertStmt = this.db.prepare(`
            INSERT INTO template_columns_new (id, title, width, display_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `);

          while (stmt.step()) {
            const row = stmt.get({});
            let width = 500; // default

            if (row.width) {
              // Try to parse as number, handle percentage strings
              const widthStr = row.width.toString();
              if (widthStr.includes('%')) {
                // Convert percentage to pixels (assuming 50% = 500px)
                const percentage = parseInt(widthStr.replace('%', ''));
                width = percentage * 10; // 50% -> 500px
              } else {
                width = parseInt(widthStr) || 500;
              }
            }

            insertStmt.bind([
              row.id,
              row.title,
              width,
              row.display_order,
              row.created_at,
              row.updated_at,
            ]);
            insertStmt.step();
            insertStmt.reset();
          }

          stmt.finalize();
          insertStmt.finalize();

          // Replace the old table
          this.db.exec(`
            DROP TABLE template_columns;
            ALTER TABLE template_columns_new RENAME TO template_columns;
          `);

          logger.log('Width column migration completed');
        }
      }
    } catch (error) {
      logger.error('Migration failed:', error);
      // Don't throw here, let the app continue with the new schema
    }
  }

  private async initializeDefaultTemplate(): Promise<void> {
    // Check if templates already exist
    const columnCount = this.db.selectValue(
      'SELECT COUNT(*) FROM template_columns'
    );
    if (columnCount > 0) {
      logger.log('Templates already exist, skipping default initialization');
      return;
    }

    logger.log('Initializing default template...');

    // Default template based on typical journal structure
    const defaultTemplate = `
      -- Default columns
      INSERT INTO template_columns (id, title, width, display_order) VALUES
      ('left', 'Reflection', 500, 1),
      ('right', 'Planning', 500, 2);

      -- Default sections
      INSERT INTO template_sections (id, title, refresh_frequency, display_order, placeholder, default_content, content_type, column_id) VALUES
      ('journal', 'Daily Journal', 'daily', 1, 'How was your day? What happened?', '', 'text', 'left'),
      ('gratitude', 'Gratitude', 'daily', 2, 'What are you grateful for today?', '', 'text', 'left'),
      ('monthly_theme', 'Monthly Theme', 'monthly', 3, 'What is your focus this month?', '', 'text', 'left'),
      ('weekly_goals', 'Weekly Goals', 'weekly', 1, 'What do you want to accomplish this week?', '', 'todo', 'right'),
      ('tomorrow', 'Tomorrow''s Plan', 'daily', 2, 'What will you do tomorrow?', '', 'todo', 'right'),
      ('notes', 'Notes & Ideas', 'daily', 3, 'Random thoughts, ideas, reminders...', '', 'text', 'right');
    `;

    try {
      this.db.exec(defaultTemplate);
      logger.log('Default template initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize default template:', error);
      throw error;
    }
  }

  getConnection(): DatabaseConnection {
    if (!this.isInitialized || !this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    return {
      db: this.db,
      exec: (sql: string) => this.db.exec(sql),
      prepare: (sql: string) => this.db.prepare(sql),
      close: () => this.db.close(),
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      // Save database before closing
      await this.saveDatabaseToIndexedDB();
      this.db.close();
      this.db = null;
    }
    this.isInitialized = false;
  }

  // Manual save method for explicit saves
  async saveDatabase(): Promise<void> {
    await this.saveDatabaseToIndexedDB();
  }

  // Export database for backup
  exportDatabase(): Uint8Array {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    // Use sqlite3_serialize to export the database
    const pSize = this.sqlite3.wasm.allocPtr();
    try {
      const pData = this.sqlite3.capi.sqlite3_serialize(
        this.db.pointer,
        'main',
        pSize,
        0
      );
      if (!pData) {
        throw new Error('Failed to serialize database');
      }
      const size = this.sqlite3.wasm.getPtrValue(pSize);
      const result = new Uint8Array(size);
      result.set(this.sqlite3.wasm.heap8u().subarray(pData, pData + size));
      this.sqlite3.capi.sqlite3_free(pData);
      return result;
    } finally {
      this.sqlite3.wasm.dealloc(pSize);
    }
  }

  // Import database from backup
  async importDatabase(data: Uint8Array): Promise<void> {
    if (this.db) {
      this.db.close();
    }

    this.db = new this.sqlite3.oo1.DB(':memory:');
    // Allocate WASM memory for the data
    const pData = this.sqlite3.wasm.alloc(data.length);
    try {
      // Copy data to WASM memory
      this.sqlite3.wasm.heap8u().set(data, pData);
      // Use sqlite3_deserialize to import the database
      const rc = this.sqlite3.capi.sqlite3_deserialize(
        this.db.pointer,
        'main',
        pData,
        data.length,
        data.length,
        this.sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
          this.sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE
      );
      if (rc !== this.sqlite3.capi.SQLITE_OK) {
        throw new Error(`Failed to deserialize database: ${rc}`);
      }
      // Don't free pData here - sqlite3_deserialize takes ownership when FREEONCLOSE is used
    } catch (error) {
      // Free memory on error
      this.sqlite3.wasm.dealloc(pData);
      throw error;
    }

    // Set up auto-save for the imported database
    this.setupAutoSave();

    // Save the imported database to IndexedDB
    await this.saveDatabaseToIndexedDB();

    logger.log('Database imported successfully');
  }
}

// Singleton instance
export const databaseService = new DatabaseService();
export default databaseService;
