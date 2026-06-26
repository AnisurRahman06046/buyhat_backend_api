import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { OrderFact } from '../entities/order-fact.entity';
import { SalesGranularity } from '../enums/sales-granularity.enum';

/** One sales bucket as aggregated from `order_fact`. */
export interface SalesPeriodRow {
  period: Date;
  orders: number;
  gross: number;
  discount: number;
  refunded: number;
  items: number;
}

@Injectable()
export class OrderFactRepository extends BaseRepository<OrderFact> {
  constructor(
    @InjectRepository(OrderFact)
    repo: Repository<OrderFact>,
  ) {
    super(repo);
  }

  findByOrderId(orderId: string): Promise<OrderFact | null> {
    return this.findOne({ where: { orderId } });
  }

  /**
   * Revenue/orders/items grouped by `committed_at` truncated to `granularity`.
   * `granularity` is a whitelisted enum value (never raw user input), so the
   * `date_trunc` unit interpolation is safe.
   */
  async salesByPeriod(
    from: Date,
    to: Date,
    granularity: SalesGranularity,
  ): Promise<SalesPeriodRow[]> {
    const rows = await this.repository
      .createQueryBuilder('f')
      .select(`date_trunc('${granularity}', f.committed_at)`, 'period')
      .addSelect('COUNT(*)', 'orders')
      .addSelect('COALESCE(SUM(f.grand_amount), 0)', 'gross')
      .addSelect('COALESCE(SUM(f.discount_amount), 0)', 'discount')
      .addSelect('COALESCE(SUM(f.refunded_amount), 0)', 'refunded')
      .addSelect('COALESCE(SUM(f.items_count), 0)', 'items')
      .where('f.committed_at BETWEEN :from AND :to', { from, to })
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany<{
        period: Date;
        orders: string;
        gross: string;
        discount: string;
        refunded: string;
        items: string;
      }>();
    return rows.map((r) => ({
      period: r.period,
      orders: Number(r.orders),
      gross: Number(r.gross),
      discount: Number(r.discount),
      refunded: Number(r.refunded),
      items: Number(r.items),
    }));
  }
}
