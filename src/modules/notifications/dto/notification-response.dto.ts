import { ApiProperty } from '@nestjs/swagger';
import { Notification } from '../entities/notification.entity';

/** Delivery-log row as returned by the API. */
export class NotificationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) userId: string | null;
  @ApiProperty() channel: string;
  @ApiProperty() recipient: string;
  @ApiProperty() event: string;
  @ApiProperty() category: string;
  @ApiProperty({ nullable: true }) subject: string | null;
  @ApiProperty() body: string;
  @ApiProperty() status: string;
  @ApiProperty() attempts: number;
  @ApiProperty({ nullable: true }) error: string | null;
  @ApiProperty({ nullable: true }) provider: string | null;
  @ApiProperty({ nullable: true }) sentAt: Date | null;
  @ApiProperty() createdAt: Date;

  static fromEntity(n: Notification): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id = n.id;
    dto.userId = n.userId;
    dto.channel = n.channel;
    dto.recipient = n.recipient;
    dto.event = n.event;
    dto.category = n.category;
    dto.subject = n.subject;
    dto.body = n.body;
    dto.status = n.status;
    dto.attempts = n.attempts;
    dto.error = n.error;
    dto.provider = n.provider;
    dto.sentAt = n.sentAt;
    dto.createdAt = n.createdAt;
    return dto;
  }
}
