import { Injectable, NotFoundException } from '@nestjs/common';
import { uniqueSlug } from '../../../common/utils/slug.util';
import { CreateLandingPageDto } from '../dto/create-landing-page.dto';
import { LandingPageResponseDto } from '../dto/landing-page-response.dto';
import { UpdateLandingPageDto } from '../dto/update-landing-page.dto';
import { LandingPage } from '../entities/landing-page.entity';
import { LandingPageRepository } from '../repositories/landing-page.repository';

@Injectable()
export class LandingPageService {
  constructor(private readonly repository: LandingPageRepository) {}

  async create(dto: CreateLandingPageDto): Promise<LandingPageResponseDto> {
    const slug = await uniqueSlug(dto.slug ?? dto.title, (s) =>
      this.repository.slugExists(s),
    );
    const page = await this.repository.save(
      this.repository.create({
        slug,
        title: dto.title,
        content: dto.content ?? {},
        seoTitle: dto.seoTitle ?? null,
        seoDescription: dto.seoDescription ?? null,
        isPublished: dto.isPublished ?? false,
      }),
    );
    return LandingPageResponseDto.fromEntity(page);
  }

  /** Admin: all pages (drafts + published). */
  async list(): Promise<LandingPageResponseDto[]> {
    const pages = await this.repository.findAllOrdered();
    return pages.map((p) => LandingPageResponseDto.fromEntity(p));
  }

  async update(
    id: string,
    dto: UpdateLandingPageDto,
  ): Promise<LandingPageResponseDto> {
    const page = await this.getOrThrow(id);
    if (dto.slug !== undefined && dto.slug !== page.slug) {
      page.slug = await uniqueSlug(dto.slug, (s) =>
        this.repository.slugExists(s),
      );
    }
    if (dto.title !== undefined) page.title = dto.title;
    if (dto.content !== undefined) page.content = dto.content;
    if (dto.seoTitle !== undefined) page.seoTitle = dto.seoTitle ?? null;
    if (dto.seoDescription !== undefined)
      page.seoDescription = dto.seoDescription ?? null;
    if (dto.isPublished !== undefined) page.isPublished = dto.isPublished;
    return LandingPageResponseDto.fromEntity(await this.repository.save(page));
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.repository.softDelete(id);
  }

  /** Public: a published page by slug (404 for drafts/missing). */
  async getPublishedBySlug(slug: string): Promise<LandingPageResponseDto> {
    const page = await this.repository.findPublishedBySlug(slug);
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);
    return LandingPageResponseDto.fromEntity(page);
  }

  private async getOrThrow(id: string): Promise<LandingPage> {
    const page = await this.repository.findById(id);
    if (!page) throw new NotFoundException(`Landing page ${id} not found`);
    return page;
  }
}
