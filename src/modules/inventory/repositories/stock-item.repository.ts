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
}
