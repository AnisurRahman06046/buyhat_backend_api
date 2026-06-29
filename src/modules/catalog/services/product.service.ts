import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaginationMeta } from '../../../common/interfaces/api-response.interface';
import { buildPaginationMeta } from '../../../common/utils/pagination.util';
import { uniqueSlug } from '../../../common/utils/slug.util';
import {
  CACHE_KEYS,
  CACHE_TTL_DEFAULTS,
  CacheService,
} from '../../../shared/cache';
import { CreateProductDto } from '../dto/create-product.dto';
import { ProductDetailResponseDto } from '../dto/product-detail-response.dto';
import { ProductSearchQueryDto } from '../dto/product-search-query.dto';
import {
  ProductSearchResult,
  SEARCH_PROVIDER,
  SearchProvider,
} from '../search/search.types';
import { ProductListItemDto } from '../dto/product-response.dto';
import { ProductListQueryDto } from '../dto/product-list-query.dto';
import { AdminProductListQueryDto } from '../dto/admin-product-list-query.dto';
import { SetAttributeValuesDto } from '../dto/set-attribute-values.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { Product } from '../entities/product.entity';
import { ProductAttributeValue } from '../entities/product-attribute-value.entity';
import { AttributeType } from '../enums/attribute-type.enum';
import { MediaType } from '../enums/media-type.enum';
import { ProductStatus } from '../enums/product-status.enum';
import { BrandRepository } from '../repositories/brand.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { ProductRepository } from '../repositories/product.repository';
import { AttributeResolverService } from './attribute-resolver.service';

