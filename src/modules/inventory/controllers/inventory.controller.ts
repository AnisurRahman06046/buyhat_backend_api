import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  AdjustStockDto,
  AvailabilityQueryDto,
  MovementQueryDto,
  ReservationActionDto,
  ReserveStockDto,
  StockOperationDto,
} from '../dto';
import { INVENTORY_WRITE_ROLES } from '../inventory.constants';
import { InventoryService } from '../services/inventory.service';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // --- public reads ---
  @Public()
  @Get()
  @ApiOperation({ summary: 'Bulk availability (?variantIds=a,b,c)' })
  bulk(@Query() query: AvailabilityQueryDto) {
    return this.inventoryService.getBulkAvailability(query.variantIds);
  }

  @Public()
  @Get(':variantId')
  @ApiOperation({ summary: 'Availability for one variant' })
  availability(@Param('variantId', ParseUUIDPipe) variantId: string) {
    return this.inventoryService.getAvailability(variantId);
  }

  // --- admin reads ---
  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiBearerAuth()
  @Get(':variantId/movements')
  @ApiOperation({ summary: 'Stock movement ledger (paginated)' })
  movements(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Query() query: MovementQueryDto,
  ) {
    return this.inventoryService.getMovements(variantId, query);
  }

  // --- stock operations ---
  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiBearerAuth()
  @Post('stock-in')
  @ApiOperation({ summary: 'Receive stock' })
  stockIn(@CurrentUser('id') actorId: string, @Body() dto: StockOperationDto) {
    return this.inventoryService.stockIn(dto, actorId);
  }

  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiBearerAuth()
  @Post('stock-out')
  @ApiOperation({ summary: 'Remove stock (non-sale)' })
  stockOut(@CurrentUser('id') actorId: string, @Body() dto: StockOperationDto) {
    return this.inventoryService.stockOut(dto, actorId);
  }

  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiBearerAuth()
  @Post('adjustment')
  @ApiOperation({ summary: 'Adjust on-hand by a signed delta' })
  adjust(@CurrentUser('id') actorId: string, @Body() dto: AdjustStockDto) {
    return this.inventoryService.adjust(dto, actorId);
  }

  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiBearerAuth()
  @Post('return')
  @ApiOperation({ summary: 'Return stock to inventory' })
  returnStock(
    @CurrentUser('id') actorId: string,
    @Body() dto: StockOperationDto,
  ) {
    return this.inventoryService.returnStock(dto, actorId);
  }

  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiBearerAuth()
  @Post('damage')
  @ApiOperation({ summary: 'Write off damaged stock' })
  damage(@CurrentUser('id') actorId: string, @Body() dto: StockOperationDto) {
    return this.inventoryService.damageStock(dto, actorId);
  }

  // --- reservations (admin/internal; cart & orders call the service directly later) ---
  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiBearerAuth()
  @Post('reserve')
  @ApiOperation({ summary: 'Reserve stock (atomic; 409 if insufficient)' })
  reserve(@CurrentUser('id') actorId: string, @Body() dto: ReserveStockDto) {
    return this.inventoryService.reserve(dto, actorId);
  }

  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiBearerAuth()
  @Post('release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release a held reservation' })
  release(
    @CurrentUser('id') actorId: string,
    @Body() dto: ReservationActionDto,
  ) {
    return this.inventoryService.release(dto.reservationId, actorId);
  }

  @Roles(...INVENTORY_WRITE_ROLES)
  @ApiBearerAuth()
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a reservation (reserved → sold)' })
  confirm(
    @CurrentUser('id') actorId: string,
    @Body() dto: ReservationActionDto,
  ) {
    return this.inventoryService.confirm(dto.reservationId, actorId);
  }
}
