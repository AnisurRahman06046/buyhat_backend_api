import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { ProductSales } from '../entities/product-sales.entity';

@Injectable()
export class ProductSalesRepository extends BaseRepository<ProductSales> {
  constructor(
    @InjectRepository(ProductSales)
    repo: Repository<ProductSales>,
  ) {
    super(repo);
  }

  /** Best (`DESC`) / worst (`ASC`) sellers by cumulative units sold. */
  topSellers(
    direction: 'ASC' | 'DESC',
    limit: number,
  ): Promise<ProductSales[]> {
    return this.findMany({
      order: { qtySold: direction, revenue: direction },
      take: limit,
    });
  }
}
