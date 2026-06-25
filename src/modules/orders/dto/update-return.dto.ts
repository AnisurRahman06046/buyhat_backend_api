import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReturnStatus } from '../enums/return-status.enum';

/** Staff: advance a return (APPROVED | REJECTED | RECEIVED). */
export class UpdateReturnDto {
  @ApiProperty({
    enum: [ReturnStatus.APPROVED, ReturnStatus.REJECTED, ReturnStatus.RECEIVED],
  })
  @IsEnum(ReturnStatus)
  status: ReturnStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
