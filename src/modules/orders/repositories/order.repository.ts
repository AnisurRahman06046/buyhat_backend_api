import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status.enum';

@Injectable()
export class OrderRepository extends BaseRepository<Order> {
  constructor(
    @InjectRepository(Order)
    repo: Repository<Order>,
  ) {
    super(repo);
  }

  /** Order with its items only — enough for lifecycle transitions. */
  findWithItems(id: string): Promise<Order | null> {
    return this.findOne({ where: { id }, relations: { items: true } });
  }

  /** Full order graph (items + addresses + history) for detail views. */
  findDetail(id: string): Promise<Order | null> {
    return this.findOne({
      where: { id },
      relations: { items: true, addresses: true, statusHistory: true },
      order: { statusHistory: { createdAt: 'ASC' } },
    });
  }

  orderNumberExists(orderNumber: string): Promise<boolean> {
    return this.exists({ orderNumber });
  }

  /**
   * Most recent order id by which `userId` actually bought `productId` — a
   * "qualifying" purchase is any order containing the product whose status is
   * past checkout (not PENDING/CANCELLED). Drives the verified-purchase flag.
   */
  async findPurchasedOrderId(
    userId: string,
    productId: string,
  ): Promise<string | null> {
    const row = await this.repository
      .createQueryBuilder('o')
      .innerJoin('o.items', 'item')
      .where('o.user_id = :userId', { userId })
      .andWhere('item.product_id = :productId', { productId })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.PENDING, OrderStatus.CANCELLED],
      })
      .orderBy('o.placed_at', 'DESC', 'NULLS LAST')
      .select('o.id', 'id')
      .limit(1)
      .getRawOne<{ id: string }>();
    return row?.id ?? null;
  }

  /** Newest-first page, optionally scoped to a user and/or status. */
  list(
    skip: number,
    take: number,
    filter: { userId?: string; status?: OrderStatus },
  ): Promise<[Order[], number]> {
    const where: FindOptionsWhere<Order> = {};
    if (filter.userId) where.userId = filter.userId;
    if (filter.status) where.status = filter.status;
    return this.paginate(skip, take, {
      where,
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }
}
