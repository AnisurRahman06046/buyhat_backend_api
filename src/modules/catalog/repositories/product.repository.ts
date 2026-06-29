import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { ProductStatus } from '../enums/product-status.enum';
import { Product } from '../entities/product.entity';

export interface ProductSearchParams {
  page: number;
  limit: number;
  categoryId?: string;
  brandId?: string;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name';
}

export interface AdminProductSearchParams extends ProductSearchParams {
  status?: ProductStatus;
}

const FULL_RELATIONS = {
  category: true,
  brand: true,
  attributeValues: true,
  variants: { attributeValues: true },
  media: true,
} as const;

@Injectable()
export class ProductRepository extends BaseRepository<Product> {
  constructor(
    @InjectRepository(Product)
    repo: Repository<Product>,
  ) {
    super(repo);
  }

  slugExists(slug: string): Promise<boolean> {
    return this.exists({ slug });
  }

  /** Full product graph for an admin (any status). */
  findDetail(id: string): Promise<Product | null> {
    return this.findOne({ where: { id }, relations: FULL_RELATIONS });
  }

  /** Public detail: ACTIVE only. */
  findActiveBySlug(slug: string): Promise<Product | null> {
    return this.findOne({
      where: { slug, status: ProductStatus.ACTIVE },
      relations: FULL_RELATIONS,
    });
  }

  /**
   * Lightweight lookup by ids (any status, incl. soft-deleted) with the primary
   * image, for cross-module name/image resolution (orders, reporting).
   */
  summariesByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.repository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.media', 'media', 'media.is_primary = true')
      .withDeleted()
      .where('p.id IN (:...ids)', { ids })
      .getMany();
  }

  countByCategory(categoryId: string): Promise<number> {
    return this.count({ where: { categoryId } });
  }

  /** Map each product id to its category id (for cross-module category lookups). */
  async categoryIdsByProduct(
    productIds: string[],
  ): Promise<Map<string, string>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.findMany({
      where: { id: In(productIds) },
      select: { id: true, categoryId: true },
    });
    return new Map(rows.map((p) => [p.id, p.categoryId]));
  }

  countByBrand(brandId: string): Promise<number> {
    return this.count({ where: { brandId } });
  }

  /** Set the denormalized rating aggregate (driven by the reviews module). */
  async updateRating(
    productId: string,
    ratingAvg: number,
    ratingCount: number,
  ): Promise<void> {
    await this.repository.update({ id: productId }, { ratingAvg, ratingCount });
  }

  /**
   * ACTIVE products by id with brand/category + primary image, for CMS homepage
   * hydration (FEATURED_PRODUCTS / BEST_SELLERS). Caller restores input order;
   * missing/inactive ids are simply absent (CMS never blocks on catalog state).
   */
  findActiveSummariesByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.repository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.media', 'media', 'media.is_primary = true')
      .where('p.id IN (:...ids)', { ids })
      .andWhere('p.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('p.deletedAt IS NULL')
      .getMany();
  }

  /** Public, filtered, paginated list (ACTIVE only). */
  search(params: ProductSearchParams): Promise<[Product[], number]> {
    const qb = this.repository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.media', 'media', 'media.is_primary = true')
      .where('p.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('p.deletedAt IS NULL')
      .skip((params.page - 1) * params.limit)
      .take(params.limit);

    if (params.categoryId) {
      qb.andWhere('p.category_id = :categoryId', {
        categoryId: params.categoryId,
      });
    }
    if (params.brandId) {
      qb.andWhere('p.brand_id = :brandId', { brandId: params.brandId });
    }
    if (params.minPrice != null) {
      qb.andWhere('p.base_price >= :minPrice', { minPrice: params.minPrice });
    }
    if (params.maxPrice != null) {
      qb.andWhere('p.base_price <= :maxPrice', { maxPrice: params.maxPrice });
    }
    if (params.q) {
      qb.andWhere('p.name ILIKE :q', { q: `%${params.q}%` });
    }

    switch (params.sort) {
      case 'price_asc':
        qb.orderBy('p.basePrice', 'ASC', 'NULLS LAST');
        break;
      case 'price_desc':
        qb.orderBy('p.basePrice', 'DESC', 'NULLS LAST');
        break;
      case 'name':
        qb.orderBy('p.name', 'ASC');
        break;
      default:
        qb.orderBy('p.createdAt', 'DESC');
    }

    return qb.getManyAndCount();
  }

  /**
   * Admin, filtered, paginated list across all statuses (incl. soft-deleted
   * archived products), with an optional status filter.
   */
  adminSearch(params: AdminProductSearchParams): Promise<[Product[], number]> {
    const qb = this.repository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.media', 'media', 'media.is_primary = true')
      .withDeleted()
      .skip((params.page - 1) * params.limit)
      .take(params.limit);

    if (params.status) {
      qb.andWhere('p.status = :status', { status: params.status });
    }
    if (params.categoryId) {
      qb.andWhere('p.category_id = :categoryId', {
        categoryId: params.categoryId,
      });
    }
    if (params.brandId) {
      qb.andWhere('p.brand_id = :brandId', { brandId: params.brandId });
    }
    if (params.minPrice != null) {
      qb.andWhere('p.base_price >= :minPrice', { minPrice: params.minPrice });
    }
    if (params.maxPrice != null) {
      qb.andWhere('p.base_price <= :maxPrice', { maxPrice: params.maxPrice });
    }
    if (params.q) {
      qb.andWhere('p.name ILIKE :q', { q: `%${params.q}%` });
    }

    switch (params.sort) {
      case 'price_asc':
        qb.orderBy('p.basePrice', 'ASC', 'NULLS LAST');
        break;
      case 'price_desc':
        qb.orderBy('p.basePrice', 'DESC', 'NULLS LAST');
        break;
      case 'name':
        qb.orderBy('p.name', 'ASC');
        break;
      default:
        qb.orderBy('p.createdAt', 'DESC');
    }

    return qb.getManyAndCount();
  }
}
