import { ApiProperty } from '@nestjs/swagger';
import { Brand } from '../entities/brand.entity';

export class BrandResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ nullable: true }) logoUrl: string | null;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() isActive: boolean;

  static fromEntity(b: Brand): BrandResponseDto {
    const dto = new BrandResponseDto();
    dto.id = b.id;
    dto.name = b.name;
    dto.slug = b.slug;
    dto.logoUrl = b.logoUrl;
    dto.description = b.description;
    dto.isActive = b.isActive;
    return dto;
  }
}
