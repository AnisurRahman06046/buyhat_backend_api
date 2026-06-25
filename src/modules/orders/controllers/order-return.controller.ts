import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { CreateReturnDto } from '../dto/create-return.dto';
import { UpdateReturnDto } from '../dto/update-return.dto';
import { ORDERS_STAFF_ROLES } from '../orders.constants';
import { OrderReturnService } from '../services/order-return.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrderReturnController {
  constructor(private readonly returnService: OrderReturnService) {}

  @Post(':id/returns')
  @ApiOperation({ summary: 'Request a return for items of a delivered order' })
  request(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateReturnDto,
    @Ip() ip: string,
  ) {
    return this.returnService.requestReturn(user, orderId, dto, ip ?? null);
  }

  @Get(':id/returns')
  @ApiOperation({ summary: 'List returns for an order (owner or staff)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) orderId: string,
  ) {
    return this.returnService.listForOrder(user, orderId);
  }

  @Roles(...ORDERS_STAFF_ROLES)
  @Patch('returns/:returnId')
  @ApiOperation({ summary: 'Staff: approve / reject / receive a return' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('returnId', ParseUUIDPipe) returnId: string,
    @Body() dto: UpdateReturnDto,
    @Ip() ip: string,
  ) {
    return this.returnService.updateReturn(user, returnId, dto, ip ?? null);
  }
}
