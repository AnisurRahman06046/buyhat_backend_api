import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MergeCartDto {
  @ApiProperty({ description: 'The guest cart id to fold into the user cart' })
  @IsUUID()
  guestId: string;
}
