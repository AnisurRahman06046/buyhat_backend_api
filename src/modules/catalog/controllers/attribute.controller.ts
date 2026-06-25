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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CATALOG_WRITE_ROLES } from '../catalog.constants';
import { CreateAttributeDto } from '../dto/create-attribute.dto';
import { CreateAttributeOptionDto } from '../dto/create-attribute-option.dto';
import { UpdateAttributeDto } from '../dto/update-attribute.dto';
import { AttributeType } from '../enums/attribute-type.enum';
import { AttributeService } from '../services/attribute.service';

@ApiTags('catalog/attributes')
@ApiBearerAuth()
@Roles(...CATALOG_WRITE_ROLES)
@Controller('attributes')
export class AttributeController {
  constructor(private readonly attributeService: AttributeService) {}

  @Get()
  @ApiOperation({ summary: 'List attributes' })
  list(
    @Query('type') type?: AttributeType,
    @Query('variantDefining') variantDefining?: string,
  ) {
    return this.attributeService.list({
      type,
      variantDefining:
        variantDefining === undefined ? undefined : variantDefining === 'true',
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create an attribute (with options)' })
  create(@Body() dto: CreateAttributeDto) {
    return this.attributeService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an attribute' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.attributeService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an attribute (name/unit/filterable)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttributeDto,
  ) {
    return this.attributeService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an attribute (blocked if assigned)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.attributeService.remove(id);
    return { deleted: true };
  }

  @Get(':id/options')
  @ApiOperation({ summary: 'List attribute options' })
  listOptions(@Param('id', ParseUUIDPipe) id: string) {
    return this.attributeService.listOptions(id);
  }

  @Post(':id/options')
  @ApiOperation({ summary: 'Add an option to an attribute' })
  addOption(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAttributeOptionDto,
  ) {
    return this.attributeService.addOption(id, dto);
  }
}
