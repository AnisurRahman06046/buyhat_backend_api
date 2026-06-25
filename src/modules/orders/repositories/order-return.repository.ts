import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { OrderReturn } from '../entities/order-return.entity';
import { OrderReturnItem } from '../entities/order-return-item.entity';
import { ReturnStatus } from '../enums/return-status.enum';

@Injectable()
export class OrderReturnRepository extends BaseRepository<OrderReturn> {
  constructor(
    @InjectRepository(OrderReturn)
    repo: Repository<OrderReturn>,
  ) {
    super(repo);
  }

  findDetail(id: string): Promise<OrderReturn | null> {
    return this.findOne({ where: { id }, relations: { items: true } });
  }

  findByOrder(orderId: string): Promise<OrderReturn[]> {
    return this.findMany({
      where: { orderId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Quantities already returned per order item across all non-rejected returns,
   * so a customer cannot return more than they bought.
   */
  async returnedQuantities(orderId: string): Promise<Map<string, number>> {
    const rows = await this.repository.manager
      .getRepository(OrderReturnItem)
      .createQueryBuilder('item')
      .innerJoin('item.return', 'ret')
      .select('item.order_item_id', 'orderItemId')
      .addSelect('SUM(item.quantity)', 'qty')
      .where('ret.order_id = :orderId', { orderId })
      .andWhere('ret.status != :rejected', {
        rejected: ReturnStatus.REJECTED,
      })
      .groupBy('item.order_item_id')
      .getRawMany<{ orderItemId: string; qty: string }>();
    return new Map(rows.map((r) => [r.orderItemId, Number(r.qty)]));
  }

  /** Returns (non-rejected) that have not yet been settled, for a status check. */
  hasOpenReturns(orderId: string): Promise<boolean> {
    return this.exists({
      orderId,
      status: Not(ReturnStatus.REJECTED),
    });
  }
}
