import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CmsPopup } from '../entities/cms-popup.entity';
import { AudienceTarget } from '../enums/audience-target.enum';
import { PopupFrequency } from '../enums/popup-frequency.enum';
import { PopupTrigger } from '../enums/popup-trigger.enum';

export class PopupResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) content: string | null;
  @ApiPropertyOptional({ nullable: true }) imageUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) ctaText: string | null;
  @ApiPropertyOptional({ nullable: true }) ctaUrl: string | null;
  @ApiProperty({ enum: PopupTrigger }) trigger: PopupTrigger;
  @ApiProperty() delaySeconds: number;
  @ApiProperty({ enum: PopupFrequency }) frequency: PopupFrequency;
  @ApiProperty({ enum: AudienceTarget }) audience: AudienceTarget;
  @ApiPropertyOptional({ nullable: true }) startsAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) endsAt: Date | null;
  @ApiProperty() isActive: boolean;

  static fromEntity(p: CmsPopup): PopupResponseDto {
    const dto = new PopupResponseDto();
    dto.id = p.id;
    dto.title = p.title;
    dto.content = p.content;
    dto.imageUrl = p.imageUrl;
    dto.ctaText = p.ctaText;
    dto.ctaUrl = p.ctaUrl;
    dto.trigger = p.trigger;
    dto.delaySeconds = p.delaySeconds;
    dto.frequency = p.frequency;
    dto.audience = p.audience;
    dto.startsAt = p.startsAt;
    dto.endsAt = p.endsAt;
    dto.isActive = p.isActive;
    return dto;
  }
}
