import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'journal_entries',
      columns: [
        { name: 'date', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'sections',
      columns: [
        { name: 'entry_id', type: 'string', isIndexed: true },
        { name: 'type', type: 'string', isIndexed: true },
        { name: 'content', type: 'string' },
        { name: 'refresh_frequency', type: 'string' },
        { name: 'content_type', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'template_columns',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'width', type: 'number' },
        { name: 'display_order', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'template_sections',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'refresh_frequency', type: 'string' },
        { name: 'display_order', type: 'number' },
        { name: 'placeholder', type: 'string' },
        { name: 'default_content', type: 'string' },
        { name: 'content_type', type: 'string' },
        { name: 'column_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
