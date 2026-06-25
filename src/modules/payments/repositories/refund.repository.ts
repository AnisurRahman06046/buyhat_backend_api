import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Refund } from '../entities/refund.entity';

@Injectable()
export class RefundRepository extends BaseRepository<Refund> {
  constructor(
    @InjectRepository(Refund)
    repo: Repository<Refund>,
  ) {
    super(repo);
  }

  findByOrder(orderId: string): Promise<Refund[]> {
    return this.findMany({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }
}
