import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Staff ad-hoc send through the real pipeline. The channel comes from the route
 * (`/email` | `/sms` | `/push`); `subject` is used for EMAIL/PUSH only.
 */
export class SendNotificationDto {
  @ApiProperty({ description: 'Recipient (email / phone / push token)' })
  @IsString()
  @MinLength(1)
  @MaxLength(320)
  to: string;

  @ApiPropertyOptional({ description: 'Subject/title (EMAIL & PUSH)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  body: string;

  @ApiPropertyOptional({ description: 'Associate the send with a user id' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
