import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { CategoryAttribute } from '../entities/category-attribute.entity';

@Injectable()
export class CategoryAttributeRepository extends BaseRepository<CategoryAttribute> {
  constructor(
    @InjectRepository(CategoryAttribute)
    repo: Repository<CategoryAttribute>,
  ) {
    super(repo);
  }

  /** Assignments for a set of categories, with attribute + its options loaded. */
  findForCategories(categoryIds: string[]): Promise<CategoryAttribute[]> {
    if (categoryIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.findMany({
      where: { categoryId: In(categoryIds) },
      relations: { attribute: { options: true } },
      order: { position: 'ASC' },
    });
  }

  findByCategoryAndAttribute(
    categoryId: string,
    attributeId: string,
  ): Promise<CategoryAttribute | null> {
    return this.findOne({ where: { categoryId, attributeId } });
  }

  existsForAttribute(attributeId: string): Promise<boolean> {
    return this.exists({ attributeId });
  }
}
