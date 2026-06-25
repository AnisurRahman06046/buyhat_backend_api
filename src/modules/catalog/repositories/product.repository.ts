import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  countByCategory(categoryId: string): Promise<number> {
    return this.count({ where: { categoryId } });
  }

  countByBrand(brandId: string): Promise<number> {
    return this.count({ where: { brandId } });
  }

  /** Public, filtered, paginated list (ACTIVE only). */
  search(params: ProductSearchParams): Promise<[Product[], number]> {
    const qb = this.repository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.brand', 'brand')
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
        qb.orderBy('p.base_price', 'ASC', 'NULLS LAST');
        break;
      case 'price_desc':
        qb.orderBy('p.base_price', 'DESC', 'NULLS LAST');
        break;
      case 'name':
        qb.orderBy('p.name', 'ASC');
        break;
      default:
        qb.orderBy('p.created_at', 'DESC');
    }

    return qb.getManyAndCount();
  }
}
