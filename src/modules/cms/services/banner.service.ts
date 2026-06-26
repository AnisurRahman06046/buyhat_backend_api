import { Injectable, NotFoundException } from '@nestjs/common';
import { BannerResponseDto } from '../dto/banner-response.dto';
import { CreateBannerDto } from '../dto/create-banner.dto';
import { UpdateBannerDto } from '../dto/update-banner.dto';
import { CmsBanner } from '../entities/cms-banner.entity';
import { BannerPlacement } from '../enums/banner-placement.enum';
import { CmsBannerRepository } from '../repositories/cms-banner.repository';

@Injectable()
export class BannerService {
  constructor(private readonly repository: CmsBannerRepository) {}

  async create(dto: CreateBannerDto): Promise<BannerResponseDto> {
    const banner = await this.repository.save(
      this.repository.create({
        title: dto.title ?? null,
        imageUrl: dto.imageUrl,
        mobileImageUrl: dto.mobileImageUrl ?? null,
        ctaText: dto.ctaText ?? null,
        ctaUrl: dto.ctaUrl ?? null,
        placement: dto.placement,
        position: dto.position ?? 0,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        isActive: dto.isActive ?? true,
      }),
    );
    return BannerResponseDto.fromEntity(banner);
  }

  async list(): Promise<BannerResponseDto[]> {
    const banners = await this.repository.findAllOrdered();
    return banners.map((b) => BannerResponseDto.fromEntity(b));
  }

  async get(id: string): Promise<BannerResponseDto> {
    return BannerResponseDto.fromEntity(await this.getOrThrow(id));
  }

  async update(id: string, dto: UpdateBannerDto): Promise<BannerResponseDto> {
    const banner = await this.getOrThrow(id);
    if (dto.title !== undefined) banner.title = dto.title ?? null;
    if (dto.imageUrl !== undefined) banner.imageUrl = dto.imageUrl;
    if (dto.mobileImageUrl !== undefined)
      banner.mobileImageUrl = dto.mobileImageUrl ?? null;
    if (dto.ctaText !== undefined) banner.ctaText = dto.ctaText ?? null;
    if (dto.ctaUrl !== undefined) banner.ctaUrl = dto.ctaUrl ?? null;
    if (dto.placement !== undefined) banner.placement = dto.placement;
    if (dto.position !== undefined) banner.position = dto.position;
    if (dto.startsAt !== undefined)
      banner.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined)
      banner.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.isActive !== undefined) banner.isActive = dto.isActive;
    return BannerResponseDto.fromEntity(await this.repository.save(banner));
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.repository.softDelete(id);
  }

  /** Public: active banners for a placement whose window includes now (D49). */
  async activeByPlacement(
    placement: BannerPlacement,
  ): Promise<BannerResponseDto[]> {
    const banners = await this.repository.findActiveByPlacement(
      placement,
      new Date(),
    );
    return banners.map((b) => BannerResponseDto.fromEntity(b));
  }

  private async getOrThrow(id: string): Promise<CmsBanner> {
    const banner = await this.repository.findById(id);
    if (!banner) throw new NotFoundException(`Banner ${id} not found`);
    return banner;
  }
}
