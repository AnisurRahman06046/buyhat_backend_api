import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { HomepageSection } from '../entities/homepage-section.entity';

@Injectable()
export class HomepageSectionRepository extends BaseRepository<HomepageSection> {
  constructor(
    @InjectRepository(HomepageSection)
    repo: Repository<HomepageSection>,
  ) {
    super(repo);
  }

  /** All sections (admin), lowest position first. */
  findAllOrdered(): Promise<HomepageSection[]> {
    return this.findMany({ order: { position: 'ASC', createdAt: 'ASC' } });
  }

  /** Active sections in render order (public homepage). */
  findActiveOrdered(): Promise<HomepageSection[]> {
    return this.findMany({
      where: { isActive: true },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
  }
}
