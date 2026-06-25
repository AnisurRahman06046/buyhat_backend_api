/**
 * Public API of the `catalog` module. Later modules (cart, orders, inventory)
 * read product/variant data via these services — never the entities.
 */
export { CatalogModule } from './catalog.module';
export { ProductService } from './services/product.service';
export { VariantService } from './services/variant.service';
