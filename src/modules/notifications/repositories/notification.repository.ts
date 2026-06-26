import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Notification } from '../entities/notification.entity';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationStatus } from '../enums/notification-status.enum';

@Injectable()
export class NotificationRepository extends BaseRepository<Notification> {
  constructor(
    @InjectRepository(Notification)
    repo: Repository<Notification>,
  ) {
    super(repo);
  }

  /** Delivery log, newest first, optionally filtered by status/channel. */
  list(
    filters: { status?: NotificationStatus; channel?: NotificationChannel },
    skip: number,
    take: number,
  ): Promise<[Notification[], number]> {
    const where: FindOptionsWhere<Notification> = {};
    if (filters.status) where.status = filters.status;
    if (filters.channel) where.channel = filters.channel;
    return this.paginate(skip, take, {
      where,
      order: { createdAt: 'DESC' },
    });
  }
}
