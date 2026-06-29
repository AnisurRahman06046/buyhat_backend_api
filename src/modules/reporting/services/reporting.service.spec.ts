import { DataSource } from 'typeorm';
import { ProductService, VariantService } from '../../catalog';
import { InventoryService } from '../../inventory';
import { OrderFact } from '../entities/order-fact.entity';
import { ProductSales } from '../entities/product-sales.entity';
import { ProductSalesOrder } from '../enums/product-sales-order.enum';
import { SalesGranularity } from '../enums/sales-granularity.enum';
import { CustomerFactRepository } from '../repositories/customer-fact.repository';
import { OrderFactRepository } from '../repositories/order-fact.repository';
import { ProductSalesRepository } from '../repositories/product-sales.repository';
import { ReportingService } from './reporting.service';

const makeProductSales = (
  overrides: Partial<ProductSales> = {},
): ProductSales =>
  ({
    id: 'ps-1',
    productId: 'prod-1',
    qtySold: 10,
    orderCount: 4,
    revenue: 1000,
    lastSoldAt: new Date(),
    ...overrides,
  }) as ProductSales;

describe('ReportingService', () => {
  let orderFactRepository: jest.Mocked<OrderFactRepository>;
  let productSalesRepository: jest.Mocked<ProductSalesRepository>;
  let customerFactRepository: jest.Mocked<CustomerFactRepository>;
  let inventoryService: jest.Mocked<InventoryService>;
  let productService: jest.Mocked<ProductService>;
  let variantService: jest.Mocked<VariantService>;
  let dataSource: jest.Mocked<DataSource>;
  let service: ReportingService;

  beforeEach(() => {
    orderFactRepository = {
      findByOrderId: jest.fn(),
      save: jest.fn((x: OrderFact) => Promise.resolve(x)),
      salesByPeriod: jest.fn(),
    } as unknown as jest.Mocked<OrderFactRepository>;
    productSalesRepository = {
      topSellers: jest.fn(),
    } as unknown as jest.Mocked<ProductSalesRepository>;
    customerFactRepository = {
      counts: jest.fn(),
    } as unknown as jest.Mocked<CustomerFactRepository>;
    inventoryService = {
      getStockReport: jest.fn(),
    } as unknown as jest.Mocked<InventoryService>;
    productService = {
      productSummariesByIds: jest.fn().mockResolvedValue(new Map()),
    } as unknown as jest.Mocked<ProductService>;
    variantService = {
      labelsByIds: jest.fn().mockResolvedValue(new Map()),
    } as unknown as jest.Mocked<VariantService>;
    dataSource = {} as unknown as jest.Mocked<DataSource>;
    service = new ReportingService(
      orderFactRepository,
      productSalesRepository,
      customerFactRepository,
      inventoryService,
      productService,
      variantService,
      dataSource,
    );
  });

  describe('getSalesReport', () => {
    it('computes net revenue and window totals from the buckets', async () => {
      orderFactRepository.salesByPeriod.mockResolvedValue([
        {
          period: new Date('2026-06-01'),
          orders: 2,
          gross: 300,
          discount: 20,
          refunded: 50,
          items: 5,
        },
        {
          period: new Date('2026-06-02'),
          orders: 1,
          gross: 100,
          discount: 0,
          refunded: 0,
          items: 2,
        },
      ]);

      const report = await service.getSalesReport({
        granularity: SalesGranularity.DAY,
      });

      expect(report.periods[0].netRevenue).toBe(250); // 300 - 50
      expect(report.periods[1].netRevenue).toBe(100);
      expect(report.totalOrders).toBe(3);
      expect(report.totalGrossRevenue).toBe(400);
      expect(report.totalNetRevenue).toBe(350);
      expect(report.totalItemsSold).toBe(7);
    });

    it('defaults the window to roughly the last year', async () => {
      orderFactRepository.salesByPeriod.mockResolvedValue([]);
      await service.getSalesReport({ granularity: SalesGranularity.MONTH });
      const [from, to] = orderFactRepository.salesByPeriod.mock.calls[0];
      expect(to.getTime() - from.getTime()).toBeGreaterThan(360 * 864e5);
    });
  });

  describe('getProductReport', () => {
    it('orders best sellers DESC', async () => {
      productSalesRepository.topSellers.mockResolvedValue([makeProductSales()]);
      const rows = await service.getProductReport({
        order: ProductSalesOrder.BEST,
        limit: 5,
      });
      expect(productSalesRepository.topSellers).toHaveBeenCalledWith('DESC', 5);
      expect(rows[0].productId).toBe('prod-1');
      expect(rows[0].qtySold).toBe(10);
    });

    it('orders worst sellers ASC', async () => {
      productSalesRepository.topSellers.mockResolvedValue([]);
      await service.getProductReport({
        order: ProductSalesOrder.WORST,
        limit: 3,
      });
      expect(productSalesRepository.topSellers).toHaveBeenCalledWith('ASC', 3);
    });
  });

  describe('getCustomerReport', () => {
    it('returns total/new/repeat counts', async () => {
      customerFactRepository.counts.mockResolvedValue({
        total: 10,
        newCustomers: 3,
        repeat: 4,
      });
      const report = await service.getCustomerReport({});
      expect(report.totalCustomers).toBe(10);
      expect(report.newCustomers).toBe(3);
      expect(report.repeatCustomers).toBe(4);
    });
  });

  describe('getBestSellers', () => {
    it('returns ordered product ids for CMS', async () => {
      productSalesRepository.topSellers.mockResolvedValue([
        makeProductSales({ productId: 'a' }),
        makeProductSales({ productId: 'b' }),
      ]);
      const ids = await service.getBestSellers(2);
      expect(productSalesRepository.topSellers).toHaveBeenCalledWith('DESC', 2);
      expect(ids).toEqual(['a', 'b']);
    });
  });

  describe('getInventoryReport', () => {
    it('forwards to the inventory service', async () => {
      const stock = {
        outOfStockCount: 1,
        lowStockCount: 2,
        outOfStock: [],
        lowStock: [],
      };
      inventoryService.getStockReport.mockResolvedValue(stock);
      const result = await service.getInventoryReport(50);
      expect(inventoryService.getStockReport).toHaveBeenCalledWith(50);
      expect(result).toBe(stock);
    });
  });

  describe('recordOrderRefunded', () => {
    it('flags a full refund as refunded', async () => {
      orderFactRepository.findByOrderId.mockResolvedValue({
        grandAmount: 100,
      } as OrderFact);
      await service.recordOrderRefunded('o-1', 100);
      const saved = orderFactRepository.save.mock.calls[0][0] as OrderFact;
      expect(saved.refundedAmount).toBe(100);
      expect(saved.isRefunded).toBe(true);
    });

    it('keeps a partial refund un-flagged', async () => {
      orderFactRepository.findByOrderId.mockResolvedValue({
        grandAmount: 100,
      } as OrderFact);
      await service.recordOrderRefunded('o-1', 40);
      const saved = orderFactRepository.save.mock.calls[0][0] as OrderFact;
      expect(saved.refundedAmount).toBe(40);
      expect(saved.isRefunded).toBe(false);
    });

    it('is a no-op when the order fact is missing', async () => {
      orderFactRepository.findByOrderId.mockResolvedValue(null);
      await service.recordOrderRefunded('missing', 10);
      expect(orderFactRepository.save).not.toHaveBeenCalled();
    });
  });
});
