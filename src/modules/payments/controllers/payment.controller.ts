import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { InitiatePaymentDto } from '../dto/initiate-payment.dto';
import { RefundPaymentDto } from '../dto/refund-payment.dto';
import { PaymentGateway } from '../enums/payment-gateway.enum';
import { PAYMENTS_STAFF_ROLES } from '../payments.constants';
import { PaymentService } from '../services/payment.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiBearerAuth()
  @Post('initiate')
  @ApiOperation({
    summary: 'Start a payment for an order (online → redirect; COD → confirm)',
  })
  initiate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentService.initiate(user, dto);
  }

  @Public()
  @Post('webhook/:gateway')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gateway webhook/callback (signature-verified, idempotent)',
  })
  webhook(
    @Param('gateway') gateway: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.paymentService.handleWebhook(
      gateway.toUpperCase() as PaymentGateway,
      payload ?? {},
    );
  }

  @ApiBearerAuth()
  @Get('order/:orderId')
  @ApiOperation({ summary: 'Payments for an order (owner or staff)' })
  forOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.paymentService.getForOrder(user, orderId);
  }

  @Roles(...PAYMENTS_STAFF_ROLES)
  @ApiBearerAuth()
  @Post('refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Staff: refund an order’s payment' })
  refund(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefundPaymentDto,
  ) {
    return this.paymentService.refund(user, dto);
  }

  @Roles(...PAYMENTS_STAFF_ROLES)
  @ApiBearerAuth()
  @Post(':id/capture')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Staff: mark a COD payment collected (on delivery)',
  })
  capture(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentService.captureCod(user, id);
  }
}
