import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { CmsBanner } from '../entities/cms-banner.entity';
import { BannerPlacement } from '../enums/banner-placement.enum';

@Injectable()
export class CmsBannerRepository extends BaseRepository<CmsBanner> {
  constructor(
    @InjectRepository(CmsBanner)
    repo: Repository<CmsBanner>,
  ) {
    super(repo);
  }

  findAllOrdered(): Promise<CmsBanner[]> {
    return this.findMany({
      order: { placement: 'ASC', position: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Active banners for a placement whose schedule window currently includes
   * `now` (null bound = open), in render order (D49).
   */
  findActiveByPlacement(
    placement: BannerPlacement,
    now: Date,
  ): Promise<CmsBanner[]> {
    return this.repository
      .createQueryBuilder('b')
      .where('b.placement = :placement', { placement })
      .andWhere('b.is_active = true')
      .andWhere('b.deleted_at IS NULL')
      .andWhere('(b.starts_at IS NULL OR b.starts_at <= :now)', { now })
      .andWhere('(b.ends_at IS NULL OR b.ends_at > :now)', { now })
      .orderBy('b.position', 'ASC')
      .addOrderBy('b.created_at', 'ASC')
      .getMany();
  }
}
