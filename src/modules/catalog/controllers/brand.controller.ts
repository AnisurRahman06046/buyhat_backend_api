import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CATALOG_WRITE_ROLES } from '../catalog.constants';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { BrandService } from '../services/brand.service';

@ApiTags('catalog/brands')
@Controller('brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List brands' })
  list() {
    return this.brandService.list();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a brand' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.brandService.findOne(id);
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a brand' })
  create(@Body() dto: CreateBrandDto) {
    return this.brandService.create(dto);
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update a brand' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBrandDto) {
    return this.brandService.update(id, dto);
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a brand' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.brandService.remove(id);
    return { deleted: true };
  }
}
