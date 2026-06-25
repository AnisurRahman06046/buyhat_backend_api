import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { CancelOrderDto } from '../dto/cancel-order.dto';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderQueryDto } from '../dto/order-query.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { ORDERS_STAFF_ROLES } from '../orders.constants';
import { OrderService } from '../services/order.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Checkout: create an order from your active cart' })
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
    @Ip() ip: string,
  ) {
    return this.orderService.checkout(user, dto, ip ?? null);
  }

  @Get()
  @ApiOperation({ summary: 'List your orders (staff: ?all=true for all)' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: OrderQueryDto) {
    return this.orderService.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Order detail (owner or staff)' })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orderService.getById(user, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an order (owner pre-payment / staff pre-shipment)',
  })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
    @Ip() ip: string,
  ) {
    return this.orderService.cancel(user, id, dto.reason ?? null, ip ?? null);
  }

  @Roles(...ORDERS_STAFF_ROLES)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Staff: advance an order through its lifecycle' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Ip() ip: string,
  ) {
    return this.orderService.updateStatus(
      user,
      id,
      dto.status,
      dto.note ?? null,
      ip ?? null,
    );
  }
}
