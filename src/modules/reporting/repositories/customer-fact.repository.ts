import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { CustomerFact } from '../entities/customer-fact.entity';

@Injectable()
export class CustomerFactRepository extends BaseRepository<CustomerFact> {
  constructor(
    @InjectRepository(CustomerFact)
    repo: Repository<CustomerFact>,
  ) {
    super(repo);
  }

  /** Total customers, new in the window, and repeat (≥2 committed orders). */
  async counts(
    from: Date,
    to: Date,
  ): Promise<{ total: number; newCustomers: number; repeat: number }> {
    const [total, newCustomers, repeat] = await Promise.all([
      this.count(),
      this.count({ where: { registeredAt: Between(from, to) } }),
      this.count({ where: { ordersCount: MoreThanOrEqual(2) } }),
    ]);
    return { total, newCustomers, repeat };
  }
}
