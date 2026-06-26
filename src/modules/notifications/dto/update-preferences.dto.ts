import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/** Update the authenticated user's marketing opt-out flags (any subset). */
export class UpdatePreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingEmail?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingSms?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingPush?: boolean;
}
