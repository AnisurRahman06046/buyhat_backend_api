import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { CartItem } from '../entities/cart-item.entity';

@Injectable()
export class CartItemRepository extends BaseRepository<CartItem> {
  constructor(
    @InjectRepository(CartItem)
    repo: Repository<CartItem>,
  ) {
    super(repo);
  }

  findByCartAndVariant(
    cartId: string,
    variantId: string,
  ): Promise<CartItem | null> {
    return this.findOne({ where: { cartId, variantId } });
  }

  findById(id: string): Promise<CartItem | null> {
    return this.findOne({ where: { id } });
  }
}
