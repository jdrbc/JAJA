import { Model } from '@nozbe/watermelondb';
import { field, date, children } from '@nozbe/watermelondb/decorators';
import SectionJournalEntry from './SectionJournalEntry';

export default class JournalEntry extends Model {
  static table = 'journal_entries';
  static associations = {
    section_journal_entries: {
      type: 'has_many',
      foreignKey: 'journal_entry_id',
    },
  } as const;

  @field('date') date!: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @children('section_journal_entries')
  sectionJournalEntries!: SectionJournalEntry[];

  // Computed property to get sections through junction
  get sections() {
    return this.sectionJournalEntries.map(sje => sje.section);
  }
}
