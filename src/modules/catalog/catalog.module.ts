import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QUEUE_NAMES } from '../../shared/queue/queue.constants';
import { AttributeController } from './controllers/attribute.controller';
import { BrandController } from './controllers/brand.controller';
import { CategoryController } from './controllers/category.controller';
import { MediaController } from './controllers/media.controller';
import { ProductController } from './controllers/product.controller';
import { VariantController } from './controllers/variant.controller';
import { Attribute } from './entities/attribute.entity';
import { AttributeOption } from './entities/attribute-option.entity';
import { Brand } from './entities/brand.entity';
import { Category } from './entities/category.entity';
import { CategoryAttribute } from './entities/category-attribute.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { Product } from './entities/product.entity';
import { ProductAttributeValue } from './entities/product-attribute-value.entity';
import { ProductMedia } from './entities/product-media.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { VariantAttributeValue } from './entities/variant-attribute-value.entity';
import { AttributeOptionRepository } from './repositories/attribute-option.repository';
import { AttributeRepository } from './repositories/attribute.repository';
import { BrandRepository } from './repositories/brand.repository';
import { CategoryAttributeRepository } from './repositories/category-attribute.repository';
import { CategoryRepository } from './repositories/category.repository';
import { ProductMediaRepository } from './repositories/product-media.repository';
import { ProductRepository } from './repositories/product.repository';
import { ProductVariantRepository } from './repositories/product-variant.repository';
import { AttributeResolverService } from './services/attribute-resolver.service';
import { AttributeService } from './services/attribute.service';
import { BrandService } from './services/brand.service';
import { CategoryService } from './services/category.service';
import { MediaService } from './services/media.service';
import { CatalogOutboxRelayService } from './services/outbox-relay.service';
import { OutboxService } from './services/outbox.service';
import { ProductService } from './services/product.service';
import { VariantService } from './services/variant.service';

/**
 * `catalog` feature module — categories, attributes (dynamic), brands, products,
 * and auto-generated variants. The dynamic-attribute model means new product
 * "types" are created from the admin panel with no code changes.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Attribute,
      AttributeOption,
      Brand,
      Category,
      CategoryAttribute,
      Product,
      ProductAttributeValue,
      ProductVariant,
      VariantAttributeValue,
      ProductMedia,
      OutboxEvent,
    ]),
    BullModule.registerQueue({ name: QUEUE_NAMES.CATALOG_EVENTS }),
  ],
  controllers: [
    CategoryController,
    AttributeController,
    BrandController,
    ProductController,
    VariantController,
    MediaController,
  ],
  providers: [
    CategoryRepository,
    CategoryAttributeRepository,
    AttributeRepository,
    AttributeOptionRepository,
    BrandRepository,
    ProductRepository,
    ProductVariantRepository,
    ProductMediaRepository,
    AttributeResolverService,
    CategoryService,
    AttributeService,
    BrandService,
    ProductService,
    VariantService,
    MediaService,
    OutboxService,
    CatalogOutboxRelayService,
  ],
  exports: [ProductService, VariantService, CategoryService, BrandService],
})
export class CatalogModule {}
