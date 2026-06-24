import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Reusable `:id` route param validator (UUID v4). */
export class UuidParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id!: string;
}
