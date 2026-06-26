import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LandingPage } from '../entities/landing-page.entity';

export class LandingPageResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() slug: string;
  @ApiProperty() title: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  content: Record<string, unknown>;
  @ApiPropertyOptional({ nullable: true }) seoTitle: string | null;
  @ApiPropertyOptional({ nullable: true }) seoDescription: string | null;
  @ApiProperty() isPublished: boolean;

  static fromEntity(p: LandingPage): LandingPageResponseDto {
    const dto = new LandingPageResponseDto();
    dto.id = p.id;
    dto.slug = p.slug;
    dto.title = p.title;
    dto.content = p.content;
    dto.seoTitle = p.seoTitle;
    dto.seoDescription = p.seoDescription;
    dto.isPublished = p.isPublished;
    return dto;
  }
}
