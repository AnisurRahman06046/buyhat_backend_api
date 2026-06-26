import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { CmsPopup } from '../entities/cms-popup.entity';
import { AudienceTarget } from '../enums/audience-target.enum';

@Injectable()
export class CmsPopupRepository extends BaseRepository<CmsPopup> {
  constructor(
    @InjectRepository(CmsPopup)
    repo: Repository<CmsPopup>,
  ) {
    super(repo);
  }

  findAllOrdered(): Promise<CmsPopup[]> {
    return this.findMany({ order: { createdAt: 'DESC' } });
  }

  /**
   * Active popups targeting any of `audiences` whose schedule window currently
   * includes `now` (D49/D50).
   */
  findActiveForAudiences(
    audiences: AudienceTarget[],
    now: Date,
  ): Promise<CmsPopup[]> {
    return this.repository
      .createQueryBuilder('p')
      .where('p.is_active = true')
      .andWhere('p.deleted_at IS NULL')
      .andWhere('p.audience IN (:...audiences)', { audiences })
      .andWhere('(p.starts_at IS NULL OR p.starts_at <= :now)', { now })
      .andWhere('(p.ends_at IS NULL OR p.ends_at > :now)', { now })
      .orderBy('p.created_at', 'DESC')
      .getMany();
  }
}
