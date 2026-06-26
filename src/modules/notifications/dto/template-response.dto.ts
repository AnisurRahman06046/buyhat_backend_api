import { ApiProperty } from '@nestjs/swagger';

/**
 * A resolved template row in the listing: the in-code default overlaid with any
 * DB override. `id` is the stable composite `event::channel` you PATCH; `isOverride`
 * tells whether a DB row currently overrides the default.
 */
export class TemplateResponseDto {
  @ApiProperty({ description: 'Composite id `event::channel`' }) id: string;
  @ApiProperty() event: string;
  @ApiProperty() channel: string;
  @ApiProperty() category: string;
  @ApiProperty({ nullable: true }) subject: string | null;
  @ApiProperty() body: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() isOverride: boolean;
}
