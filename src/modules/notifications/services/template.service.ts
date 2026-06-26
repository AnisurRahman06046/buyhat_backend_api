import { Injectable, NotFoundException } from '@nestjs/common';
import { TemplateResponseDto } from '../dto/template-response.dto';
import { UpdateTemplateDto } from '../dto/update-template.dto';
import { NotificationChannel } from '../enums/notification-channel.enum';
import {
  EVENT_DEFINITIONS,
  NotificationEvent,
} from '../events/notification-events';
import { TEMPLATE_ID_SEPARATOR } from '../notifications.constants';
import { NotificationTemplateRepository } from '../repositories/notification-template.repository';

/** Effective template for a channel: a DB override or the in-code default. */
export interface ResolvedTemplate {
  subject: string | null;
  body: string;
  isActive: boolean;
}

/**
 * Template management (D62): a `notification_template` row for an (event,
 * channel) overrides the in-code default. The public id of a template is the
 * stable composite `event::channel`, so every default is editable without a
 * separate create step.
 */
@Injectable()
export class TemplateService {
  constructor(private readonly repo: NotificationTemplateRepository) {}

  /** DB override ?? in-code default for (event, channel); null if no such default. */
  async resolve(
    event: NotificationEvent,
    channel: NotificationChannel,
  ): Promise<ResolvedTemplate | null> {
    const override = await this.repo.findByEventChannel(event, channel);
    if (override) {
      return {
        subject: override.subject,
        body: override.body,
        isActive: override.isActive,
      };
    }
    const fallback = EVENT_DEFINITIONS[event]?.channels.find(
      (c) => c.channel === channel,
    );
    if (!fallback) return null;
    return {
      subject: fallback.subject ?? null,
      body: fallback.body,
      isActive: true,
    };
  }

  /** Every (event, channel) default overlaid with its DB override, if any. */
  async list(): Promise<TemplateResponseDto[]> {
    const overrides = await this.repo.findAllOverrides();
    const byKey = new Map(
      overrides.map((o) => [
        `${o.event}${TEMPLATE_ID_SEPARATOR}${o.channel}`,
        o,
      ]),
    );
    const rows: TemplateResponseDto[] = [];
    for (const def of Object.values(EVENT_DEFINITIONS)) {
      for (const ch of def.channels) {
        const key = `${def.event}${TEMPLATE_ID_SEPARATOR}${ch.channel}`;
        const ov = byKey.get(key);
        rows.push({
          id: key,
          event: def.event,
          channel: ch.channel,
          category: def.category,
          subject: ov ? ov.subject : (ch.subject ?? null),
          body: ov ? ov.body : ch.body,
          isActive: ov ? ov.isActive : true,
          isOverride: !!ov,
        });
      }
    }
    return rows;
  }

  /** Upsert the override addressed by the composite `event::channel` id. */
  async update(
    compositeId: string,
    dto: UpdateTemplateDto,
  ): Promise<TemplateResponseDto> {
    const { event, channel } = this.parseId(compositeId);
    const fallback = EVENT_DEFINITIONS[event].channels.find(
      (c) => c.channel === channel,
    )!;
    let row = await this.repo.findByEventChannel(event, channel);
    if (!row) {
      row = this.repo.create({
        event,
        channel,
        subject: fallback.subject ?? null,
        body: fallback.body,
        isActive: true,
      });
    }
    if (dto.subject !== undefined) row.subject = dto.subject;
    if (dto.body !== undefined) row.body = dto.body;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    const saved = await this.repo.save(row);
    return {
      id: compositeId,
      event,
      channel,
      category: EVENT_DEFINITIONS[event].category,
      subject: saved.subject,
      body: saved.body,
      isActive: saved.isActive,
      isOverride: true,
    };
  }

  private parseId(compositeId: string): {
    event: NotificationEvent;
    channel: NotificationChannel;
  } {
    const [eventPart, channelPart] = compositeId.split(TEMPLATE_ID_SEPARATOR);
    const event = eventPart as NotificationEvent;
    const channel = channelPart as NotificationChannel;
    const def = EVENT_DEFINITIONS[event];
    const known = !!def && def.channels.some((c) => c.channel === channel);
    if (!known) {
      throw new NotFoundException(`Unknown template id "${compositeId}"`);
    }
    return { event, channel };
  }
}
