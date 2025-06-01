import { Model } from '@nozbe/watermelondb';
import { field, date, children } from '@nozbe/watermelondb/decorators';
import Section from './Section';

export default class JournalEntry extends Model {
  static table = 'journal_entries';
  static associations = {
    sections: { type: 'has_many', foreignKey: 'entry_id' },
  } as const;

  @field('date') date!: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @children('sections') sections!: Section[];
}
