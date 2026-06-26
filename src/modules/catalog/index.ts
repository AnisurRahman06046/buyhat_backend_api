/**
 * Public API of the `catalog` module. Later modules (cart, orders, inventory)
 * read product/variant data via these services — never the entities.
 */
export { CatalogModule } from './catalog.module';
export { ProductService } from './services/product.service';
export { VariantService } from './services/variant.service';
export { CategoryService } from './services/category.service';
export { BrandService } from './services/brand.service';
export type { VariantSaleInfo } from './services/variant.service';
export { ProductListItemDto } from './dto/product-response.dto';
export { CategoryResponseDto } from './dto/category-response.dto';
export { BrandResponseDto } from './dto/brand-response.dto';
