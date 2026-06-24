import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class SetDefaultAddressDto {
  @ApiPropertyOptional({
    description: 'Make this the default shipping address',
  })
  @IsOptional()
  @IsBoolean()
  shipping?: boolean;

  @ApiPropertyOptional({ description: 'Make this the default billing address' })
  @IsOptional()
  @IsBoolean()
  billing?: boolean;
}
