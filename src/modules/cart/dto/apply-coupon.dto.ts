import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** Apply a coupon code to the active cart. */
export class ApplyCouponDto {
  @ApiProperty()
  @IsString()
  @Length(3, 50)
  code: string;
}
