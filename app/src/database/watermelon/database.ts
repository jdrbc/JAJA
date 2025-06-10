import { Database, Q } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

import { schema } from './schema';
import migrations from './migrations';
import {
  JournalEntry,
  Section,
  SectionJournalEntry,
  ApiKey,
  TemplateColumn,
  TemplateSection,
} from './models';
import { logger } from '../../utils/logger';

// Create LokiJS adapter for web
const adapter = new LokiJSAdapter({
  schema,
  migrations,
  useWebWorker: false,
  useIncrementalIndexedDB: true,
  onSetUpError: (error: Error) => {
    logger.error('Database setup error:', error);
  },
});

// Database with all models
export const database = new Database({
  adapter,
  modelClasses: [
    JournalEntry,
    Section,
    SectionJournalEntry,
    ApiKey,
    TemplateColumn,
    TemplateSection,
  ],
});

// Compatibility layer for backup/sync functionality
export class DatabaseCompatibilityLayer {
  // Wait for database to be ready before operations
  private async waitForDatabase(maxRetries = 15, delay = 300): Promise<void> {
    const adapter = database.adapter as any;

    for (let i = 0; i < maxRetries; i++) {
      // Debug: Log adapter structure on first attempt
      if (i === 0) {
        logger.log('DEBUG: Adapter structure:', {
          hasUnderlyingAdapter: !!adapter.underlyingAdapter,
          underlyingAdapterKeys: adapter.underlyingAdapter
            ? Object.keys(adapter.underlyingAdapter)
            : [],
          adapterKeys: Object.keys(adapter),
        });

        // Log the actual keys and their types for deeper inspection
        if (adapter.underlyingAdapter) {
          const lokiAdapter = adapter.underlyingAdapter;
          logger.log('DEBUG: UnderlyingAdapter properties:');
          Object.keys(lokiAdapter).forEach(key => {
            logger.log(
              `  ${key}: ${typeof lokiAdapter[key]} ${lokiAdapter[key] ? '(exists)' : '(null/undefined)'}`
            );
          });

          // Check dispatcher properties if it exists
          if (lokiAdapter._dispatcher) {
            logger.log('DEBUG: Dispatcher properties:');
            Object.keys(lokiAdapter._dispatcher).forEach(key => {
              logger.log(
                `  _dispatcher.${key}: ${typeof lokiAdapter._dispatcher[key]} ${lokiAdapter._dispatcher[key] ? '(exists)' : '(null/undefined)'}`
              );
            });
          }
        }
      }

      // Try multiple detection methods
      const lokiAdapter = adapter.underlyingAdapter;
      if (lokiAdapter) {
        // Check various possible properties
        if (
          lokiAdapter._loki ||
          lokiAdapter.loki ||
          lokiAdapter.db ||
          lokiAdapter._worker
        ) {
          logger.log('Database is ready for operations (LokiJS detected)');
          return;
        }

        // Check if it has core LokiJS methods
        if (
          typeof lokiAdapter.serialize === 'function' ||
          typeof lokiAdapter.loadJSON === 'function'
        ) {
          logger.log(
            'Database is ready for operations (LokiJS methods detected)'
          );
          return;
        }
      }

      // Fallback check - if we can query the database, it's probably ready
      try {
        await database.collections.get('journal_entries').query().fetch();
        logger.log('Database is ready for operations (query test passed)');
        return;
      } catch (queryError) {
        // Query failed, database not ready yet
      }

      if (i < maxRetries - 1) {
        logger.log(
          `Database not ready yet, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Database failed to initialize within expected time');
  }

  exportDatabase(): Uint8Array {
    // Since this method is called synchronously but needs async operations,
    // we'll throw an error directing to use the async version
    throw new Error(
      'Use exportDatabaseAsync() instead - WatermelonDB requires async operations'
    );
  }

  // Export database data as raw binary using WatermelonDB APIs
  async exportDatabaseAsync(): Promise<Uint8Array> {
    // Wait for database to be ready first
    await this.waitForDatabase();

    try {
      logger.log('EXPORT: Starting WatermelonDB data export...');

      // Export all data using WatermelonDB's public APIs
      const exportData: any = {
        version: 1,
        timestamp: Date.now(),
        collections: {},
      };

      // Define all collection names
      const collections = [
        'journal_entries',
        'sections',
        'section_journal_entries',
        'template_columns',
        'template_sections',
        'api_keys',
      ];

      // Export each collection
      for (const collectionName of collections) {
        try {
          const collection = database.collections.get(collectionName);
          const records = await collection.query().fetch();

          exportData.collections[collectionName] = records.map(record => ({
            ...record._raw,
          }));

          logger.log(
            `EXPORT: Exported ${records.length} records from ${collectionName}`
          );
        } catch (error) {
          logger.error(`EXPORT: Failed to export ${collectionName}:`, error);
          exportData.collections[collectionName] = [];
        }
      }

      // Convert to JSON and then to binary
      const jsonData = JSON.stringify(exportData, null, 0);
      const binaryData = new TextEncoder().encode(jsonData);

      logger.log(
        'EXPORT: Database exported successfully, size:',
        binaryData.length
      );
      return binaryData;
    } catch (error) {
      logger.error('EXPORT: Failed to export database:', error);
      throw error;
    }
  }

  // Import database data from raw binary using WatermelonDB APIs
  async importDatabase(data: Uint8Array): Promise<void> {
    // Wait for database to be ready first
    await this.waitForDatabase();

    try {
      logger.log('IMPORT: Starting WatermelonDB data import...');

      // Decode and parse the data
      const jsonData = new TextDecoder().decode(data);
      const importData = JSON.parse(jsonData);

      logger.log('IMPORT: Parsed import data, version:', importData.version);

      if (!importData.collections) {
        throw new Error('Invalid import data format - missing collections');
      }

      // Clear existing data and import new data in a single transaction
      await database.write(async () => {
        // First, clear all existing data
        const collections = [
          'journal_entries',
          'sections',
          'section_journal_entries',
          'template_columns',
          'template_sections',
          'api_keys',
        ];

        for (const collectionName of collections) {
          try {
            const collection = database.collections.get(collectionName);
            const existingRecords = await collection.query().fetch();

            if (existingRecords.length > 0) {
              const deleteActions = existingRecords.map(record =>
                record.prepareDestroyPermanently()
              );
              await database.batch(...deleteActions);
              logger.log(
                `IMPORT: Cleared ${existingRecords.length} existing records from ${collectionName}`
              );
            }
          } catch (error) {
            logger.error(`IMPORT: Failed to clear ${collectionName}:`, error);
          }
        }

        // Then import new data
        for (const collectionName of collections) {
          try {
            const recordsData = importData.collections[collectionName] || [];
            if (recordsData.length === 0) continue;

            const collection = database.collections.get(collectionName);
            const createActions = recordsData.map((recordData: any) => {
              return collection.prepareCreate((record: any) => {
                // Set all properties from the record data
                Object.keys(recordData).forEach(key => {
                  record._raw[key] = recordData[key];
                });
              });
            });

            await database.batch(...createActions);
            logger.log(
              `IMPORT: Imported ${recordsData.length} records to ${collectionName}`
            );
          } catch (error) {
            logger.error(
              `IMPORT: Failed to import to ${collectionName}:`,
              error
            );
          }
        }
      });

      logger.log('IMPORT: Database imported successfully');

      // Show loading overlay and disable UI before reloading
      this.showReloadingOverlay();

      // Reload the page to refresh all components with a shorter delay
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      logger.error('IMPORT: Failed to import database:', error);
      throw error;
    }
  }

  // Show a full-screen loading overlay during reload
  private showReloadingOverlay(): void {
    // Create overlay element
    const overlay = document.createElement('div');
    overlay.id = 'reload-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Create spinner
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 48px;
      height: 48px;
      border: 4px solid #e5e7eb;
      border-top: 4px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 24px;
    `;

    // Add spinning animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    // Create message
    const message = document.createElement('div');
    message.style.cssText = `
      color: white;
      text-align: center;
      max-width: 400px;
    `;
    message.innerHTML = `
      <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 12px;">Restarting Application</h2>
      <p style="font-size: 16px; opacity: 0.9; margin-bottom: 8px;">Database has been successfully restored.</p>
      <p style="font-size: 14px; opacity: 0.7;">Please wait while the application reloads...</p>
    `;

    // Assemble overlay
    overlay.appendChild(spinner);
    overlay.appendChild(message);

    // Add to document
    document.body.appendChild(overlay);

    // Disable scrolling
    document.body.style.overflow = 'hidden';

    logger.log('IMPORT: Showing reload overlay');
  }

  // Generate content hash for change detection
  async getContentHash(): Promise<string> {
    try {
      // Collect all user-entered data in a consistent format
      const contentData: any = {
        journalEntries: [],
        sections: [],
        templateColumns: [],
        templateSections: [],
      };

      // Get journal entries (only date, which is user-specified)
      const entries = await database.collections
        .get<JournalEntry>('journal_entries')
        .query(Q.sortBy('date', Q.desc), Q.take(10))
        .fetch();

      contentData.journalEntries = entries.map(entry => ({
        date: entry.date,
      }));

      // Get sections content (user-entered content and type)
      const sections = await database.collections
        .get<Section>('sections')
        .query(Q.take(50))
        .fetch();

      contentData.sections = sections.map(section => ({
        type: section.type,
        content: section.content,
        timeframeType: section.timeframeType,
        timeframeStart: section.timeframeStart,
        timeframeEnd: section.timeframeEnd,
      }));

      // Get template columns (user-defined structure)
      const columns = await database.collections
        .get<TemplateColumn>('template_columns')
        .query(Q.sortBy('display_order'))
        .fetch();

      contentData.templateColumns = columns.map(column => ({
        title: column.title,
        width: column.width,
        displayOrder: column.displayOrder,
      }));

      // Get template sections (user-defined template structure)
      const templateSections = await database.collections
        .get<TemplateSection>('template_sections')
        .query(Q.sortBy('display_order'))
        .fetch();

      contentData.templateSections = templateSections.map(section => ({
        title: section.title,
        refreshFrequency: section.refreshFrequency,
        displayOrder: section.displayOrder,
        placeholder: section.placeholder,
        defaultContent: section.defaultContent,
        contentType: section.contentType,
        columnId: section.columnId,
      }));

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

// Create singleton instance for compatibility
export const databaseCompatibility = new DatabaseCompatibilityLayer();

export default database;
