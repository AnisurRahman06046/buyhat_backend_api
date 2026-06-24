import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { PaginationMeta } from '../interfaces';
import { buildPaginationMeta } from '../utils';

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

/**
 * Generic data-access base. Wraps a TypeORM `Repository<T>` by **composition**
 * (not inheritance) so concrete repositories expose a small, intention-
 * revealing surface and stay trivially unit-testable (mock the wrapped repo).
 *
 * It holds **no business rules** — that is the service layer's responsibility
 * (clean layering: controller → service → repository). Concrete repositories
 * extend this, pass their injected `Repository<T>` to `super`, and add only
 * the bespoke query methods their aggregate needs.
 *
 * `softDelete`/`restore` require the entity to extend {@link AuditableEntity}
 * (i.e. to have a `@DeleteDateColumn`); on a plain {@link BaseEntity} they
 * throw, by design.
 */
export abstract class BaseRepository<T extends ObjectLiteral> {
  protected constructor(protected readonly repository: Repository<T>) {}

  /** Instantiate an entity from a partial (does not persist). */
  create(data: DeepPartial<T>): T {
    return this.repository.create(data);
  }

  /** Insert or update and return the managed entity. */
  save(entity: DeepPartial<T>): Promise<T> {
    return this.repository.save(entity);
  }

  findById(id: string, options?: Omit<FindOneOptions<T>, 'where'>): Promise<T | null> {
    return this.repository.findOne({
      ...options,
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

  exists(where: FindOptionsWhere<T>): Promise<boolean> {
    return this.repository.existsBy(where);
  }

  /** Page over a result set, returning items plus pagination metadata. */
  async paginate(
    page: number,
    limit: number,
    options?: FindManyOptions<T>,
  ): Promise<PaginatedResult<T>> {
    const safePage = Math.max(1, page);
    const [items, totalItems] = await this.repository.findAndCount({
      ...options,
      skip: (safePage - 1) * limit,
      take: limit,
    });
    return { items, meta: buildPaginationMeta(totalItems, safePage, limit) };
  }

  /** Soft delete (sets `deletedAt`). Requires an AuditableEntity. */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /** Reverse a soft delete. Requires an AuditableEntity. */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /** Physically remove a row — use only for ephemeral/non-auditable data. */
  async hardDelete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /** EntityManager escape hatch for multi-step transactional work. */
  get manager() {
    return this.repository.manager;
  }
}