const OPTION_TYPES = [AttributeType.SELECT, AttributeType.MULTISELECT];

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly brandRepository: BrandRepository,
    private readonly attributeResolver: AttributeResolverService,
    private readonly dataSource: DataSource,
    private readonly cache: CacheService,
    @Inject(SEARCH_PROVIDER) private readonly searchProvider: SearchProvider,
  ) {}

  /** Faceted, keyset-paginated product search (delegates to the search port). */
  search(query: ProductSearchQueryDto): Promise<ProductSearchResult> {
    return this.searchProvider.search({
      q: query.q,
      categoryId: query.categoryId,
      brandId: query.brandId,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      attributes: query.toAttributeFilters(),
      sort: query.sort ?? (query.q ? 'relevance' : 'newest'),
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  /** Bust all cached product-detail entries after a catalog write. */
  evictProductCaches(): Promise<void> {
    return this.cache.delByPrefix(CACHE_KEYS.productPrefix());
  }

  async create(
    dto: CreateProductDto,
    actorId: string,
  ): Promise<ProductDetailResponseDto> {
    if (!(await this.categoryRepository.findById(dto.categoryId))) {
      throw new NotFoundException(`Category ${dto.categoryId} not found`);
    }
    if (dto.brandId && !(await this.brandRepository.findById(dto.brandId))) {
      throw new NotFoundException(`Brand ${dto.brandId} not found`);
    }
    const slug = await uniqueSlug(dto.slug ?? dto.name, (s) =>
      this.productRepository.slugExists(s),
    );
    const product = await this.productRepository.save(
      this.productRepository.create({
        name: dto.name,
        slug,
        description: dto.description ?? null,
        categoryId: dto.categoryId,
        brandId: dto.brandId ?? null,
        basePrice: dto.basePrice ?? null,
        currency: dto.currency ?? 'BDT',
        status: ProductStatus.DRAFT,
        createdBy: actorId,
      }),
    );
    return this.detail(product.id);
  }

  async detail(id: string): Promise<ProductDetailResponseDto> {
    const product = await this.productRepository.findDetail(id);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return ProductDetailResponseDto.fromEntity(product);
  }

  /**
   * Cross-module (promotions): map product ids → their category id, for coupon
   * category-eligibility checks. Other modules never read catalog tables.
   */
  getProductCategories(productIds: string[]): Promise<Map<string, string>> {
    return this.productRepository.categoryIdsByProduct(productIds);
  }

  /** Cross-module (reviews): does a product exist? (create-time validation). */
  productExists(productId: string): Promise<boolean> {
    return this.productRepository.exists({ id: productId });
  }

  /**
   * Cross-module (reviews): set the denormalized rating aggregate. Reviews is the
   * source of truth and passes the freshly-recomputed avg/count; catalog only
   * stores them (never reads the reviews tables).
   */
  applyRatingAggregate(
    productId: string,
    ratingAvg: number,
    ratingCount: number,
  ): Promise<void> {
    return this.productRepository.updateRating(
      productId,
      ratingAvg,
      ratingCount,
    );
  }

  /**
   * Cross-module (cms): ACTIVE product summaries (with primary image) for a list
   * of ids, in the **given order**. Missing/inactive ids are dropped — the CMS
   * homepage renders whatever still exists and never blocks on catalog deletes.
   */
  async getProductSummaries(ids: string[]): Promise<ProductListItemDto[]> {
    if (ids.length === 0) return [];
    const products = await this.productRepository.findActiveSummariesByIds(ids);
    const byId = new Map(products.map((p) => [p.id, p]));
    return ids
      .map((id) => byId.get(id))
      .filter((p): p is Product => p != null)
      .map((p) => ProductListItemDto.fromEntity(p));
  }

  async publicDetail(slug: string): Promise<ProductDetailResponseDto> {
    return this.cache.getOrSet(
      CACHE_KEYS.productBySlug(slug),
      CACHE_TTL_DEFAULTS.productDetail,
      async () => {
        const product = await this.productRepository.findActiveBySlug(slug);
        if (!product) {
          throw new NotFoundException(`Product "${slug}" not found`);
        }
        product.variants = (product.variants ?? []).filter((v) => v.isActive);
        return ProductDetailResponseDto.fromEntity(product);
      },
    );
  }

  async list(query: ProductListQueryDto): Promise<{
    data: ProductListItemDto[];
    pagination: PaginationMeta;
  }> {
    const [items, total] = await this.productRepository.search(query);
    return {
      data: items.map((p) => ProductListItemDto.fromEntity(p)),
      pagination: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  /** Admin list: all statuses, optional status filter. */
  async adminList(query: AdminProductListQueryDto): Promise<{
    data: ProductListItemDto[];
    pagination: PaginationMeta;
  }> {
    const [items, total] = await this.productRepository.adminSearch(query);
    return {
      data: items.map((p) => ProductListItemDto.fromEntity(p)),
      pagination: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  /**
   * Resolve product id → display name + primary image, for other modules
   * (orders line images, reporting best-seller names) without a schema join.
   */
  async productSummariesByIds(
    ids: string[],
  ): Promise<Map<string, { name: string; imageUrl: string | null }>> {
    const products = await this.productRepository.summariesByIds(ids);
    return new Map(
      products.map((p) => {
        const media = p.media ?? [];
        const imageUrl =
          (media.find((m) => m.isPrimary) ?? media[0])?.url ?? null;
        return [p.id, { name: p.name, imageUrl }];
      }),
    );
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    actorId: string,
  ): Promise<ProductDetailResponseDto> {
    const product = await this.getEntityOrThrow(id);
    if (dto.categoryId && dto.categoryId !== product.categoryId) {
      if (!(await this.categoryRepository.findById(dto.categoryId))) {
        throw new NotFoundException(`Category ${dto.categoryId} not found`);
      }
      product.categoryId = dto.categoryId;
    }
    if (dto.brandId !== undefined) {
      if (dto.brandId && !(await this.brandRepository.findById(dto.brandId))) {
        throw new NotFoundException(`Brand ${dto.brandId} not found`);
      }
      product.brandId = dto.brandId ?? null;
    }
    if (dto.slug && dto.slug !== product.slug) {
      product.slug = await uniqueSlug(dto.slug, (s) =>
        this.productRepository.slugExists(s),
      );
    }
    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined)
      product.description = dto.description ?? null;
    if (dto.basePrice !== undefined) product.basePrice = dto.basePrice ?? null;
    if (dto.currency !== undefined) product.currency = dto.currency;
    product.updatedBy = actorId;
    await this.productRepository.save(product);
    await this.evictProductCaches();
    return this.detail(id);
  }

  async remove(id: string): Promise<void> {
    const product = await this.getEntityOrThrow(id);
    product.status = ProductStatus.ARCHIVED;
    await this.productRepository.save(product);
    await this.productRepository.softDelete(id);
    await this.evictProductCaches();
  }

  async setAttributeValues(
    id: string,
    dto: SetAttributeValuesDto,
  ): Promise<ProductDetailResponseDto> {
    const product = await this.getEntityOrThrow(id);
    const resolved = await this.attributeResolver.resolveForCategory(
      product.categoryId,
    );
    const applicable = new Map(
      resolved.map((r) => [r.attribute.id, r.attribute]),
    );

    await this.dataSource.transaction(async (manager) => {
      for (const value of dto.values) {
        const attribute = applicable.get(value.attributeId);
        if (!attribute) {
          throw new BadRequestException(
            `Attribute ${value.attributeId} does not apply to this product's category`,
          );
        }
        if (attribute.isVariantDefining) {
          throw new BadRequestException(
            `Attribute "${attribute.code}" is variant-defining; set it via variants`,
          );
        }
        if (OPTION_TYPES.includes(attribute.type)) {
          if (!value.optionId) {
            throw new BadRequestException(
              `optionId required for "${attribute.code}"`,
            );
          }
          if (!(attribute.options ?? []).some((o) => o.id === value.optionId)) {
            throw new BadRequestException(
              `Invalid option for "${attribute.code}"`,
            );
          }
        } else if (value.valueText == null) {
          throw new BadRequestException(
            `valueText required for "${attribute.code}"`,
          );
        }

        const existing = await manager.findOne(ProductAttributeValue, {
          where: { productId: id, attributeId: value.attributeId },
        });
        if (existing) {
          existing.optionId = value.optionId ?? null;
          existing.valueText = value.valueText ?? null;
          await manager.save(existing);
        } else {
          await manager.save(
            manager.create(ProductAttributeValue, {
              productId: id,
              attributeId: value.attributeId,
              optionId: value.optionId ?? null,
              valueText: value.valueText ?? null,
            }),
          );
        }
      }
    });
    await this.evictProductCaches();
    return this.detail(id);
  }

  async publish(id: string): Promise<ProductDetailResponseDto> {
    const product = await this.productRepository.findDetail(id);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    const errors = await this.publishErrors(product);
    if (errors.length > 0) {
      throw new UnprocessableEntityException(
        `Product cannot be published: ${errors.join('; ')}`,
      );
    }
    product.status = ProductStatus.ACTIVE;
    await this.productRepository.save(product);
    await this.evictProductCaches();
    return this.detail(id);
  }

  async unpublish(id: string): Promise<ProductDetailResponseDto> {
    const product = await this.getEntityOrThrow(id);
    product.status = ProductStatus.ARCHIVED;
    await this.productRepository.save(product);
    await this.evictProductCaches();
    return this.detail(id);
  }

  /** Returns the list of unmet publish preconditions (empty = publishable). */
  private async publishErrors(product: Product): Promise<string[]> {
    const errors: string[] = [];
    const resolved = await this.attributeResolver.resolveForCategory(
      product.categoryId,
    );
    const valuedAttributeIds = new Set(
      (product.attributeValues ?? []).map((av) => av.attributeId),
    );
    for (const r of resolved) {
      if (r.isRequired && !r.attribute.isVariantDefining) {
        if (!valuedAttributeIds.has(r.attribute.id)) {
          errors.push(`missing required attribute "${r.attribute.code}"`);
        }
      }
    }
    const hasVariantDefining = resolved.some(
      (r) => r.attribute.isVariantDefining,
    );
    if (hasVariantDefining) {
      const activeVariants = (product.variants ?? []).filter((v) => v.isActive);
      if (activeVariants.length === 0) {
        errors.push('at least one active variant is required');
      }
    } else if (product.basePrice == null) {
      errors.push('base_price is required for a product without variants');
    }
    // D11: a publishable product must have at least one image.
    const hasImage = (product.media ?? []).some(
      (m) => m.type === MediaType.IMAGE,
    );
    if (!hasImage) {
      errors.push('at least one image is required');
    }
    return errors;
  }

  private async getEntityOrThrow(id: string): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }
}
