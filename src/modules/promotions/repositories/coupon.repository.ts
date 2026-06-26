import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Coupon } from '../entities/coupon.entity';

@Injectable()
export class CouponRepository extends BaseRepository<Coupon> {
  constructor(
    @InjectRepository(Coupon)
    repo: Repository<Coupon>,
  ) {
    super(repo);
  }

  findByCode(code: string): Promise<Coupon | null> {
    return this.findOne({
      where: { code },
      relations: { categories: true },
    });
  }

  codeExists(code: string): Promise<boolean> {
    return this.exists({ code });
  }

  findWithCategories(id: string): Promise<Coupon | null> {
    return this.findOne({ where: { id }, relations: { categories: true } });
  }

  /**
   * Atomically increment `used_count` (no hard cap here — the limit is enforced
   * at validation time; this just keeps the global counter moving at redemption).
   */
  async incrementUsed(id: string): Promise<void> {
    await this.repository.increment({ id }, 'usedCount', 1);
  }
}
