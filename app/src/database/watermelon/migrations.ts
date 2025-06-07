import {
  schemaMigrations,
  addColumns,
} from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'template_sections',
          columns: [{ name: 'configuration', type: 'string' }],
        }),
      ],
    },
  ],
});
