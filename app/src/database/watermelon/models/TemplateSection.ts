import { Model } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';
import TemplateColumn from './TemplateColumn';

export default class TemplateSection extends Model {
  static table = 'template_sections';
  static associations = {
    template_column: { type: 'belongs_to', key: 'column_id' },
  } as const;

  @field('title') title!: string;
  @field('refresh_frequency') refreshFrequency!: string;
  @field('display_order') displayOrder!: number;
  @field('placeholder') placeholder!: string;
  @field('default_content') defaultContent!: string;
  @field('content_type') contentType!: string;
  @field('configuration') configuration!: string;
  @field('column_id') columnId!: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('template_columns', 'column_id') templateColumn!: TemplateColumn;
}
