import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './controllers/notification.controller';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationPreferenceRepository } from './repositories/notification-preference.repository';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationTemplateRepository } from './repositories/notification-template.repository';
import { NotificationService } from './services/notification.service';
import { PreferenceService } from './services/preference.service';
import { TemplateService } from './services/template.service';

/**
 * `notifications` feature module — the multi-channel pipeline (D59): a dispatch
 * seam, DB-overridable templates (D62), per-user marketing preferences (D60), a
 * BullMQ queue with retry/backoff (D63) and an append-only delivery log. The
 * channel adapter is the @Global {@link NotificationProviderModule}
 * (`NOTIFICATION_PROVIDER`, default = logging stub).
 *
 * @Global so any module injects `NotificationService` without importing this
 * module. It depends on no other feature module (callers pass a resolved `to`,
 * D64), so there are no module cycles.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationTemplate,
      NotificationPreference,
    ]),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationRepository,
    NotificationTemplateRepository,
    NotificationPreferenceRepository,
    NotificationService,
    TemplateService,
    // MVP: NotificationProcessor (BullMQ worker) disabled. NotificationService
    // still records notifications; delivery enqueue is a no-op without Redis.
    PreferenceService,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
