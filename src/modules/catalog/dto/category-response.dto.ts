import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Category } from '../entities/category.entity';

export class CategoryResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() slug: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) imageUrl: string | null;
  @ApiProperty({ nullable: true }) parentId: string | null;
  @ApiProperty() position: number;
  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional({ type: [CategoryResponseDto] })
  children?: CategoryResponseDto[];

  static fromEntity(
    c: Category,
    children?: CategoryResponseDto[],
  ): CategoryResponseDto {
    const dto = new CategoryResponseDto();
    dto.id = c.id;
    dto.name = c.name;
    dto.slug = c.slug;
    dto.description = c.description;
    dto.imageUrl = c.imageUrl;
    dto.parentId = c.parentId;
    dto.position = c.position;
    dto.isActive = c.isActive;
    if (children) {
      dto.children = children;
    }
    return dto;
  }
}
