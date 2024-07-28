import {
  Repository,
  FindManyOptions,
  SelectQueryBuilder,
  ObjectLiteral,
  FindOptionsWhere,
} from 'typeorm';
import { Pagination } from './pagination';
import {
  IPaginationMeta,
  IPaginationOptions,
  PaginationTypeEnum,
  TypeORMCacheType,
} from './interfaces';
import { createPaginationObject } from './create-pagination';

export const PAGINATION_DEFAULT_LIMIT = 10;
export const PAGINATION_DEFAULT_PAGE = 1;
/**
 *
 * @param repository
 * @param options
 * @param searchOptions
 */
export async function paginate<
  T extends ObjectLiteral,
  CustomMetaType extends ObjectLiteral = IPaginationMeta,
>(
  repository: Repository<T>,
  options: IPaginationOptions<CustomMetaType>,
  searchOptions?: FindOptionsWhere<T> | FindManyOptions<T>,
): Promise<Pagination<T, CustomMetaType>>;

/**
 *
 * @param queryBuilder
 * @param options
 */
export async function paginate<
  T extends ObjectLiteral,
  CustomMetaType extends ObjectLiteral = IPaginationMeta,
>(
  queryBuilder: SelectQueryBuilder<T>,
  options: IPaginationOptions<CustomMetaType>,
): Promise<Pagination<T, CustomMetaType>>;

/**
 *
 * @param repositoryOrQueryBuilder
 * @param options
 * @param searchOptions
 * @returns paginateRepository | paginateQueryBuilder
 */
export async function paginate<
  T extends ObjectLiteral,
  CustomMetaType extends ObjectLiteral = IPaginationMeta,
>(
  repositoryOrQueryBuilder: Repository<T> | SelectQueryBuilder<T>,
  options: IPaginationOptions<CustomMetaType>,
  searchOptions?: FindOptionsWhere<T> | FindManyOptions<T>,
) {
  return repositoryOrQueryBuilder instanceof Repository
    ? paginateRepository<T, CustomMetaType>(
        repositoryOrQueryBuilder,
        options,
        searchOptions,
      )
    : paginateQueryBuilder<T, CustomMetaType>(
        repositoryOrQueryBuilder,
        options,
      );
}

/**
 *
 * @param queryBuilder
 * @param options
 * @returns
 */
export async function paginateRaw<
  T extends ObjectLiteral,
  CustomMetaType extends ObjectLiteral = IPaginationMeta,
>(
  queryBuilder: SelectQueryBuilder<T>,
  options: IPaginationOptions<CustomMetaType>,
): Promise<Pagination<T, CustomMetaType>> {
  const [page, limit, route, paginationType, countQueries, cacheOption] =
    resolveOptions(options);

  let items: T[];
  let total;

  try {
    if (paginationType === PaginationTypeEnum.LIMIT_AND_OFFSET) {
      items = await queryBuilder
        .limit(limit)
        .offset((page - 1) * limit)
        .cache(cacheOption)
        .getRawMany<T>();
    } else {
      items = await queryBuilder
        .take(limit)
        .skip((page - 1) * limit)
        .cache(cacheOption)
        .getRawMany<T>();
    }

    if (countQueries) {
      try {
        total = await countQuery(queryBuilder, cacheOption);
      } catch (error) {
        throw new Error(error);
      }
    }
  } catch (error) {
    throw new Error(error);
  }

  return createPaginationObject<T, CustomMetaType>({
    items,
    totalItems: total,
    currentPage: page,
    limit,
    route,
    metaTransformer: options.metaTransformer,
    routingLabels: options.routingLabels,
  });
}

export async function paginateRawAndEntities<
  T extends ObjectLiteral,
  CustomMetaType extends ObjectLiteral = IPaginationMeta,
>(
  queryBuilder: SelectQueryBuilder<T>,
  options: IPaginationOptions<CustomMetaType>,
): Promise<[Pagination<T, CustomMetaType>, Partial<T>[]]> {
  const [page, limit, route, paginationType, countQueries, cacheOption] =
    resolveOptions(options);

  let itemObject: { entities: T[]; raw: T[] };
  let total;
  try {
    if (paginationType === PaginationTypeEnum.LIMIT_AND_OFFSET) {
      itemObject = await queryBuilder
        .limit(limit)
        .offset((page - 1) * limit)
        .cache(cacheOption)
        .getRawAndEntities<T>();
    } else {
      itemObject = await queryBuilder
        .take(limit)
        .skip((page - 1) * limit)
        .cache(cacheOption)
        .getRawAndEntities<T>();
    }

    if (countQueries) {
      total = await countQuery(queryBuilder, cacheOption);
    }
  } catch (error) {
    throw new Error(error);
  }

  return [
    createPaginationObject<T, CustomMetaType>({
      items: itemObject.entities,
      totalItems: total,
      currentPage: page,
      limit,
      route,
      metaTransformer: options.metaTransformer,
      routingLabels: options.routingLabels,
    }),
    itemObject.raw,
  ];
}

