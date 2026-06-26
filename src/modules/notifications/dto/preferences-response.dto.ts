import { ApiProperty } from '@nestjs/swagger';

/** The authenticated user's marketing opt-out flags (defaults to all true). */
export class PreferencesResponseDto {
  @ApiProperty() marketingEmail: boolean;
  @ApiProperty() marketingSms: boolean;
  @ApiProperty() marketingPush: boolean;
}
