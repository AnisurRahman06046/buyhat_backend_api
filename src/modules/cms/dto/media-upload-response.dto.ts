import { ApiProperty } from '@nestjs/swagger';

/** Result of a CMS image upload — the URL to drop into a banner/popup/section. */
export class MediaUploadResponseDto {
  @ApiProperty() url: string;
  @ApiProperty() key: string;
}
