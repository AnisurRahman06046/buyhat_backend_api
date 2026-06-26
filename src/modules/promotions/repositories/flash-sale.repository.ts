import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { FlashSale } from '../entities/flash-sale.entity';
import { FlashSaleItem } from '../entities/flash-sale-item.entity';
import { FlashSaleStatus } from '../enums/flash-sale-status.enum';

@Injectable()
export class FlashSaleRepository extends BaseRepository<FlashSale> {
  constructor(
    @InjectRepository(FlashSale)
    repo: Repository<FlashSale>,
  ) {
    super(repo);
  }

  findWithItems(id: string): Promise<FlashSale | null> {
    return this.findOne({ where: { id }, relations: { items: true } });
  }

  /** Flash sales whose window currently includes `now` (status-independent). */
  findActiveAt(now: Date): Promise<FlashSale[]> {
    return this.repository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.items', 'item')
      .where('sale.deleted_at IS NULL')
      .andWhere('sale.starts_at <= :now', { now })
      .andWhere('sale.ends_at > :now', { now })
      .getMany();
  }

  /**
   * Items on flash sale for the given variants right now (the lowest sale price
   * per variant if several windows overlap), keyed for checkout/cart pricing.
   */
  async activeItemsForVariants(
    variantIds: string[],
    now: Date,
  ): Promise<FlashSaleItem[]> {
    if (variantIds.length === 0) return [];
    return this.repository.manager
      .getRepository(FlashSaleItem)
      .createQueryBuilder('item')
      .innerJoin('item.flashSale', 'sale')
      .where('sale.deleted_at IS NULL')
      .andWhere('sale.starts_at <= :now', { now })
      .andWhere('sale.ends_at > :now', { now })
      .andWhere('item.variant_id IN (:...variantIds)', { variantIds })
      .getMany();
  }

  /** Sweeper: activate scheduled sales now in-window, end sales past their window. */
  async sweepStatuses(now: Date): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(FlashSale)
      .set({ status: FlashSaleStatus.ACTIVE })
      .where('status = :scheduled', { scheduled: FlashSaleStatus.SCHEDULED })
      .andWhere('starts_at <= :now AND ends_at > :now', { now })
      .execute();
    await this.repository
      .createQueryBuilder()
      .update(FlashSale)
      .set({ status: FlashSaleStatus.ENDED })
      .where('status IN (:...open)', {
        open: [FlashSaleStatus.SCHEDULED, FlashSaleStatus.ACTIVE],
      })
      .andWhere('ends_at <= :now', { now })
      .execute();
  }

  /** Increment sold_count for sale items of given variants (best-effort, at payment). */
  async incrementSold(variantIds: string[], now: Date): Promise<void> {
    if (variantIds.length === 0) return;
    const items = await this.activeItemsForVariants(variantIds, now);
    const repo = this.repository.manager.getRepository(FlashSaleItem);
    for (const item of items) {
      await repo.increment({ id: item.id }, 'soldCount', 1);
    }
  }

  itemsByIds(ids: string[]): Promise<FlashSaleItem[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.repository.manager
      .getRepository(FlashSaleItem)
      .find({ where: { id: In(ids) } });
  }
}
