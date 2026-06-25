import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Brand } from '../entities/brand.entity';

@Injectable()
export class BrandRepository extends BaseRepository<Brand> {
  constructor(
    @InjectRepository(Brand)
    repo: Repository<Brand>,
  ) {
    super(repo);
  }

  findBySlug(slug: string): Promise<Brand | null> {
    return this.findOne({ where: { slug } });
  }

  slugExists(slug: string): Promise<boolean> {
    return this.exists({ slug });
  }

  findAllOrdered(): Promise<Brand[]> {
    return this.findMany({ order: { name: 'ASC' } });
  }
}
