import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Category } from '../entities/category.entity';

@Injectable()
export class CategoryRepository extends BaseRepository<Category> {
  constructor(
    @InjectRepository(Category)
    repo: Repository<Category>,
  ) {
    super(repo);
  }

  findBySlug(slug: string): Promise<Category | null> {
    return this.findOne({ where: { slug } });
  }

  slugExists(slug: string): Promise<boolean> {
    return this.exists({ slug });
  }

  countChildren(parentId: string): Promise<number> {
    return this.count({ where: { parentId } });
  }

  findAllOrdered(): Promise<Category[]> {
    return this.findMany({ order: { position: 'ASC', name: 'ASC' } });
  }

  findByIds(ids: string[]): Promise<Category[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.findMany({ where: { id: In(ids) } });
  }
}
