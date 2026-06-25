import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CATALOG_WRITE_ROLES } from '../catalog.constants';
import { UpdateVariantDto } from '../dto/update-variant.dto';
import { VariantService } from '../services/variant.service';

@ApiTags('catalog/variants')
@ApiBearerAuth()
@Roles(...CATALOG_WRITE_ROLES)
@Controller('variants')
export class VariantController {
  constructor(private readonly variantService: VariantService) {}

  @Put(':id')
  @ApiOperation({ summary: 'Update a variant' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.variantService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a variant' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.variantService.remove(id);
    return { deleted: true };
  }
}
