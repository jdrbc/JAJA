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
  // Export database data as JSON structure
  exportDatabase(): Uint8Array {
    // Since this method is called synchronously but needs async operations,
    // we'll throw an error directing to use the async version
    throw new Error(
      'Use exportDatabaseAsync() instead - WatermelonDB requires async operations'
    );
  }

  // Async version of export for actual use
  async exportDatabaseAsync(): Promise<Uint8Array> {
    const data: any = {
      version: 1,
      timestamp: new Date().toISOString(),
      tables: {
        journal_entries: [],
        sections: [],
        section_journal_entries: [],
        template_columns: [],
        template_sections: [],
        api_keys: [],
      },
    };

    // Export journal entries
    const journalEntries = await database.collections
      .get<JournalEntry>('journal_entries')
      .query()
      .fetch();

    data.tables.journal_entries = journalEntries.map(entry => ({
      id: entry.id,
      date: entry.date,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));

    // Export sections (new timeframe-based structure)
    const sections = await database.collections
      .get<Section>('sections')
      .query()
      .fetch();

    data.tables.sections = sections.map(section => ({
      id: section.id,
      type: section.type,
      content: section.content,
      timeframeType: section.timeframeType,
      timeframeStart: section.timeframeStart,
      timeframeEnd: section.timeframeEnd,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    }));

    // Export section-journal entry relationships
    const sectionJournalEntries = await database.collections
      .get<SectionJournalEntry>('section_journal_entries')
      .query()
      .fetch();

    data.tables.section_journal_entries = sectionJournalEntries.map(
      relation => ({
        id: relation.id,
        sectionId: relation.sectionId,
        journalEntryId: relation.journalEntryId,
        createdAt: relation.createdAt,
        updatedAt: relation.updatedAt,
      })
    );

    // Export template columns
    const templateColumns = await database.collections
      .get<TemplateColumn>('template_columns')
      .query()
      .fetch();

    data.tables.template_columns = templateColumns.map(column => ({
      id: column.id,
      title: column.title,
      width: column.width,
      displayOrder: column.displayOrder,
      createdAt: column.createdAt,
      updatedAt: column.updatedAt,
    }));

    // Export template sections
    const templateSections = await database.collections
      .get<TemplateSection>('template_sections')
      .query()
      .fetch();

    data.tables.template_sections = templateSections.map(section => ({
      id: section.id,
      title: section.title,
      refreshFrequency: section.refreshFrequency,
      displayOrder: section.displayOrder,
      placeholder: section.placeholder,
      defaultContent: section.defaultContent,
      contentType: section.contentType,
      columnId: section.columnId,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    }));

    // Export API keys
    const apiKeys = await database.collections
      .get<ApiKey>('api_keys')
      .query()
      .fetch();

    data.tables.api_keys = apiKeys.map(key => ({
      id: key.id,
      service: key.service,
      keyValue: key.keyValue,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }));

    // Convert to JSON string and then to Uint8Array
    const jsonString = JSON.stringify(data, null, 2);
    const encoder = new TextEncoder();
    return encoder.encode(jsonString);
  }

  // Import database data from JSON structure
  async importDatabase(data: Uint8Array): Promise<void> {
    try {
      // Convert Uint8Array back to JSON string
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(data);
      const importData = JSON.parse(jsonString);

      // Validate data structure
      if (!importData.version || !importData.tables) {
        throw new Error('Invalid backup data format');
      }

      // Clear existing data using WatermelonDB batch operations
      await database.write(async () => {
        // Clear all collections
        const collections = [
          'journal_entries',
          'sections',
          'section_journal_entries',
          'template_columns',
          'template_sections',
          'api_keys',
        ];

        for (const collectionName of collections) {
          const collection = database.collections.get(collectionName);
          const allRecords = await collection.query().fetch();
          const deleteActions = allRecords.map(record =>
            record.prepareDestroyPermanently()
          );
          await database.batch(...deleteActions);
        }
      });

      // Import data using WatermelonDB batch operations
      await database.write(async () => {
        const createActions: any[] = [];

        // Import journal entries
        if (importData.tables.journal_entries) {
          for (const entryData of importData.tables.journal_entries) {
            const journalEntriesCollection =
              database.collections.get<JournalEntry>('journal_entries');
            createActions.push(
              journalEntriesCollection.prepareCreate(entry => {
                entry._raw.id = entryData.id;
                entry.date = entryData.date;
              })
            );
          }
        }

        // Import template columns first (needed for template sections foreign key)
        if (importData.tables.template_columns) {
          for (const columnData of importData.tables.template_columns) {
            const templateColumnsCollection =
              database.collections.get<TemplateColumn>('template_columns');
            createActions.push(
              templateColumnsCollection.prepareCreate(column => {
                column._raw.id = columnData.id;
                column.title = columnData.title;
                column.width = columnData.width;
                column.displayOrder = columnData.displayOrder;
              })
            );
          }
        }

        // Import template sections
        if (importData.tables.template_sections) {
          for (const sectionData of importData.tables.template_sections) {
            const templateSectionsCollection =
              database.collections.get<TemplateSection>('template_sections');
            createActions.push(
              templateSectionsCollection.prepareCreate(section => {
                section._raw.id = sectionData.id;
                section.title = sectionData.title;
                section.refreshFrequency = sectionData.refreshFrequency;
                section.displayOrder = sectionData.displayOrder;
                section.placeholder = sectionData.placeholder;
                section.defaultContent = sectionData.defaultContent;
                section.contentType = sectionData.contentType;
                section.columnId = sectionData.columnId;
              })
            );
          }
        }

        // Import sections (new timeframe-based structure)
        if (importData.tables.sections) {
          for (const sectionData of importData.tables.sections) {
            const sectionsCollection =
              database.collections.get<Section>('sections');
            createActions.push(
              sectionsCollection.prepareCreate(section => {
                section._raw.id = sectionData.id;
                section.type = sectionData.type;
                section.content = sectionData.content;
                section.timeframeType = sectionData.timeframeType;
                section.timeframeStart = sectionData.timeframeStart;
                section.timeframeEnd = sectionData.timeframeEnd;
              })
            );
          }
        }

        // Import section-journal entry relationships
        if (importData.tables.section_journal_entries) {
          for (const relationData of importData.tables
            .section_journal_entries) {
            const junctionCollection =
              database.collections.get<SectionJournalEntry>(
                'section_journal_entries'
              );
            createActions.push(
              junctionCollection.prepareCreate(relation => {
                relation._raw.id = relationData.id;
                relation.sectionId = relationData.sectionId;
                relation.journalEntryId = relationData.journalEntryId;
              })
            );
          }
        }

        // Import API keys
        if (importData.tables.api_keys) {
          for (const keyData of importData.tables.api_keys) {
            const apiKeysCollection =
              database.collections.get<ApiKey>('api_keys');
            createActions.push(
              apiKeysCollection.prepareCreate(key => {
                key._raw.id = keyData.id;
                key.service = keyData.service;
                key.keyValue = keyData.keyValue;
              })
            );
          }
        }

        // Execute all create operations in a single batch
        await database.batch(...createActions);
      });

      logger.log('Database imported successfully from JSON backup');
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
