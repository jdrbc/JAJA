import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class ApiKey extends Model {
  static table = 'api_keys';

  @field('service') service!: string;
  @field('key_value') keyValue!: string;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
