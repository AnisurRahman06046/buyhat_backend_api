import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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

  findActiveOrdered(): Promise<Brand[]> {
    return this.findMany({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  findByIds(ids: string[]): Promise<Brand[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.findMany({ where: { id: In(ids) } });
  }
}
