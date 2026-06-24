import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';

/**
 * Generic data-access base. Feature repositories extend it and pass their
 * TypeORM `Repository` to `super`, inheriting the common CRUD surface while
 * adding their own query methods.
 *
 * Wrapping TypeORM (rather than injecting `Repository` into services directly)
 * keeps services depending on an abstraction (DIP) and confines persistence
 * details — and any future engine swap — to the repository layer.
 */
export abstract class BaseRepository<T extends ObjectLiteral> {
  protected constructor(protected readonly repository: Repository<T>) {}

  create(data: DeepPartial<T>): T {
    return this.repository.create(data);
  }

  save(entity: DeepPartial<T>): Promise<T> {
    return this.repository.save(entity);
  }

  findById(id: string): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
    });
  }

  findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne(options);
  }

  findMany(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  count(options?: FindManyOptions<T>): Promise<number> {
    return this.repository.count(options);
  }

  async exists(where: FindOptionsWhere<T>): Promise<boolean> {
    return (await this.repository.countBy(where)) > 0;
  }

  /** Offset pagination helper returning `[rows, total]`. */
  paginate(
    skip: number,
    take: number,
    options?: FindManyOptions<T>,
  ): Promise<[T[], number]> {
    return this.repository.findAndCount({ ...options, skip, take });
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /** Escape hatch for transactions / advanced queries. */
  get manager() {
    return this.repository.manager;
  }
}