function resolveOptions(
  options: IPaginationOptions<any>,
): [
  number,
  number,
  string | undefined,
  PaginationTypeEnum,
  boolean,
  TypeORMCacheType,
] {
  const page = resolveNumericOption(options, 'page', PAGINATION_DEFAULT_PAGE);
  const limit = resolveNumericOption(
    options,
    'limit',
    PAGINATION_DEFAULT_LIMIT,
  );
  const route = options.route;
  const paginationType =
    options.paginationType ?? PaginationTypeEnum.LIMIT_AND_OFFSET;
  const countQueries =
    typeof options.countQueries !== 'undefined' ? options.countQueries : true;
  const cacheQueries = options.cacheQueries || false;

  return [page, limit, route, paginationType, countQueries, cacheQueries];
}

function resolveNumericOption(
  options: IPaginationOptions<any>,
  key: 'page' | 'limit',
  defaultValue: number,
): number {
  const value = options[key];
  const resolvedValue = Number(value);

  if (Number.isInteger(resolvedValue) && resolvedValue >= 0)
    return resolvedValue;

  console.warn(
    `Query parameter "${key}" with value "${value}" was resolved as "${resolvedValue}", please validate your query input! Falling back to default "${defaultValue}".`,
  );
  return defaultValue;
}

async function paginateRepository<
  T extends ObjectLiteral,
  CustomMetaType extends ObjectLiteral = IPaginationMeta,
>(
  repository: Repository<T>,
  options: IPaginationOptions<CustomMetaType>,
  searchOptions?: FindOptionsWhere<T> | FindManyOptions<T>,
): Promise<Pagination<T, CustomMetaType>> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [page, limit, route, _paginationType, countQueries] =
    resolveOptions(options);

  if (page < 1) {
    return createPaginationObject<T, CustomMetaType>({
      items: [],
      totalItems: 0,
      currentPage: page,
      limit,
      route,
      metaTransformer: options.metaTransformer,
      routingLabels: options.routingLabels,
    });
  }

  let items: T[];
  let total;
  try {
    items = await repository.find({
      skip: limit * (page - 1),
      take: limit,
      ...searchOptions,
    });

    if (countQueries) {
      total = await repository.count({
        ...searchOptions,
      });
    }
  } catch (error) {
    throw new Error(error);
  }

  return createPaginationObject<T, CustomMetaType>({
    items,
    totalItems: total,
    currentPage: page,
    limit,
    route,
    metaTransformer: options.metaTransformer,
    routingLabels: options.routingLabels,
  });
}

async function paginateQueryBuilder<
  T extends ObjectLiteral,
  CustomMetaType extends ObjectLiteral = IPaginationMeta,
>(
  queryBuilder: SelectQueryBuilder<T>,
  options: IPaginationOptions<CustomMetaType>,
): Promise<Pagination<T, CustomMetaType>> {
  const [page, limit, route, paginationType, countQueries, cacheOption] =
    resolveOptions(options);

  let items: T[] = [];
  let total;

  try {
    if (paginationType === PaginationTypeEnum.LIMIT_AND_OFFSET) {
      items = await queryBuilder
        .limit(limit)
        .offset((page - 1) * limit)
        .cache(cacheOption)
        .getMany();
    } else {
      items = await queryBuilder
        .take(limit)
        .skip((page - 1) * limit)
        .cache(cacheOption)
        .getMany();
    }

    if (countQueries) {
      total = await countQuery(queryBuilder, cacheOption);
    }
  } catch (error) {
    throw new Error(error);
  }

  return createPaginationObject<T, CustomMetaType>({
    items,
    totalItems: total,
    currentPage: page,
    limit,
    route,
    metaTransformer: options.metaTransformer,
    routingLabels: options.routingLabels,
  });
}

const countQuery = async <T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  cacheOption: TypeORMCacheType,
): Promise<number> => {
  const totalQueryBuilder = queryBuilder.clone();
  totalQueryBuilder
    .skip(undefined)
    .limit(undefined)
    .offset(undefined)
    .take(undefined);
  let result;
  try {
    result = await queryBuilder.connection
      .createQueryBuilder()
      .select('COUNT(*)', 'value')
      .from(`(${totalQueryBuilder.getQuery()})`, 'uniqueTableAlias')
      .cache(cacheOption)
      .setParameters(queryBuilder.getParameters())
      .getRawOne<{ value: string }>();
  } catch (error) {
    throw new Error(error);
  }
  return Number(result.value);
};
