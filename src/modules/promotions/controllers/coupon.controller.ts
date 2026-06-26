import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CreateCouponDto } from '../dto/create-coupon.dto';
import { UpdateCouponDto } from '../dto/update-coupon.dto';
import { PROMOTIONS_WRITE_ROLES } from '../promotions.constants';
import { CouponService } from '../services/coupon.service';

@ApiTags('promotions')
@ApiBearerAuth()
@Roles(...PROMOTIONS_WRITE_ROLES)
@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post()
  @ApiOperation({ summary: 'Create a coupon' })
  create(@Body() dto: CreateCouponDto) {
    return this.couponService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List coupons' })
  list() {
    return this.couponService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a coupon' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.couponService.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a coupon' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCouponDto) {
    return this.couponService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a coupon' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.couponService.remove(id);
  }
}
