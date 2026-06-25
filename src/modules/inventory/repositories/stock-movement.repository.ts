import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { StockMovement } from '../entities/stock-movement.entity';

@Injectable()
export class StockMovementRepository extends BaseRepository<StockMovement> {
  constructor(
    @InjectRepository(StockMovement)
    repo: Repository<StockMovement>,
  ) {
    super(repo);
  }

  /** Newest-first ledger page for a variant. */
  findByVariant(
    variantId: string,
    skip: number,
    take: number,
  ): Promise<[StockMovement[], number]> {
    return this.paginate(skip, take, {
      where: { variantId },
      order: { createdAt: 'DESC' },
    });
  }
}
