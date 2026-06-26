import { ApiProperty } from '@nestjs/swagger';
import { AuditLog } from '../entities/audit-log.entity';

/** An audit-trail row as returned by the admin query endpoint. */
export class AuditLogResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) actorId: string | null;
  @ApiProperty() action: string;
  @ApiProperty({ nullable: true }) targetType: string | null;
  @ApiProperty({ nullable: true }) targetId: string | null;
  @ApiProperty({ nullable: true }) ipAddress: string | null;
  @ApiProperty({ nullable: true }) metadata: Record<string, unknown> | null;
  @ApiProperty() createdAt: Date;

  static fromEntity(log: AuditLog): AuditLogResponseDto {
    const dto = new AuditLogResponseDto();
    dto.id = log.id;
    dto.actorId = log.actorId;
    dto.action = log.action;
    dto.targetType = log.targetType;
    dto.targetId = log.targetId;
    dto.ipAddress = log.ipAddress;
    dto.metadata = log.metadata;
    dto.createdAt = log.createdAt;
    return dto;
  }
}
