import { PartialType } from '@nestjs/swagger';
import { CreateCouponDto } from './create-coupon.dto';

/** All coupon fields optional (code included; service guards uniqueness). */
export class UpdateCouponDto extends PartialType(CreateCouponDto) {}
