import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InventoryService, StockReportDto } from '../../inventory';
import { CustomerReportDto } from '../dto/customer-report-response.dto';
import { CustomerReportQueryDto } from '../dto/customer-report-query.dto';
import { ProductReportQueryDto } from '../dto/product-report-query.dto';
import { ProductSalesDto } from '../dto/product-report-response.dto';
import { SalesReportQueryDto } from '../dto/sales-report-query.dto';
import {
  SalesPeriodDto,
  SalesReportDto,
} from '../dto/sales-report-response.dto';
import { OrderFact } from '../entities/order-fact.entity';
import { ProductSalesOrder } from '../enums/product-sales-order.enum';
import { DEFAULT_BEST_SELLERS_LIMIT } from '../reporting.constants';
import { CustomerFactRepository } from '../repositories/customer-fact.repository';
import { OrderFactRepository } from '../repositories/order-fact.repository';
import { ProductSalesRepository } from '../repositories/product-sales.repository';

/** A committed order's line, denormalized into the product sales fact. */
export interface OrderLineFact {
  productId: string;
  quantity: number;
  lineTotal: number;
}

/** Snapshot the orders module passes when an order first commits (D69/D70). */
export interface OrderCommittedInput {
  orderId: string;
  userId: string | null;
  status: string;
  paymentStatus: string;
  currency: string;
  subtotal: number;
  discountAmount: number;
  grandAmount: number;
  placedAt: Date | null;
  lines: OrderLineFact[];
}

const T_PRODUCT_SALES = '"reporting"."product_sales"';
const T_CUSTOMER_FACT = '"reporting"."customer_fact"';
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Maintains the denormalized reporting read model and answers report queries.
 * Owning modules call the `record*` seams (one-way, best-effort); reporting
 * never reads their tables (D66). Current-state inventory health is forwarded to
 * the inventory module.
 */
