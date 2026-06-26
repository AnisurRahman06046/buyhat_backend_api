import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { PaginationMeta } from '../../../common/interfaces/api-response.interface';
import { buildPaginationMeta } from '../../../common/utils/pagination.util';
import { AuditLogResponseDto } from '../dto/audit-log-response.dto';
import { AuditQueryDto } from '../dto/audit-query.dto';
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

  /** Query the audit trail (admin, Phase 11), newest first, paginated. */
  async list(query: AuditQueryDto): Promise<{
    data: AuditLogResponseDto[];
    pagination: PaginationMeta;
  }> {
    const where: FindOptionsWhere<AuditLog> = {};
    if (query.action) where.action = query.action;
    if (query.actorId) where.actorId = query.actorId;
    if (query.targetType) where.targetType = query.targetType;
    if (query.from && query.to) {
      where.createdAt = Between(query.from, query.to);
    } else if (query.from) {
      where.createdAt = MoreThanOrEqual(query.from);
    } else if (query.to) {
      where.createdAt = LessThanOrEqual(query.to);
    }
    const [rows, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.limit,
    });
    return {
      data: rows.map((r) => AuditLogResponseDto.fromEntity(r)),
      pagination: buildPaginationMeta(total, query.page, query.limit),
    };
  }
}
