import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { LandingPage } from '../entities/landing-page.entity';

@Injectable()
export class LandingPageRepository extends BaseRepository<LandingPage> {
  constructor(
    @InjectRepository(LandingPage)
    repo: Repository<LandingPage>,
  ) {
    super(repo);
  }

  slugExists(slug: string): Promise<boolean> {
    return this.exists({ slug });
  }

  findAllOrdered(): Promise<LandingPage[]> {
    return this.findMany({ order: { createdAt: 'DESC' } });
  }

  /** Public read: only a published page resolves. */
  findPublishedBySlug(slug: string): Promise<LandingPage | null> {
    return this.findOne({ where: { slug, isPublished: true } });
  }
}
