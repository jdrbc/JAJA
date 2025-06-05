import { Model } from '@nozbe/watermelondb';
import { field, date, children } from '@nozbe/watermelondb/decorators';
import TemplateSection from './TemplateSection';

export default class TemplateColumn extends Model {
  static table = 'template_columns';
  static associations = {
    template_sections: { type: 'has_many', foreignKey: 'column_id' },
  } as const;

  @field('title') title!: string;
  @field('width') width!: number;
  @field('display_order') displayOrder!: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @children('template_sections') templateSections!: TemplateSection[];
}
