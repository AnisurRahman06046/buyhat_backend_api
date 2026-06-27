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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CATALOG_WRITE_ROLES } from '../catalog.constants';
import { CreateProductDto } from '../dto/create-product.dto';
import { GenerateVariantsDto } from '../dto/generate-variants.dto';
import { ProductListQueryDto } from '../dto/product-list-query.dto';
import { ProductSearchQueryDto } from '../dto/product-search-query.dto';
import { SetAttributeValuesDto } from '../dto/set-attribute-values.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductService } from '../services/product.service';
import { VariantService } from '../services/variant.service';

@ApiTags('catalog/products')
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly variantService: VariantService,
  ) {}

  // --- public ---
  @Public()
  @Get()
  @ApiOperation({ summary: 'List products (ACTIVE only)' })
  list(@Query() query: ProductListQueryDto) {
    return this.productService.list(query);
  }

  @Public()
  @Get('search')
  @ApiOperation({
    summary: 'Faceted product search (full-text, filters, facets, keyset)',
  })
  search(@Query() query: ProductSearchQueryDto) {
    return this.productService.search(query);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get an active product by slug' })
  publicDetail(@Param('slug') slug: string) {
    return this.productService.publicDetail(slug);
  }

  // --- admin ---
  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a product (DRAFT)' })
  create(@CurrentUser('id') actorId: string, @Body() dto: CreateProductDto) {
    return this.productService.create(dto, actorId);
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Get(':id/detail')
  @ApiOperation({ summary: 'Get a product (any status, admin)' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.productService.detail(id);
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update a product' })
  update(
    @CurrentUser('id') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(id, dto, actorId);
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a product' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.productService.remove(id);
    return { deleted: true };
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a product (validates preconditions)' })
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.productService.publish(id);
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish (archive) a product' })
  unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.productService.unpublish(id);
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Post(':id/attribute-values')
  @ApiOperation({ summary: 'Set non-variant attribute values' })
  setAttributeValues(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAttributeValuesDto,
  ) {
    return this.productService.setAttributeValues(id, dto);
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Post(':id/variants')
  @ApiOperation({
    summary: 'Generate variants from attribute-option combinations',
  })
  generateVariants(
    @CurrentUser('id') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateVariantsDto,
  ) {
    return this.variantService.generate(id, dto, actorId);
  }

  @Roles(...CATALOG_WRITE_ROLES)
  @ApiBearerAuth()
  @Get(':id/variants')
  @ApiOperation({ summary: 'List a product variants' })
  listVariants(@Param('id', ParseUUIDPipe) id: string) {
    return this.variantService.listForProduct(id);
  }
}
