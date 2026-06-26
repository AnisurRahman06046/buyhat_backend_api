import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { StockItem } from '../entities/stock-item.entity';

@Injectable()
export class StockItemRepository extends BaseRepository<StockItem> {
  constructor(
    @InjectRepository(StockItem)
    repo: Repository<StockItem>,
  ) {
    super(repo);
  }

  findByVariant(variantId: string): Promise<StockItem | null> {
    return this.findOne({ where: { variantId } });
  }

  existsForVariant(variantId: string): Promise<boolean> {
    return this.exists({ variantId });
  }

  findByVariants(variantIds: string[]): Promise<StockItem[]> {
    if (variantIds.length === 0) return Promise.resolve([]);
    return this.findMany({ where: { variantId: In(variantIds) } });
  }

  /** `available = on_hand − reserved`. */
  private static readonly AVAILABLE =
    '(s.quantity_on_hand - s.quantity_reserved)';

  /** Items with available ≤ 0, lowest first. */
  outOfStock(limit: number): Promise<StockItem[]> {
    return this.repository
      .createQueryBuilder('s')
      .where(`${StockItemRepository.AVAILABLE} <= 0`)
      .orderBy(StockItemRepository.AVAILABLE, 'ASC')
      .take(limit)
      .getMany();
  }

  countOutOfStock(): Promise<number> {
    return this.repository
      .createQueryBuilder('s')
      .where(`${StockItemRepository.AVAILABLE} <= 0`)
      .getCount();
  }

  /** Items at/under their reorder level but still in stock, lowest first. */
  lowStock(limit: number): Promise<StockItem[]> {
    return this.repository
      .createQueryBuilder('s')
      .where('s.reorder_level > 0')
      .andWhere(`${StockItemRepository.AVAILABLE} > 0`)
      .andWhere(`${StockItemRepository.AVAILABLE} <= s.reorder_level`)
      .orderBy(StockItemRepository.AVAILABLE, 'ASC')
      .take(limit)
      .getMany();
  }

  countLowStock(): Promise<number> {
    return this.repository
      .createQueryBuilder('s')
      .where('s.reorder_level > 0')
      .andWhere(`${StockItemRepository.AVAILABLE} > 0`)
      .andWhere(`${StockItemRepository.AVAILABLE} <= s.reorder_level`)
      .getCount();
  }
}
