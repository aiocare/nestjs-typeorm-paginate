import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { paginate } from './../paginate';
import { Pagination } from '../pagination';
import { baseOrmConfig } from './base-orm-config';
import { TestEntity } from './test.entity';
import { PaginationTypeEnum } from '../interfaces';
import { TestRelatedEntity } from './test-related.entity';

describe('Paginate with queryBuilder', () => {
  let app: TestingModule;
  let dataSource: DataSource;
  let queryBuilder: SelectQueryBuilder<TestEntity>;
  const totalItems = 10;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          ...baseOrmConfig,
        }),
        TypeOrmModule.forFeature([TestEntity, TestRelatedEntity]), // Add entities here if needed
      ],
    }).compile();

    dataSource = app.get<DataSource>(getDataSourceToken());
    queryBuilder = dataSource.createQueryBuilder(TestEntity, 't');

    //seed some data
    await dataSource.transaction(async (manager) => {
      for (let i = 0; i < totalItems; i++) {
        await manager.save(TestEntity, {
          id: i + 1,
        });
      }
    });

    await dataSource.transaction(async (manager) => {
      for (let i = 0; i < totalItems; i++) {
        await manager.save(TestRelatedEntity, {
          id: i + 1,
          testId: i + 1,
        });
      }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('selects all items', async () => {
    const result = await paginate(queryBuilder, { limit: 10, page: 1 });

    expect(result).toBeInstanceOf(Pagination);
    expect(result.meta.totalItems).toBe(totalItems);
    expect(result.meta.totalPages).toBe(1);
    expect(result.meta.currentPage).toBe(1);
    expect(result.meta.itemsPerPage).toBe(10);
  });

  it('Can call paginate', async () => {
    const result = await paginate(queryBuilder, { limit: 10, page: 1 });
    expect(result).toBeInstanceOf(Pagination);
  });

  it('Can use paginationType take', async () => {
    const result = await paginate(queryBuilder, {
      limit: 10,
      page: 1,
      paginationType: PaginationTypeEnum.LIMIT_AND_OFFSET,
    });
    expect(result).toBeInstanceOf(Pagination);
  });

  it('Can call paginate with no count queries', async () => {
    const result = await paginate(queryBuilder, {
      limit: 10,
      page: 1,
      paginationType: PaginationTypeEnum.LIMIT_AND_OFFSET,
      countQueries: false,
    });

    expect(result).toBeInstanceOf(Pagination);
    expect(result.meta.totalItems).toBe(undefined);
    expect(result.meta.totalPages).toBe(undefined);
  });

  it('Can count with params', async () => {
    queryBuilder.where('t.id = :id', { id: 1 });

    const result = await paginate(queryBuilder, {
      limit: 10,
      page: 1,
      paginationType: PaginationTypeEnum.LIMIT_AND_OFFSET,
    });

    expect(result).toBeInstanceOf(Pagination);
    expect(result.meta.totalItems).toBe(1);
    expect(result.meta.totalPages).toBe(1);
  });

  it('Can count with having', async () => {
    const qb = dataSource
      .getRepository(TestEntity)
      .createQueryBuilder('t')
      .having('t.id > 1');

    const result = await paginate(qb, {
      limit: 10,
      page: 1,
      paginationType: PaginationTypeEnum.LIMIT_AND_OFFSET,
    });

    expect(result).toBeInstanceOf(Pagination);
    expect(result.meta.totalItems).toBe(9);
    expect(result.meta.totalPages).toBe(1);
  });

  it('Can paginate with joins', async () => {
    const qb = dataSource
      .getRepository(TestEntity)
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.related', 'related');

    const result = await paginate(qb, { limit: 5, page: 1 });

    expect(result).toBeInstanceOf(Pagination);
    expect(result.meta.totalItems).toEqual(10);
    expect(result.meta.itemCount).toEqual(5);
    expect(result.meta.totalPages).toEqual(2);
  });
});
