import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { logger } from '../utils/logger';

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
  private isInitializing = false;
  private isImporting = false;
  private readonly DB_NAME = 'journal-app-db';
  private readonly DB_STORE_NAME = 'database';
  private readonly DB_KEY = 'journal.db';

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Prevent multiple concurrent initialization attempts
    if (this.isInitializing) {
      // Wait for ongoing initialization to complete with timeout
      const startTime = Date.now();
      while (this.isInitializing) {
        if (Date.now() - startTime > 15000) {
          // 15 second timeout
          throw new Error(
            'Database initialization timed out waiting for concurrent initialization'
          );
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Check if initialization succeeded
      if (!this.isInitialized) {
        throw new Error('Database initialization failed in concurrent process');
      }
      return;
    }

    this.isInitializing = true;

    try {
      logger.log('Initializing SQLite WASM...');
      this.sqlite3 = await sqlite3InitModule({
        print: logger.log,
        printErr: logger.error,
      });

      logger.log('SQLite WASM initialized successfully');

      // Try to restore database from IndexedDB
      logger.log('Restoring database from IndexedDB...');
      const savedData = await this.loadDatabaseFromIndexedDB();

      if (savedData) {
        // Restore from saved data
        this.db = new this.sqlite3.oo1.DB(':memory:');
        const pData = this.sqlite3.wasm.alloc(savedData.length);
        try {
          this.sqlite3.wasm.heap8u().set(savedData, pData);
          const rc = this.sqlite3.capi.sqlite3_deserialize(
            this.db.pointer,
            'main',
            pData,
            savedData.length,
            savedData.length,
            this.sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
              this.sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE
          );
          if (rc !== this.sqlite3.capi.SQLITE_OK) {
            throw new Error(`Failed to deserialize database: ${rc}`);
          }
        } catch (error) {
          this.sqlite3.wasm.dealloc(pData);
          throw error;
        }
        logger.log('Database restored from IndexedDB successfully');
      } else {
        // Create new database
        this.db = new this.sqlite3.oo1.DB(':memory:');
        await this.runMigrations();
        logger.log('New database created');
      }

      // Set up auto-save after database is ready
      this.setupAutoSave();

      this.isInitialized = true;
      logger.log('Database service initialized');

      // Clear startup flag after a short delay
      setTimeout(() => {
        logger.log('Database startup phase complete');
      }, 2000);
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  private async loadDatabaseFromIndexedDB(): Promise<Uint8Array | null> {
    return new Promise(resolve => {
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

    // Override prepare method to detect changes only when statements are executed
    const originalPrepare = this.db.prepare.bind(this.db);

    this.db.prepare = (sql: string) => {
      const stmt = originalPrepare(sql);

      // Only override step for modifying statements
      if (isModifyingSQL(sql)) {
        const originalStep = stmt.step.bind(stmt);

        stmt.step = () => {
          const result = originalStep();
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
      await this.insertDefaultTemplate();
      logger.log('Database schema initialized');
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
            // Convert width to integer, default to 400 if invalid
            let width = parseInt(row.width);
            if (isNaN(width)) {
              width = 400;
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

          // Drop old table and rename new one
          this.db.exec('DROP TABLE template_columns');
          this.db.exec(
            'ALTER TABLE template_columns_new RENAME TO template_columns'
          );

          logger.log('Width column migration completed');
        }
      }

      // Always create schema (will use IF NOT EXISTS)
      await this.initializeSchema();
    } catch (error) {
      logger.error('Failed to run migrations:', error);
      throw error;
    }
  }

  private async insertDefaultTemplate(): Promise<void> {
    try {
      // Check if template already exists
      const existingColumns = this.db.exec(
        'SELECT COUNT(*) as count FROM template_columns'
      );
      const columnCount =
        existingColumns.length > 0 ? existingColumns[0].values[0][0] : 0;

      if (columnCount > 0) {
        logger.log(
          'Template already exists, skipping default template creation'
        );
        return;
      }

      logger.log('Creating default template...');

      // Create default column
      const defaultColumnId = 'column-1';
      this.db.exec(`
        INSERT INTO template_columns (id, title, width, display_order)
        VALUES ('${defaultColumnId}', 'Main', 600, 1)
      `);

      // Create default sections
      const defaultSections = [
        {
          id: 'section-gratitude',
          title: 'Gratitude',
          order: 1,
          placeholder: 'What are you grateful for today?',
        },
        {
          id: 'section-reflection',
          title: 'Daily Reflection',
          order: 2,
          placeholder: 'How was your day? What did you learn?',
        },
        {
          id: 'section-goals',
          title: 'Goals & Tasks',
          order: 3,
          placeholder: 'What do you want to accomplish?',
        },
      ];

      for (const section of defaultSections) {
        this.db.exec(`
          INSERT INTO template_sections (id, title, display_order, placeholder, column_id)
          VALUES ('${section.id}', '${section.title}', ${section.order}, '${section.placeholder}', '${defaultColumnId}')
        `);
      }

      logger.log('Default template created successfully');
    } catch (error) {
      logger.error('Failed to create default template:', error);
      throw error;
    }
  }

  getConnection(): DatabaseConnection | null {
    if (!this.isInitialized || !this.db) {
      return null;
    }

    return {
      db: this.db,
      exec: this.db.exec.bind(this.db),
      prepare: this.db.prepare.bind(this.db),
      close: this.db.close.bind(this.db),
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
    logger.log('Starting database import...');

    // Set importing flag to prevent getContentHash from running during import
    this.isImporting = true;

    try {
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

      // Set up auto-save for the imported database - but don't trigger immediate save
      this.setupAutoSave();

      // Save the imported database to IndexedDB
      logger.log('Saving imported database to IndexedDB...');
      await this.saveDatabaseToIndexedDB();

      logger.log('Database imported successfully');
    } finally {
      // Clear importing flag
      this.isImporting = false;
    }
  }

  // Generate hash of user-entered data (excluding timestamps and auto-generated IDs)
  async getContentHash(): Promise<string> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Wait for any ongoing import operations to complete
    while (this.isImporting) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Double-check database is still available after waiting
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Collect all user-entered data in a consistent format using select methods
      const contentData: any = {
        journalEntries: [],
        sections: [],
        templateColumns: [],
        templateSections: [],
      };

      // Get journal entries (only date, which is user-specified)
      const entriesResults = this.db.selectArrays(
        'SELECT date FROM journal_entries ORDER BY date DESC LIMIT 10'
      );
      contentData.journalEntries = entriesResults.map((row: any[]) => ({
        date: row[0],
      }));

      // Get sections content (user-entered content and type)
      const sectionsResults = this.db.selectArrays(`
        SELECT je.date, s.type, s.content, s.refresh_frequency, s.content_type
        FROM sections s
        JOIN journal_entries je ON s.entry_id = je.id
        ORDER BY je.date DESC, s.type
        LIMIT 50
      `);
      contentData.sections = sectionsResults.map((row: any[]) => ({
        date: row[0],
        type: row[1],
        content: row[2],
        refreshFrequency: row[3],
        contentType: row[4],
      }));

      // Get template columns (user-defined structure)
      const columnsResults = this.db.selectArrays(
        'SELECT title, width, display_order FROM template_columns ORDER BY display_order'
      );
      contentData.templateColumns = columnsResults.map((row: any[]) => ({
        title: row[0],
        width: row[1],
        displayOrder: row[2],
      }));

      // Get template sections (user-defined template structure)
      const templateSectionsResults = this.db.selectArrays(`
        SELECT ts.title, ts.refresh_frequency, ts.display_order, ts.placeholder, 
               ts.default_content, ts.content_type, tc.title as column_title
        FROM template_sections ts
        LEFT JOIN template_columns tc ON ts.column_id = tc.id
        ORDER BY ts.display_order
      `);
      contentData.templateSections = templateSectionsResults.map(
        (row: any[]) => ({
          title: row[0],
          refreshFrequency: row[1],
          displayOrder: row[2],
          placeholder: row[3],
          defaultContent: row[4],
          contentType: row[5],
          columnTitle: row[6],
        })
      );

      // Convert to JSON string for consistent serialization
      const dataString = JSON.stringify(contentData, null, 0);

      // Generate SHA-256 hash
      const encoder = new TextEncoder();
      const data = encoder.encode(dataString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);

      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      logger.log('Generated content hash:', hashHex);
      return hashHex;
    } catch (error) {
      logger.error('Failed to generate content hash:', error);
      throw error;
    }
  }
}

const databaseService = new DatabaseService();

export default databaseService;
