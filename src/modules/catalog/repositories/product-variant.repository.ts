import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { ProductVariant } from '../entities/product-variant.entity';

@Injectable()
export class ProductVariantRepository extends BaseRepository<ProductVariant> {
  constructor(
    @InjectRepository(ProductVariant)
    repo: Repository<ProductVariant>,
  ) {
    super(repo);
  }

  findByProduct(productId: string): Promise<ProductVariant[]> {
    return this.findMany({
      where: { productId },
      relations: { attributeValues: true },
      order: { createdAt: 'ASC' },
    });
  }

  findDetail(id: string): Promise<ProductVariant | null> {
    return this.findOne({
      where: { id },
      relations: { attributeValues: true },
    });
  }

  /** Existing combination signatures for a product (to skip duplicates on generation). */
  async existingSignatures(productId: string): Promise<Set<string>> {
    const rows = await this.repository.find({
      where: { productId },
      select: { attributeSignature: true },
    });
    return new Set(rows.map((row) => row.attributeSignature));
  }

  countActiveByProduct(productId: string): Promise<number> {
    return this.count({ where: { productId, isActive: true } });
  }

  skuExists(sku: string): Promise<boolean> {
    return this.exists({ sku });
  }
}
