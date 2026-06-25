import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Cart } from '../entities/cart.entity';
import { CartStatus } from '../enums/cart-status.enum';

@Injectable()
export class CartRepository extends BaseRepository<Cart> {
  constructor(
    @InjectRepository(Cart)
    repo: Repository<Cart>,
  ) {
    super(repo);
  }

  /** The caller's ACTIVE cart (with items), by user or guest. */
  findActiveByUser(userId: string): Promise<Cart | null> {
    return this.findOne({
      where: { userId, status: CartStatus.ACTIVE },
      relations: { items: true },
    });
  }

  findActiveByGuest(guestId: string): Promise<Cart | null> {
    return this.findOne({
      where: { guestId, status: CartStatus.ACTIVE },
      relations: { items: true },
    });
  }

  findWithItems(id: string): Promise<Cart | null> {
    return this.findOne({ where: { id }, relations: { items: true } });
  }

  /** ACTIVE carts idle since `before` — for the abandoned sweeper (D23). */
  findIdleActive(before: Date, limit: number): Promise<Cart[]> {
    return this.repository
      .createQueryBuilder('c')
      .where('c.status = :status', { status: CartStatus.ACTIVE })
      .andWhere('c.last_activity_at < :before', { before })
      .andWhere('c.deleted_at IS NULL')
      .orderBy('c.last_activity_at', 'ASC')
      .limit(limit)
      .getMany();
  }

  /** Guard against a stale soft-delete filter when reading by id. */
  findActiveById(id: string): Promise<Cart | null> {
    return this.findOne({
      where: { id, status: CartStatus.ACTIVE, deletedAt: IsNull() },
      relations: { items: true },
    });
  }
}
