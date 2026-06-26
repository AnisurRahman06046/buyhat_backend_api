import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePopupDto } from '../dto/create-popup.dto';
import { PopupResponseDto } from '../dto/popup-response.dto';
import { UpdatePopupDto } from '../dto/update-popup.dto';
import { CmsPopup } from '../entities/cms-popup.entity';
import { AudienceTarget } from '../enums/audience-target.enum';
import { PopupFrequency } from '../enums/popup-frequency.enum';
import { PopupTrigger } from '../enums/popup-trigger.enum';
import { CmsPopupRepository } from '../repositories/cms-popup.repository';

@Injectable()
export class PopupService {
  constructor(private readonly repository: CmsPopupRepository) {}

  async create(dto: CreatePopupDto): Promise<PopupResponseDto> {
    const popup = await this.repository.save(
      this.repository.create({
        title: dto.title,
        content: dto.content ?? null,
        imageUrl: dto.imageUrl ?? null,
        ctaText: dto.ctaText ?? null,
        ctaUrl: dto.ctaUrl ?? null,
        trigger: dto.trigger ?? PopupTrigger.ON_LOAD,
        delaySeconds: dto.delaySeconds ?? 0,
        frequency: dto.frequency ?? PopupFrequency.ONCE,
        audience: dto.audience ?? AudienceTarget.EVERYONE,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        isActive: dto.isActive ?? true,
      }),
    );
    return PopupResponseDto.fromEntity(popup);
  }

  async list(): Promise<PopupResponseDto[]> {
    const popups = await this.repository.findAllOrdered();
    return popups.map((p) => PopupResponseDto.fromEntity(p));
  }

  async get(id: string): Promise<PopupResponseDto> {
    return PopupResponseDto.fromEntity(await this.getOrThrow(id));
  }

  async update(id: string, dto: UpdatePopupDto): Promise<PopupResponseDto> {
    const popup = await this.getOrThrow(id);
    if (dto.title !== undefined) popup.title = dto.title;
    if (dto.content !== undefined) popup.content = dto.content ?? null;
    if (dto.imageUrl !== undefined) popup.imageUrl = dto.imageUrl ?? null;
    if (dto.ctaText !== undefined) popup.ctaText = dto.ctaText ?? null;
    if (dto.ctaUrl !== undefined) popup.ctaUrl = dto.ctaUrl ?? null;
    if (dto.trigger !== undefined) popup.trigger = dto.trigger;
    if (dto.delaySeconds !== undefined) popup.delaySeconds = dto.delaySeconds;
    if (dto.frequency !== undefined) popup.frequency = dto.frequency;
    if (dto.audience !== undefined) popup.audience = dto.audience;
    if (dto.startsAt !== undefined)
      popup.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined)
      popup.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.isActive !== undefined) popup.isActive = dto.isActive;
    return PopupResponseDto.fromEntity(await this.repository.save(popup));
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.repository.softDelete(id);
  }

  /**
   * Public: active popups for the caller's auth state (D50). Anonymous callers
   * see GUESTS + EVERYONE; authenticated callers see LOGGED_IN + EVERYONE.
   */
  async activeForAudience(
    isAuthenticated: boolean,
  ): Promise<PopupResponseDto[]> {
    const audiences = [
      AudienceTarget.EVERYONE,
      isAuthenticated ? AudienceTarget.LOGGED_IN : AudienceTarget.GUESTS,
    ];
    const popups = await this.repository.findActiveForAudiences(
      audiences,
      new Date(),
    );
    return popups.map((p) => PopupResponseDto.fromEntity(p));
  }

  private async getOrThrow(id: string): Promise<CmsPopup> {
    const popup = await this.repository.findById(id);
    if (!popup) throw new NotFoundException(`Popup ${id} not found`);
    return popup;
  }
}
