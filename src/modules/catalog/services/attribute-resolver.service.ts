import { Injectable, NotFoundException } from '@nestjs/common';
import { Attribute } from '../entities/attribute.entity';
import { CategoryRepository } from '../repositories/category.repository';
import { CategoryAttributeRepository } from '../repositories/category-attribute.repository';

export interface ResolvedAttribute {
  attribute: Attribute; // with options loaded
  isRequired: boolean;
  position: number;
}

/**
 * Resolves the attributes that apply to a product in a category: the union of
 * `category_attribute` for the category AND all its ancestors, de-duplicated so
 * the most specific (closest-to-product) assignment wins.
 */
@Injectable()
export class AttributeResolverService {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly categoryAttributeRepository: CategoryAttributeRepository,
  ) {}

  async resolveForCategory(categoryId: string): Promise<ResolvedAttribute[]> {
    const chain = await this.ancestorChain(categoryId); // [self, parent, …]
    const depthOf = new Map(chain.map((id, index) => [id, index])); // 0 = most specific
    const assignments =
      await this.categoryAttributeRepository.findForCategories(chain);

    const winners = new Map<
      string,
      { resolved: ResolvedAttribute; depth: number }
    >();
    for (const assignment of assignments) {
      const depth =
        depthOf.get(assignment.categoryId) ?? Number.MAX_SAFE_INTEGER;
      const current = winners.get(assignment.attributeId);
      if (!current || depth < current.depth) {
        winners.set(assignment.attributeId, {
          depth,
          resolved: {
            attribute: assignment.attribute,
            isRequired: assignment.isRequired,
            position: assignment.position,
          },
        });
      }
    }

    return [...winners.values()]
      .map((entry) => entry.resolved)
      .sort((a, b) => a.position - b.position);
  }

  /** Category id followed by its ancestors, nearest first. */
  private async ancestorChain(categoryId: string): Promise<string[]> {
    let current = await this.categoryRepository.findById(categoryId);
    if (!current) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }
    const ids: string[] = [];
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      ids.push(current.id);
      current = current.parentId
        ? await this.categoryRepository.findById(current.parentId)
        : null;
    }
    return ids;
  }
}
