import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { NotificationTemplate } from '../entities/notification-template.entity';

@Injectable()
export class NotificationTemplateRepository extends BaseRepository<NotificationTemplate> {
  constructor(
    @InjectRepository(NotificationTemplate)
    repo: Repository<NotificationTemplate>,
  ) {
    super(repo);
  }

  findByEventChannel(
    event: string,
    channel: string,
  ): Promise<NotificationTemplate | null> {
    return this.findOne({ where: { event, channel } });
  }

  findAllOverrides(): Promise<NotificationTemplate[]> {
    return this.findMany({ order: { event: 'ASC', channel: 'ASC' } });
  }
}
