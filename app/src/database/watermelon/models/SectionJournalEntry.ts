import { Model, Q } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';
import Section from './Section';
import JournalEntry from './JournalEntry';

export default class SectionJournalEntry extends Model {
  static table = 'section_journal_entries';
  static associations = {
    section: { type: 'belongs_to', key: 'section_id' },
    journal_entry: { type: 'belongs_to', key: 'journal_entry_id' },
  } as const;

  @field('section_id') sectionId!: string;
  @field('journal_entry_id') journalEntryId!: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('sections', 'section_id') section!: Section;
  @relation('journal_entries', 'journal_entry_id') journalEntry!: JournalEntry;

  /**
   * Validates that there is only one record per section-journal entry pair
   */
  async validate() {
    if (!this.sectionId || !this.journalEntryId) {
      throw new Error('Both section_id and journal_entry_id are required');
    }

    // Check for existing records with the same composite key (excluding current record)
    const existingRecords = await this.collections
      .get('section_journal_entries')
      .query(
        Q.where('section_id', this.sectionId),
        Q.where('journal_entry_id', this.journalEntryId),
        Q.where('id', Q.notEq(this.id))
      )
      .fetch();

    if (existingRecords.length > 0) {
      throw new Error(
        `Duplicate section-journal entry pair: section_id="${this.sectionId}", journal_entry_id="${this.journalEntryId}"`
      );
    }
  }

  /**
   * Static method to find existing record by composite key
   */
  static async findByCompositeKey(
    collection: any,
    sectionId: string,
    journalEntryId: string
  ): Promise<SectionJournalEntry | null> {
    if (!sectionId || !journalEntryId) {
      throw new Error('Both sectionId and journalEntryId are required');
    }

    const records = await collection
      .query(
        Q.where('section_id', sectionId),
        Q.where('journal_entry_id', journalEntryId)
      )
      .fetch();

    return records.length > 0 ? records[0] : null;
  }

  /**
   * Static method to upsert (create or update) a section-journal entry relationship
   */
  static async upsert(
    collection: any,
    sectionId: string,
    journalEntryId: string
  ): Promise<SectionJournalEntry> {
    if (!sectionId || !journalEntryId) {
      throw new Error('Both sectionId and journalEntryId are required');
    }

    const existing = await this.findByCompositeKey(
      collection,
      sectionId,
      journalEntryId
    );

    if (existing) {
      // Update existing record's updated_at timestamp
      return await existing.update((record: SectionJournalEntry) => {
        // Just touching the record to update the updated_at timestamp
        // No actual field changes needed for this junction table
      });
    } else {
      // Create new record
      return await collection.create((record: SectionJournalEntry) => {
        record.sectionId = sectionId;
        record.journalEntryId = journalEntryId;
      });
    }
  }

  /**
   * Static method to clean up duplicate records, keeping the most recent one
   * This should be run as a one-time cleanup operation
   */
  static async cleanupDuplicates(collection: any): Promise<number> {
    const allRecords = await collection.query().fetch();
    const duplicateGroups = new Map<string, SectionJournalEntry[]>();

    // Group records by composite key
    for (const record of allRecords) {
      const compositeKey = `${record.sectionId}-${record.journalEntryId}`;
      if (!duplicateGroups.has(compositeKey)) {
        duplicateGroups.set(compositeKey, []);
      }
      duplicateGroups.get(compositeKey)!.push(record);
    }

    // Find groups with duplicates
    let deletedCount = 0;
    const recordsToDelete: SectionJournalEntry[] = [];

    duplicateGroups.forEach((records, key) => {
      if (records.length > 1) {
        // Keep the most recent record (by created_at), delete the rest
        records.sort(
          (a: SectionJournalEntry, b: SectionJournalEntry) =>
            b.createdAt.getTime() - a.createdAt.getTime()
        );
        const recordsToRemove = records.slice(1); // Remove all but the first (most recent)
        recordsToDelete.push(...recordsToRemove);
        deletedCount += recordsToRemove.length;
      }
    });

    // Delete duplicate records
    if (recordsToDelete.length > 0) {
      const deleteActions = recordsToDelete.map(record =>
        record.prepareDestroyPermanently()
      );
      await collection.database.batch(...deleteActions);
    }

    return deletedCount;
  }

  /**
   * Static method to get all records for a section
   */
  static async findBySection(
    collection: any,
    sectionId: string
  ): Promise<SectionJournalEntry[]> {
    if (!sectionId) {
      throw new Error('sectionId is required');
    }

    return await collection.query(Q.where('section_id', sectionId)).fetch();
  }

  /**
   * Static method to get all records for a journal entry
   */
  static async findByJournalEntry(
    collection: any,
    journalEntryId: string
  ): Promise<SectionJournalEntry[]> {
    if (!journalEntryId) {
      throw new Error('journalEntryId is required');
    }

    return await collection
      .query(Q.where('journal_entry_id', journalEntryId))
      .fetch();
  }
}
