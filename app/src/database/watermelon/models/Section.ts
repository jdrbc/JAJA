import { Model } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';
import JournalEntry from './JournalEntry';

export default class Section extends Model {
  static table = 'sections';
  static associations = {
    journal_entry: { type: 'belongs_to', key: 'entry_id' },
  } as const;

  @field('entry_id') entryId!: string;
  @field('type') type!: string;
  @field('content') content!: string;
  @field('refresh_frequency') refreshFrequency!: string;
  @field('content_type') contentType!: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('journal_entries', 'entry_id') journalEntry!: JournalEntry;
}
