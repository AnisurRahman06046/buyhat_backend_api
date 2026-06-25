import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { ProductMedia } from '../entities/product-media.entity';

@Injectable()
export class ProductMediaRepository extends BaseRepository<ProductMedia> {
  constructor(
    @InjectRepository(ProductMedia)
    repo: Repository<ProductMedia>,
  ) {
    super(repo);
  }

  findByProduct(productId: string): Promise<ProductMedia[]> {
    return this.findMany({
      where: { productId },
      order: { isPrimary: 'DESC', position: 'ASC', createdAt: 'ASC' },
    });
  }

  countByProduct(productId: string): Promise<number> {
    return this.count({ where: { productId } });
  }

  /** Highest `position` currently used for a product (-1 if none), to append. */
  async maxPosition(productId: string): Promise<number> {
    const row = await this.repository
      .createQueryBuilder('m')
      .select('MAX(m.position)', 'max')
      .where('m.product_id = :productId', { productId })
      .getRawOne<{ max: number | null }>();
    return row?.max ?? -1;
  }
}
