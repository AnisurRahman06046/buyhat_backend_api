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
import { AssignAttributeDto } from '../dto/assign-attribute.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryService } from '../services/category.service';

@ApiTags('catalog/categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Category tree' })
  tree() {
    return this.categoryService.tree();
  }

  @Public()
  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get a category by id or slug' })
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.categoryService.findOne(idOrSlug);
  }

  @Public()
  @Get(':idOrSlug/attributes')
  @ApiOperation({ summary: 'Resolved (inherited) attributes for a category' })
  attributes(@Param('idOrSlug') idOrSlug: string) {
    return this.categoryService.resolvedAttributes(idOrSlug);
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a category' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update a category' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, dto);
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a category (blocked if non-empty)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.categoryService.remove(id);
    return { deleted: true };
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Post(':id/attributes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign an attribute to a category' })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignAttributeDto,
  ) {
    await this.categoryService.assignAttribute(id, dto);
    return { assigned: true };
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Delete(':id/attributes/:attributeId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unassign an attribute from a category' })
  async unassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attributeId', ParseUUIDPipe) attributeId: string,
  ) {
    await this.categoryService.unassignAttribute(id, attributeId);
    return { unassigned: true };
  }
}
