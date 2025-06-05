import { Model } from '@nozbe/watermelondb';
import { field, date, children } from '@nozbe/watermelondb/decorators';
import SectionJournalEntry from './SectionJournalEntry';

export default class Section extends Model {
  static table = 'sections';
  static associations = {
    section_journal_entries: { type: 'has_many', foreignKey: 'section_id' },
  } as const;

  @field('type') type!: string; // FK to template_sections.id
  @field('content') content!: string;
  @field('timeframe_type') timeframeType!: 'daily' | 'weekly' | 'monthly';
  @field('timeframe_start') timeframeStart!: string; // YYYY-MM-DD
  @field('timeframe_end') timeframeEnd!: string; // YYYY-MM-DD
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @children('section_journal_entries')
  sectionJournalEntries!: SectionJournalEntry[];

  // Computed property to get journal entries through junction
  get journalEntries() {
    return this.sectionJournalEntries.map(sje => sje.journalEntry);
  }
}
