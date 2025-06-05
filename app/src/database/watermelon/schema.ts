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
        { name: 'type', type: 'string', isIndexed: true }, // FK to template_sections.id
        { name: 'content', type: 'string' },
        { name: 'timeframe_type', type: 'string', isIndexed: true }, // 'daily', 'weekly', 'monthly'
        { name: 'timeframe_start', type: 'string', isIndexed: true }, // YYYY-MM-DD
        { name: 'timeframe_end', type: 'string' }, // YYYY-MM-DD
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    // Junction table for many-to-many relationship
    tableSchema({
      name: 'section_journal_entries',
      columns: [
        { name: 'section_id', type: 'string', isIndexed: true },
        { name: 'journal_entry_id', type: 'string', isIndexed: true },
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
    tableSchema({
      name: 'api_keys',
      columns: [
        { name: 'service', type: 'string', isIndexed: true },
        { name: 'key_value', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
