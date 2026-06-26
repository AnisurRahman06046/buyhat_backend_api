import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryModule } from '../inventory';
import { ReportingController } from './controllers/reporting.controller';
import { CustomerFact } from './entities/customer-fact.entity';
import { OrderFact } from './entities/order-fact.entity';
import { ProductSales } from './entities/product-sales.entity';
import { CustomerFactRepository } from './repositories/customer-fact.repository';
import { OrderFactRepository } from './repositories/order-fact.repository';
import { ProductSalesRepository } from './repositories/product-sales.repository';
import { ReportingService } from './services/reporting.service';

/**
 * `reporting` feature module — denormalized read-model facts (sales, products,
 * customers) fed by one-way `ReportingService` seams (orders/auth call them),
 * plus admin report endpoints. Imports InventoryModule only (forwards the
 * current-state stock report); exports `ReportingService` so orders/auth/cms
 * record + read without a cycle (reporting imports none of them).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([OrderFact, ProductSales, CustomerFact]),
    InventoryModule,
  ],
  controllers: [ReportingController],
  providers: [
    OrderFactRepository,
    ProductSalesRepository,
    CustomerFactRepository,
    ReportingService,
  ],
  exports: [ReportingService],
})
export class ReportingModule {}
