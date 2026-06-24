import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

export interface AuditEntry {
  action: string;
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Writes audit-trail rows. Calls are **best-effort**: an audit-write failure is
 * logged but never propagated, so it cannot break the operation being audited.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.repository.save(
        this.repository.create({
          action: entry.action,
          actorId: entry.actorId ?? null,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          ipAddress: entry.ip ?? null,
          metadata: entry.metadata ?? null,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to write audit log (${entry.action}): ${String(error)}`,
      );
    }
  }
}
