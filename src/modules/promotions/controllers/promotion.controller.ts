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
import {
  CreatePromotionDto,
  UpdatePromotionDto,
} from '../dto/create-promotion.dto';
import { PROMOTIONS_WRITE_ROLES } from '../promotions.constants';
import { PromotionService } from '../services/promotion.service';

@ApiTags('promotions')
@ApiBearerAuth()
@Roles(...PROMOTIONS_WRITE_ROLES)
@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a campaign' })
  create(@Body() dto: CreatePromotionDto) {
    return this.promotionService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List campaigns' })
  list() {
    return this.promotionService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a campaign' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionService.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.promotionService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a campaign' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionService.remove(id);
  }
}
