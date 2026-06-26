import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { uniqueSlug } from '../../../common/utils/slug.util';
import { AssignAttributeDto } from '../dto/assign-attribute.dto';
import { AttributeResponseDto } from '../dto/attribute-response.dto';
import { CategoryResponseDto } from '../dto/category-response.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { Category } from '../entities/category.entity';
import { AttributeRepository } from '../repositories/attribute.repository';
import { CategoryAttributeRepository } from '../repositories/category-attribute.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { ProductRepository } from '../repositories/product.repository';
import { AttributeResolverService } from './attribute-resolver.service';

@Injectable()
export class CategoryService {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly categoryAttributeRepository: CategoryAttributeRepository,
    private readonly attributeRepository: AttributeRepository,
    private readonly attributeResolver: AttributeResolverService,
    private readonly productRepository: ProductRepository,
  ) {}

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    if (dto.parentId) {
      await this.getEntityOrThrow(dto.parentId);
    }
    const slug = await uniqueSlug(dto.slug ?? dto.name, (s) =>
      this.categoryRepository.slugExists(s),
    );
    const category = await this.categoryRepository.save(
      this.categoryRepository.create({
        name: dto.name,
        slug,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        parentId: dto.parentId ?? null,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
      }),
    );
    return CategoryResponseDto.fromEntity(category);
  }

  async tree(): Promise<CategoryResponseDto[]> {
    const all = await this.categoryRepository.findAllOrdered();
    return this.buildTree(all, null);
  }

  async findOne(idOrSlug: string): Promise<CategoryResponseDto> {
    return CategoryResponseDto.fromEntity(await this.resolveCategory(idOrSlug));
  }

  /**
   * Cross-module (cms): active category summaries for a list of ids, in the
   * **given order** (CATEGORY_GRID homepage section). Inactive/missing dropped.
   */
  async getCategorySummaries(ids: string[]): Promise<CategoryResponseDto[]> {
    if (ids.length === 0) return [];
    const categories = await this.categoryRepository.findByIds(ids);
    const byId = new Map(categories.map((c) => [c.id, c]));
    return ids
      .map((id) => byId.get(id))
      .filter((c): c is Category => c != null && c.isActive)
      .map((c) => CategoryResponseDto.fromEntity(c));
  }

  async resolvedAttributes(idOrSlug: string): Promise<AttributeResponseDto[]> {
    const category = await this.resolveCategory(idOrSlug);
    const resolved = await this.attributeResolver.resolveForCategory(
      category.id,
    );
    return resolved.map((r) => AttributeResponseDto.fromEntity(r.attribute));
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.getEntityOrThrow(id);
    if (dto.parentId && dto.parentId !== category.parentId) {
      if (dto.parentId === id) {
        throw new ConflictException('A category cannot be its own parent');
      }
      await this.getEntityOrThrow(dto.parentId);
      category.parentId = dto.parentId;
    }
    if (dto.name !== undefined) category.name = dto.name;
    if (dto.description !== undefined)
      category.description = dto.description ?? null;
    if (dto.imageUrl !== undefined) category.imageUrl = dto.imageUrl ?? null;
    if (dto.position !== undefined) category.position = dto.position;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;
    if (dto.slug && dto.slug !== category.slug) {
      category.slug = await uniqueSlug(dto.slug, (s) =>
        this.categoryRepository.slugExists(s),
      );
    }
    return CategoryResponseDto.fromEntity(
      await this.categoryRepository.save(category),
    );
  }

  async remove(id: string): Promise<void> {
    await this.getEntityOrThrow(id);
    if ((await this.categoryRepository.countChildren(id)) > 0) {
      throw new ConflictException('Category has child categories');
    }
    if ((await this.productRepository.countByCategory(id)) > 0) {
      throw new ConflictException('Category has products; archive them first');
    }
    await this.categoryRepository.softDelete(id);
  }

  async assignAttribute(
    categoryId: string,
    dto: AssignAttributeDto,
  ): Promise<void> {
    await this.getEntityOrThrow(categoryId);
    if (!(await this.attributeRepository.findById(dto.attributeId))) {
      throw new NotFoundException(`Attribute ${dto.attributeId} not found`);
    }
    const existing =
      await this.categoryAttributeRepository.findByCategoryAndAttribute(
        categoryId,
        dto.attributeId,
      );
    if (existing) {
      existing.isRequired = dto.isRequired ?? existing.isRequired;
      existing.position = dto.position ?? existing.position;
      await this.categoryAttributeRepository.save(existing);
      return;
    }
    await this.categoryAttributeRepository.save(
      this.categoryAttributeRepository.create({
        categoryId,
        attributeId: dto.attributeId,
        isRequired: dto.isRequired ?? false,
        position: dto.position ?? 0,
      }),
    );
  }

  async unassignAttribute(
    categoryId: string,
    attributeId: string,
  ): Promise<void> {
    const assignment =
      await this.categoryAttributeRepository.findByCategoryAndAttribute(
        categoryId,
        attributeId,
      );
    if (!assignment) {
      throw new NotFoundException('Attribute is not assigned to this category');
    }
    await this.categoryAttributeRepository.hardDelete(assignment.id);
  }

  private buildTree(
    all: Category[],
    parentId: string | null,
  ): CategoryResponseDto[] {
    return all
      .filter((c) => c.parentId === parentId)
      .map((c) => CategoryResponseDto.fromEntity(c, this.buildTree(all, c.id)));
  }

  private async resolveCategory(idOrSlug: string): Promise<Category> {
    const category = isUUID(idOrSlug)
      ? await this.categoryRepository.findById(idOrSlug)
      : await this.categoryRepository.findBySlug(idOrSlug);
    if (!category) {
      throw new NotFoundException(`Category "${idOrSlug}" not found`);
    }
    return category;
  }

  private async getEntityOrThrow(id: string): Promise<Category> {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return category;
  }
}
