import { NotFoundException } from '@nestjs/common';
import { DeepPartial, ObjectLiteral } from 'typeorm';
import { BaseRepository } from '../repositories/base.repository';

/**
 * Generic CRUD orchestration over a {@link BaseRepository}. Feature services
 * extend it to inherit the common use-cases (find-or-404, create, update,
 * soft-remove) and override / add domain logic as needed.
 *
 * It deals in entities; modules that expose a different outward shape map to
 * response DTOs in their own service/controller (see the `users` module).
 */
export abstract class BaseService<T extends ObjectLiteral> {
  protected constructor(
    protected readonly repository: BaseRepository<T>,
    /** Human-readable name used in 404 messages, e.g. "Product". */
    protected readonly entityName: string = 'Resource',
  ) {}

  async findByIdOrThrow(id: string): Promise<T> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundException(`${this.entityName} ${id} not found`);
    }
    return entity;
  }

  create(data: DeepPartial<T>): Promise<T> {
    return this.repository.save(this.repository.create(data));
  }

  async update(id: string, data: DeepPartial<T>): Promise<T> {
    const entity = await this.findByIdOrThrow(id);
    Object.assign(entity, data);
    return this.repository.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.repository.softDelete(id);
  }
}
