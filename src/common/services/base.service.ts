import { NotFoundException } from '@nestjs/common';
import { DeepPartial, FindManyOptions, ObjectLiteral } from 'typeorm';
import { PaginatedResponseDto } from '../dto';
import { BaseRepository } from '../repositories';

/**
 * Generic application-service base. Orchestrates the common CRUD lifecycle on
 * top of a {@link BaseRepository} and translates a missing row into a proper
 * `404`. It also stamps the audit authorship (`createdBy`/`updatedBy`) from the
 * acting user when one is supplied.
 *
 * Concrete services extend this, inject their repository, and add the real
 * domain logic — validation, cross-module service calls, domain events. Every
 * method is `protected`/overridable: treat these as sensible defaults, not a
 * straitjacket. This base is the only place CRUD plumbing is duplicated, so
 * feature services stay focused on business rules (SRP/DRY).
 */
export abstract class BaseService<T extends ObjectLiteral> {
  protected constructor(
    protected readonly repository: BaseRepository<T>,
    /** Human-readable resource name used in not-found messages, e.g. "Address". */
    protected readonly resourceName: string,
  ) {}

  async findById(id: string): Promise<T> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundException(`${this.resourceName} not found`);
    }
    return entity;
  }

  async paginate(
    page: number,
    limit: number,
    options?: FindManyOptions<T>,
  ): Promise<PaginatedResponseDto<T>> {
    const { items, meta } = await this.repository.paginate(page, limit, options);
    return new PaginatedResponseDto<T>(items, meta);
  }

  async create(data: DeepPartial<T>, actorId?: string | null): Promise<T> {
    const entity = this.repository.create(this.stampAuthor(data, actorId, true));
    return this.repository.save(entity);
  }

  async update(id: string, data: DeepPartial<T>, actorId?: string | null): Promise<T> {
    const existing = await this.findById(id);
    const merged = this.repository.create({
      ...existing,
      ...this.stampAuthor(data, actorId, false),
    } as DeepPartial<T>);
    return this.repository.save(merged);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.repository.softDelete(id);
  }

  /**
   * Attach authorship audit fields. Safe on non-auditable entities — TypeORM
   * persists only mapped columns, so extra keys are ignored.
   */
  protected stampAuthor(
    data: DeepPartial<T>,
    actorId: string | null | undefined,
    isCreate: boolean,
  ): DeepPartial<T> {
    if (actorId == null) {
      return data;
    }
    return {
      ...data,
      ...(isCreate ? { createdBy: actorId } : {}),
      updatedBy: actorId,
    } as DeepPartial<T>;
  }
}
