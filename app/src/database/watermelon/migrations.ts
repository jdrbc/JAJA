import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    // {
    //   toVersion: 2,
    //   steps: [
    //     createTable({
    //       name: 'api_keys',
    //       columns: [
    //         { name: 'service', type: 'string', isIndexed: true },
    //         { name: 'key_value', type: 'string' },
    //         { name: 'created_at', type: 'number' },
    //         { name: 'updated_at', type: 'number' },
    //       ],
    //     }),
    //   ],
    // },
  ],
});
