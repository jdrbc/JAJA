import database from '../database/watermelon/database';
import { logger } from './logger';

export class DatabaseResetUtil {
  /**
   * Permanently reset the entire database by clearing all data
   * WARNING: This will delete ALL data permanently!
   */
  static async resetDatabase(): Promise<void> {
    try {
      logger.log('DATABASE_RESET: Starting complete database reset...');

      await database.write(async () => {
        // Get all collection names from the database
        const collections = [
          'journal_entries',
          'sections',
          'section_journal_entries',
          'template_columns',
          'template_sections',
          'api_keys',
        ];

        let totalRecordsDeleted = 0;

        // Clear each collection
        for (const collectionName of collections) {
          logger.log(`DATABASE_RESET: Clearing collection: ${collectionName}`);

          const collection = database.collections.get(collectionName);
          const allRecords = await collection.query().fetch();

          if (allRecords.length > 0) {
            logger.log(
              `DATABASE_RESET: Found ${allRecords.length} records in ${collectionName}`
            );

            // Use batch delete for better performance
            const deleteActions = allRecords.map(record =>
              record.prepareDestroyPermanently()
            );

            await database.batch(...deleteActions);
            totalRecordsDeleted += allRecords.length;

            logger.log(
              `DATABASE_RESET: Deleted ${allRecords.length} records from ${collectionName}`
            );
          } else {
            logger.log(`DATABASE_RESET: No records found in ${collectionName}`);
          }
        }

        logger.log(
          `DATABASE_RESET: Total records deleted: ${totalRecordsDeleted}`
        );
      });

      // Clear any cached data or local storage that might interfere
      if (typeof window !== 'undefined') {
        // Clear localStorage keys related to the app
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith('journal-') || key.startsWith('watermelon-'))
          ) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          logger.log(`DATABASE_RESET: Cleared localStorage key: ${key}`);
        });

        // Clear sessionStorage as well
        sessionStorage.clear();
        logger.log('DATABASE_RESET: Cleared sessionStorage');
      }

      logger.log('DATABASE_RESET: Database reset completed successfully!');
    } catch (error) {
      logger.error('DATABASE_RESET: Failed to reset database:', error);
      throw error;
    }
  }

  /**
   * Reset only user data (journal entries, sections, and their relationships)
   * Keep templates and configuration
   */
  static async resetUserDataOnly(): Promise<void> {
    try {
      logger.log('DATABASE_RESET: Starting user data reset...');

      await database.write(async () => {
        // Only clear user-generated content
        const userDataCollections = [
          'journal_entries',
          'sections',
          'section_journal_entries',
        ];

        let totalRecordsDeleted = 0;

        for (const collectionName of userDataCollections) {
          logger.log(
            `DATABASE_RESET: Clearing user data from: ${collectionName}`
          );

          const collection = database.collections.get(collectionName);
          const allRecords = await collection.query().fetch();

          if (allRecords.length > 0) {
            const deleteActions = allRecords.map(record =>
              record.prepareDestroyPermanently()
            );

            await database.batch(...deleteActions);
            totalRecordsDeleted += allRecords.length;

            logger.log(
              `DATABASE_RESET: Deleted ${allRecords.length} records from ${collectionName}`
            );
          }
        }

        logger.log(
          `DATABASE_RESET: Total user data records deleted: ${totalRecordsDeleted}`
        );
      });

      logger.log('DATABASE_RESET: User data reset completed successfully!');
    } catch (error) {
      logger.error('DATABASE_RESET: Failed to reset user data:', error);
      throw error;
    }
  }

  /**
   * Reset only template configuration (columns and sections)
   * Keep user data intact
   */
  static async resetTemplatesOnly(): Promise<void> {
    try {
      logger.log('DATABASE_RESET: Starting template reset...');

      await database.write(async () => {
        const templateCollections = [
          'template_sections', // Delete sections first due to foreign key
          'template_columns',
        ];

        let totalRecordsDeleted = 0;

        for (const collectionName of templateCollections) {
          logger.log(
            `DATABASE_RESET: Clearing templates from: ${collectionName}`
          );

          const collection = database.collections.get(collectionName);
          const allRecords = await collection.query().fetch();

          if (allRecords.length > 0) {
            const deleteActions = allRecords.map(record =>
              record.prepareDestroyPermanently()
            );

            await database.batch(...deleteActions);
            totalRecordsDeleted += allRecords.length;

            logger.log(
              `DATABASE_RESET: Deleted ${allRecords.length} records from ${collectionName}`
            );
          }
        }

        logger.log(
          `DATABASE_RESET: Total template records deleted: ${totalRecordsDeleted}`
        );
      });

      logger.log('DATABASE_RESET: Template reset completed successfully!');
    } catch (error) {
      logger.error('DATABASE_RESET: Failed to reset templates:', error);
      throw error;
    }
  }
}

// Make it available on window object for console access
if (typeof window !== 'undefined') {
  (window as any).DatabaseResetUtil = DatabaseResetUtil;
}
