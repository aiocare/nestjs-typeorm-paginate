import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { TestRelatedEntity } from './test-related.entity';
import { TestEntity } from './test.entity';

export const baseOrmConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'test_user',
  password: 'test_password',
  database: 'test_db',
  entities: [TestEntity, TestRelatedEntity],
  synchronize: true,
  dropSchema: true,
};
