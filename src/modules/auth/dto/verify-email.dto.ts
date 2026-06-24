import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'The verification token sent by email' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