@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(
    private readonly orderFactRepository: OrderFactRepository,
    private readonly productSalesRepository: ProductSalesRepository,
    private readonly customerFactRepository: CustomerFactRepository,
    private readonly inventoryService: InventoryService,
    private readonly dataSource: DataSource,
  ) {}

  // --- record seams (called one-way by orders / auth) ------------------------

  /**
   * Record a newly-committed order. Idempotent: the first commit inserts the
   * fact and increments product/customer aggregates; later calls only refresh
   * the fact's status (units never double-counted, D69). Best-effort.
   */
  async recordOrderCommitted(input: OrderCommittedInput): Promise<void> {
    try {
      await this.dataSource.transaction(async (m) => {
        const existing = await m.findOne(OrderFact, {
          where: { orderId: input.orderId },
        });
        if (existing) {
          existing.status = input.status;
          existing.paymentStatus = input.paymentStatus;
          await m.save(existing);
          return;
        }
        const itemsCount = input.lines.reduce((s, l) => s + l.quantity, 0);
        await m.save(
          m.create(OrderFact, {
            orderId: input.orderId,
            userId: input.userId,
            status: input.status,
            paymentStatus: input.paymentStatus,
            currency: input.currency,
            subtotal: input.subtotal,
            discountAmount: input.discountAmount,
            grandAmount: input.grandAmount,
            refundedAmount: 0,
            isRefunded: false,
            itemsCount,
            placedAt: input.placedAt,
            committedAt: new Date(),
          }),
        );

        for (const [productId, agg] of this.aggregateLines(input.lines)) {
          await m.query(
            `INSERT INTO ${T_PRODUCT_SALES}
               (product_id, qty_sold, order_count, revenue, last_sold_at)
             VALUES ($1, $2, 1, $3, now())
             ON CONFLICT (product_id) DO UPDATE SET
               qty_sold = "product_sales".qty_sold + EXCLUDED.qty_sold,
               order_count = "product_sales".order_count + 1,
               revenue = "product_sales".revenue + EXCLUDED.revenue,
               last_sold_at = now(),
               updated_at = now()`,
            [productId, agg.qty, agg.revenue],
          );
        }

        if (input.userId) {
          await m.query(
            `INSERT INTO ${T_CUSTOMER_FACT}
               (user_id, registered_at, first_order_at, orders_count, total_spent, last_order_at)
             VALUES ($1, now(), now(), 1, $2, now())
             ON CONFLICT (user_id) DO UPDATE SET
               orders_count = "customer_fact".orders_count + 1,
               total_spent = "customer_fact".total_spent + EXCLUDED.total_spent,
               first_order_at = COALESCE("customer_fact".first_order_at, now()),
               last_order_at = now(),
               updated_at = now()`,
            [input.userId, input.grandAmount],
          );
        }
      });
    } catch (err) {
      this.logger.error(
        `recordOrderCommitted(${input.orderId}) failed: ${String(err)}`,
      );
    }
  }

  /** Flag a committed order as (partially) refunded for net-revenue (D71). */
  async recordOrderRefunded(
    orderId: string,
    refundedAmount: number,
  ): Promise<void> {
    try {
      const fact = await this.orderFactRepository.findByOrderId(orderId);
      if (!fact) return;
      fact.refundedAmount = refundedAmount;
      fact.isRefunded = refundedAmount >= fact.grandAmount;
      await this.orderFactRepository.save(fact);
    } catch (err) {
      this.logger.error(
        `recordOrderRefunded(${orderId}) failed: ${String(err)}`,
      );
    }
  }

  /** Seed a customer fact on registration (idempotent). Best-effort. */
  async recordCustomerRegistered(
    userId: string,
    registeredAt: Date,
  ): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO ${T_CUSTOMER_FACT}
           (user_id, registered_at, orders_count, total_spent)
         VALUES ($1, $2, 0, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, registeredAt],
      );
    } catch (err) {
      this.logger.error(
        `recordCustomerRegistered(${userId}) failed: ${String(err)}`,
      );
    }
  }

  // --- report queries (ADMIN) ------------------------------------------------

  async getSalesReport(query: SalesReportQueryDto): Promise<SalesReportDto> {
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - YEAR_MS);
    const rows = await this.orderFactRepository.salesByPeriod(
      from,
      to,
      query.granularity,
    );
    const periods: SalesPeriodDto[] = rows.map((r) => ({
      period: r.period,
      orders: r.orders,
      grossRevenue: round2(r.gross),
      discountTotal: round2(r.discount),
      refundedTotal: round2(r.refunded),
      netRevenue: round2(r.gross - r.refunded),
      itemsSold: r.items,
    }));
    return {
      from,
      to,
      granularity: query.granularity,
      periods,
      totalOrders: periods.reduce((s, p) => s + p.orders, 0),
      totalGrossRevenue: round2(
        periods.reduce((s, p) => s + p.grossRevenue, 0),
      ),
      totalNetRevenue: round2(periods.reduce((s, p) => s + p.netRevenue, 0)),
      totalItemsSold: periods.reduce((s, p) => s + p.itemsSold, 0),
    };
  }

  async getProductReport(
    query: ProductReportQueryDto,
  ): Promise<ProductSalesDto[]> {
    const direction = query.order === ProductSalesOrder.WORST ? 'ASC' : 'DESC';
    const rows = await this.productSalesRepository.topSellers(
      direction,
      query.limit,
    );
    return rows.map((r) => ProductSalesDto.fromEntity(r));
  }

  async getCustomerReport(
    query: CustomerReportQueryDto,
  ): Promise<CustomerReportDto> {
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - YEAR_MS);
    const { total, newCustomers, repeat } =
      await this.customerFactRepository.counts(from, to);
    return {
      from,
      to,
      totalCustomers: total,
      newCustomers,
      repeatCustomers: repeat,
    };
  }

  getInventoryReport(limit: number): Promise<StockReportDto> {
    return this.inventoryService.getStockReport(limit);
  }

  /** Product ids ordered by units sold, for CMS auto best-sellers (D67). */
  async getBestSellers(
    limit: number = DEFAULT_BEST_SELLERS_LIMIT,
  ): Promise<string[]> {
    const rows = await this.productSalesRepository.topSellers('DESC', limit);
    return rows.map((r) => r.productId);
  }

  // --- helpers ---------------------------------------------------------------

  private aggregateLines(
    lines: OrderLineFact[],
  ): Map<string, { qty: number; revenue: number }> {
    const byProduct = new Map<string, { qty: number; revenue: number }>();
    for (const l of lines) {
      const agg = byProduct.get(l.productId) ?? { qty: 0, revenue: 0 };
      agg.qty += l.quantity;
      agg.revenue += l.lineTotal;
      byProduct.set(l.productId, agg);
    }
    return byProduct;
  }
}
