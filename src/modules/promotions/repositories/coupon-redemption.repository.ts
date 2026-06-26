import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { CouponRedemption } from '../entities/coupon-redemption.entity';

@Injectable()
export class CouponRedemptionRepository extends BaseRepository<CouponRedemption> {
  constructor(
    @InjectRepository(CouponRedemption)
    repo: Repository<CouponRedemption>,
  ) {
    super(repo);
  }

  countForUser(couponId: string, userId: string): Promise<number> {
    return this.count({ where: { couponId, userId } });
  }

  countForIp(couponId: string, ipAddress: string): Promise<number> {
    return this.count({ where: { couponId, ipAddress } });
  }

  existsForOrder(couponId: string, orderId: string): Promise<boolean> {
    return this.exists({ couponId, orderId });
  }
}
