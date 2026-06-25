import { ApiProperty } from '@nestjs/swagger';
import { ProductMedia } from '../entities/product-media.entity';
import { MediaType } from '../enums/media-type.enum';

export class MediaResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() productId: string;
  @ApiProperty({ nullable: true }) variantId: string | null;
  @ApiProperty({ enum: MediaType }) type: MediaType;
  @ApiProperty() url: string;
  @ApiProperty({ nullable: true }) alt: string | null;
  @ApiProperty() isPrimary: boolean;
  @ApiProperty() position: number;

  static fromEntity(m: ProductMedia): MediaResponseDto {
    const dto = new MediaResponseDto();
    dto.id = m.id;
    dto.productId = m.productId;
    dto.variantId = m.variantId;
    dto.type = m.type;
    dto.url = m.url ?? '';
    dto.alt = m.alt;
    dto.isPrimary = m.isPrimary;
    dto.position = m.position;
    return dto;
  }
}
