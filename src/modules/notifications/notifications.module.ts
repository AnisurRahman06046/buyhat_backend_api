import { Module } from '@nestjs/common';

/**
 * Notifications module — transactional email/SMS/push, delivered through
 * BullMQ processors so sending never blocks the request path. Owns schema
 * `notifications` (templates, delivery log).
 *
 * Skeleton only.
 */
@Module({})
export class NotificationsModule {}
