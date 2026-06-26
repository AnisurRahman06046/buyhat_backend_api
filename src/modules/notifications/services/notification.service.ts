import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PaginationMeta } from '../../../common/interfaces/api-response.interface';
import { buildPaginationMeta } from '../../../common/utils/pagination.util';
import {
  NOTIFICATION_PROVIDER,
  NotificationProvider,
} from '../../../shared/notifications';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { NotificationResponseDto } from '../dto/notification-response.dto';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { Notification } from '../entities/notification.entity';
import { NotificationCategory } from '../enums/notification-category.enum';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationStatus } from '../enums/notification-status.enum';
import {
  EVENT_DEFINITIONS,
  NotificationEvent,
} from '../events/notification-events';
import {
  NOTIFICATION_SEND_JOB,
  NOTIFICATIONS_QUEUE,
} from '../notifications.constants';
import { NotificationRepository } from '../repositories/notification.repository';
import { PreferenceService } from './preference.service';
import { renderTemplate } from './render.util';
import { TemplateService } from './template.service';

/** Resolved contact points; a channel with no matching field is skipped. */
export interface NotificationRecipient {
  email?: string | null;
  phone?: string | null;
  pushToken?: string | null;
}

/** Input to the dispatch seam (D59). Callers pass an already-resolved `to`. */
export interface DispatchInput {
  event: NotificationEvent;
  userId?: string | null;
  to: NotificationRecipient;
  data?: Record<string, unknown>;
}

const MAX_ERROR_LEN = 1000;

/**
 * The single dispatch + delivery seam (D59). `dispatch` resolves an event's
 * channels/templates, checks marketing preferences, renders, writes a delivery
 * log row and enqueues a BullMQ job per channel. The processor calls `deliver`,
 * which sends via the channel adapter and records SENT/FAILED with retries (D63).
 * `dispatch` is best-effort and never throws into the caller's business txn.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly templateService: TemplateService,
    private readonly preferenceService: PreferenceService,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly provider: NotificationProvider,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  /** Event-driven fan-out. Safe to `void` from callers — never throws. */
  async dispatch(input: DispatchInput): Promise<void> {
    try {
      const def = EVENT_DEFINITIONS[input.event];
      if (!def || def.channels.length === 0) return;
      for (const ch of def.channels) {
        const recipient = this.pickRecipient(ch.channel, input.to);
        if (!recipient) continue; // no contact for channel — skip (edge case)
        if (def.category === NotificationCategory.MARKETING && input.userId) {
          const allowed = await this.preferenceService.isMarketingAllowed(
            input.userId,
            ch.channel,
          );
          if (!allowed) continue; // honour opt-out (D60)
        }
        const tpl = await this.templateService.resolve(input.event, ch.channel);
        if (!tpl || !tpl.isActive) continue;
        const data = input.data ?? {};
        await this.enqueue({
          userId: input.userId ?? null,
          channel: ch.channel,
          recipient,
          event: input.event,
          category: def.category,
          subject: tpl.subject ? renderTemplate(tpl.subject, data) : null,
          body: renderTemplate(tpl.body, data),
        });
      }
    } catch (err) {
      this.logger.error(`dispatch(${input.event}) failed: ${String(err)}`);
    }
  }

  /** Staff ad-hoc send through the same pipeline (delivery log + retries). */
  async sendManual(
    channel: NotificationChannel,
    dto: SendNotificationDto,
  ): Promise<NotificationResponseDto> {
    const saved = await this.enqueue({
      userId: dto.userId ?? null,
      channel,
      recipient: dto.to,
      event: NotificationEvent.MANUAL,
      category: NotificationCategory.TRANSACTIONAL,
      subject: dto.subject ?? null,
      body: dto.body,
    });
    return NotificationResponseDto.fromEntity(saved);
  }

  /**
   * Processor success path: send via the adapter and mark SENT. Throws on
   * provider failure so BullMQ retries; the processor marks FAILED on the last
   * attempt via {@link markFailed}.
   */
  async deliver(notificationId: string): Promise<void> {
    const n = await this.notificationRepository.findById(notificationId);
    if (!n || n.status === NotificationStatus.SENT) return;
    n.attempts += 1;
    n.provider = this.provider.name;
    try {
      await this.send(n);
      n.status = NotificationStatus.SENT;
      n.sentAt = new Date();
      n.error = null;
      await this.notificationRepository.save(n);
    } catch (err) {
      n.error = String(err).slice(0, MAX_ERROR_LEN);
      await this.notificationRepository.save(n);
      throw err;
    }
  }

  /** Mark a notification FAILED after the final retry was exhausted. */
  async markFailed(notificationId: string, error: unknown): Promise<void> {
    const n = await this.notificationRepository.findById(notificationId);
    if (!n) return;
    n.status = NotificationStatus.FAILED;
    n.error = String(error).slice(0, MAX_ERROR_LEN);
    await this.notificationRepository.save(n);
  }

  /** Delivery log (staff), filterable + paginated. */
  async list(query: NotificationQueryDto): Promise<{
    data: NotificationResponseDto[];
    pagination: PaginationMeta;
  }> {
    const [rows, total] = await this.notificationRepository.list(
      { status: query.status, channel: query.channel },
      query.skip,
      query.limit,
    );
    return {
      data: rows.map((r) => NotificationResponseDto.fromEntity(r)),
      pagination: buildPaginationMeta(total, query.page, query.limit),
    };
  }

  // --- internals -------------------------------------------------------------

  private pickRecipient(
    channel: NotificationChannel,
    to: NotificationRecipient,
  ): string | null {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return to.email ?? null;
      case NotificationChannel.SMS:
        return to.phone ?? null;
      case NotificationChannel.PUSH:
        return to.pushToken ?? null;
      default:
        return null;
    }
  }

  private send(n: Notification): Promise<void> {
    switch (n.channel as NotificationChannel) {
      case NotificationChannel.EMAIL:
        return this.provider.sendEmail(n.recipient, n.subject ?? '', n.body);
      case NotificationChannel.SMS:
        return this.provider.sendSms(n.recipient, n.body);
      case NotificationChannel.PUSH:
        return this.provider.sendPush(
          n.recipient,
          n.subject ?? 'Notification',
          n.body,
        );
      default:
        return Promise.reject(new Error(`Unknown channel ${n.channel}`));
    }
  }

  private async enqueue(row: {
    userId: string | null;
    channel: NotificationChannel;
    recipient: string;
    event: NotificationEvent;
    category: NotificationCategory;
    subject: string | null;
    body: string;
  }): Promise<Notification> {
    const saved = await this.notificationRepository.save(
      this.notificationRepository.create({
        ...row,
        status: NotificationStatus.PENDING,
        attempts: 0,
        provider: this.provider.name,
      }),
    );
    await this.queue.add(
      NOTIFICATION_SEND_JOB,
      { notificationId: saved.id },
      { jobId: saved.id },
    );
    return saved;
  }
}
