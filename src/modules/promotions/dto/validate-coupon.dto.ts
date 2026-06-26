import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** Preview a coupon against the buyer's active cart. */
export class ValidateCouponDto {
  @ApiProperty()
  @IsString()
  @Length(3, 50)
  code: string;
}
