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
  exportDatabase(): Uint8Array {
    // Since this method is called synchronously but needs async operations,
    // we'll throw an error directing to use the async version
    throw new Error(
      'Use exportDatabaseAsync() instead - WatermelonDB requires async operations'
    );
  }

  // Export database data as raw binary
  async exportDatabaseAsync(): Promise<Uint8Array> {
    // Access the underlying LokiJS database directly
    const adapter = database.adapter as any;

    if (!adapter.underlyingAdapter || !adapter.underlyingAdapter._dbName) {
      throw new Error(
        'Direct LokiJS access not available - cannot export database'
      );
    }

    // For LokiJS adapter, we need to get the serialized database
    const lokiAdapter = adapter.underlyingAdapter;

    return new Promise((resolve, reject) => {
      try {
        // Force a save to ensure all data is persisted
        lokiAdapter._lokiWorker.send('forceSerialize', [], (result: any) => {
          if (result.error) {
            reject(new Error(`Failed to serialize database: ${result.error}`));
            return;
          }

          // Get the raw serialized data
          const serializedData = result.data;

          // Convert to binary format
          const encoder = new TextEncoder();
          const binaryData = encoder.encode(serializedData);

          logger.log('Database exported as binary, size:', binaryData.length);
          resolve(binaryData);
        });
      } catch (error) {
        logger.error('Failed to export database:', error);
        reject(error);
      }
    });
  }

  // Import database data from raw binary
  async importDatabase(data: Uint8Array): Promise<void> {
    try {
      const adapter = database.adapter as any;

      if (!adapter.underlyingAdapter || !adapter.underlyingAdapter._dbName) {
        throw new Error(
          'Direct LokiJS access not available - cannot import database'
        );
      }

      // For LokiJS adapter, restore the database directly
      const lokiAdapter = adapter.underlyingAdapter;

      return new Promise((resolve, reject) => {
        try {
          // Convert binary data back to string
          const decoder = new TextDecoder();
          const serializedData = decoder.decode(data);

          logger.log('Importing database from binary, size:', data.length);

          // Send the serialized data to the worker to restore
          lokiAdapter._lokiWorker.send(
            'forceDeserialize',
            [serializedData],
            (result: any) => {
              if (result.error) {
                reject(
                  new Error(`Failed to deserialize database: ${result.error}`)
                );
                return;
              }

              logger.log('Database imported successfully from binary');

              // Force a page reload to reinitialize everything with the new database
              setTimeout(() => {
                window.location.reload();
              }, 100);

              resolve();
            }
          );
        } catch (error) {
          logger.error('Failed to import database:', error);
          reject(error);
        }
      });
    } catch (error) {
      logger.error('Failed to import database:', error);
      throw error;
    }
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
