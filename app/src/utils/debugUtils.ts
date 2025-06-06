import { database } from '../database/watermelon/database';
import logger from './logger';

export class DebugUtils {
  /**
   * Open the database debug page in the current window
   */
  static openDebugPage(): void {
    if (process.env.NODE_ENV === 'development') {
      window.location.href = '/debug/database';
    } else {
      logger.warn('Debug page is only available in development mode');
    }
  }

  /**
   * Get database statistics for all collections
   */
  static async getDatabaseStats(): Promise<void> {
    try {
      const collections = [
        'journal_entries',
        'sections',
        'section_journal_entries',
        'template_columns',
        'template_sections',
        'api_keys',
      ];

      logger.log('🍉 Database Statistics');

      for (const collectionName of collections) {
        const collection = database.collections.get(collectionName);
        const count = await collection.query().fetchCount();
        logger.log(`📊 ${collectionName}: ${count} records`);
      }
    } catch (error) {
      logger.error('Failed to get database stats:', error);
    }
  }

  /**
   * Sample records from a specific collection (default: 5 records)
   */
  static async sampleCollection(
    collectionName: string,
    limit: number = 5
  ): Promise<void> {
    try {
      const collection = database.collections.get(collectionName);
      const records = await collection.query().fetch();
      const sampledRecords = records.slice(0, limit);

      logger.log(
        `🍉 Sample from ${collectionName} (${records.length} records)`
      );
      sampledRecords.forEach((record, index) => {
        logger.log(`Record ${index + 1}:`, record._raw);
      });
    } catch (error) {
      logger.error(`Failed to sample collection ${collectionName}:`, error);
    }
  }

  /**
   * Export all database data as JSON for inspection
   */
  static async exportForInspection(): Promise<any> {
    try {
      const collections = [
        'journal_entries',
        'sections',
        'section_journal_entries',
        'template_columns',
        'template_sections',
        'api_keys',
      ];

      const exportData: any = {
        timestamp: new Date().toISOString(),
        collections: {},
      };

      for (const collectionName of collections) {
        const collection = database.collections.get(collectionName);
        const records = await collection.query().fetch();
        exportData.collections[collectionName] = records.map(
          record => record._raw
        );
      }

      logger.log('🍉 Database Export:', exportData);
      return exportData;
    } catch (error) {
      logger.error('Failed to export database:', error);
      throw error;
    }
  }

  /**
   * Search for records containing a specific value across all collections
   */
  static async searchAcrossCollections(searchTerm: string): Promise<void> {
    try {
      const collections = [
        'journal_entries',
        'sections',
        'section_journal_entries',
        'template_columns',
        'template_sections',
        'api_keys',
      ];

      logger.log(`🍉 Search Results for "${searchTerm}"`);

      for (const collectionName of collections) {
        const collection = database.collections.get(collectionName);
        const allRecords = await collection.query().fetch();

        const matchingRecords = allRecords.filter(record => {
          return Object.values(record._raw).some(value =>
            String(value).toLowerCase().includes(searchTerm.toLowerCase())
          );
        });

        if (matchingRecords.length > 0) {
          logger.log(
            `📋 ${collectionName} (${matchingRecords.length} matches)`
          );
          matchingRecords.forEach((record, index) => {
            logger.log(`Match ${index + 1}:`, record._raw);
          });
        }
      }
    } catch (error) {
      logger.error('Failed to search across collections:', error);
    }
  }

  /**
   * Display help information for debug utilities
   */
  static help(): void {
    logger.log('🍉 WatermelonDB Debug Utilities');
    logger.log('Available commands:');
    logger.log('');
    logger.log('🔍 DebugUtils.openDebugPage()');
    logger.log('   Opens the database debug page in the browser');
    logger.log('');
    logger.log('📊 DebugUtils.getDatabaseStats()');
    logger.log('   Shows record counts for all collections');
    logger.log('');
    logger.log('📋 DebugUtils.sampleCollection(name, limit?)');
    logger.log('   Shows sample records from a collection');
    logger.log('   Example: DebugUtils.sampleCollection("journal_entries", 3)');
    logger.log('');
    logger.log('💾 DebugUtils.exportForInspection()');
    logger.log('   Exports all database data for inspection');
    logger.log('');
    logger.log('🔍 DebugUtils.searchAcrossCollections(term)');
    logger.log('   Searches for records containing a term');
    logger.log('   Example: DebugUtils.searchAcrossCollections("test")');
    logger.log('');
    logger.log('🔧 DatabaseResetUtil.resetDatabase()');
    logger.log('   Resets the entire database (WARNING: destructive!)');
    logger.log('');
    logger.log('Available collections:');
    logger.log('  - journal_entries');
    logger.log('  - sections');
    logger.log('  - section_journal_entries');
    logger.log('  - template_columns');
    logger.log('  - template_sections');
    logger.log('  - api_keys');
  }
}

// Make debug utilities available in console (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).DebugUtils = DebugUtils;
  logger.log(
    '🍉 WatermelonDB Debug Utilities loaded! Type DebugUtils.help() for available commands.'
  );
}
