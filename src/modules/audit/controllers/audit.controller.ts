import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { AuditQueryDto } from '../dto/audit-query.dto';
import { AuditService } from '../services/audit.service';

/** Admin-only read view over the append-only audit trail (Phase 11, D68). */
@ApiTags('audit')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Query the audit log (filter action/actor/target/date)',
  })
  list(@Query() query: AuditQueryDto) {
    return this.auditService.list(query);
  }
}
