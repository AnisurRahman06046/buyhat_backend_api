import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CustomerReportQueryDto } from '../dto/customer-report-query.dto';
import { InventoryReportQueryDto } from '../dto/inventory-report-query.dto';
import { ProductReportQueryDto } from '../dto/product-report-query.dto';
import { SalesReportQueryDto } from '../dto/sales-report-query.dto';
import { REPORTS_VIEW_ROLES } from '../reporting.constants';
import { ReportingService } from '../services/reporting.service';

@ApiTags('reports')
@ApiBearerAuth()
@Roles(...REPORTS_VIEW_ROLES)
@Controller('reports')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('sales')
  @ApiOperation({ summary: 'Sales over time (day/week/month/year)' })
  sales(@Query() query: SalesReportQueryDto) {
    return this.reportingService.getSalesReport(query);
  }

  @Get('products')
  @ApiOperation({ summary: 'Best / worst sellers by units sold' })
  products(@Query() query: ProductReportQueryDto) {
    return this.reportingService.getProductReport(query);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Total / new / repeat customers' })
  customers(@Query() query: CustomerReportQueryDto) {
    return this.reportingService.getCustomerReport(query);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'Low / out-of-stock inventory health' })
  inventory(@Query() query: InventoryReportQueryDto) {
    return this.reportingService.getInventoryReport(query.limit);
  }

  @Get('stock-levels')
  @ApiOperation({ summary: 'All stock levels (paginated, name-enriched)' })
  stockLevels(@Query() query: PaginationQueryDto) {
    return this.reportingService.getStockLevels(query);
  }
}
