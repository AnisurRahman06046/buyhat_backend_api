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
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CreateFlashSaleDto } from '../dto/create-flash-sale.dto';
import { UpdateFlashSaleDto } from '../dto/update-flash-sale.dto';
import { PROMOTIONS_WRITE_ROLES } from '../promotions.constants';
import { FlashSaleService } from '../services/flash-sale.service';

@ApiTags('promotions')
@Controller('flash-sales')
export class FlashSaleController {
  constructor(private readonly flashSaleService: FlashSaleService) {}

  // Declared before ':id' so "active" isn't captured as an id.
  @Public()
  @Get('active')
  @ApiOperation({ summary: 'Currently-active flash sales (public)' })
  active() {
    return this.flashSaleService.listActive();
  }

  @Roles(...PROMOTIONS_WRITE_ROLES)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a flash sale with items' })
  create(@Body() dto: CreateFlashSaleDto) {
    return this.flashSaleService.create(dto);
  }

  @Roles(...PROMOTIONS_WRITE_ROLES)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'List flash sales' })
  list() {
    return this.flashSaleService.list();
  }

  @Roles(...PROMOTIONS_WRITE_ROLES)
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Get a flash sale' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.flashSaleService.get(id);
  }

  @Roles(...PROMOTIONS_WRITE_ROLES)
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update a flash sale window' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFlashSaleDto,
  ) {
    return this.flashSaleService.update(id, dto);
  }

  @Roles(...PROMOTIONS_WRITE_ROLES)
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a flash sale' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.flashSaleService.remove(id);
  }
}
