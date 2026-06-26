import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { Coupon } from './coupon.entity';

/** Restricts a coupon to specific catalog categories (logical category_id ref). */
@Entity({ schema: SCHEMA.PROMOTIONS, name: 'coupon_category' })
@Index(['couponId', 'categoryId'], { unique: true })
export class CouponCategory extends BaseEntity {
  @Column({ name: 'coupon_id', type: 'uuid' })
  couponId: string;

  @ManyToOne(() => Coupon, (coupon) => coupon.categories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'coupon_id' })
  coupon: Coupon;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;
}
