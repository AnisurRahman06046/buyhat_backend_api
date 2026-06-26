import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { NotificationPreference } from '../entities/notification-preference.entity';

@Injectable()
export class NotificationPreferenceRepository extends BaseRepository<NotificationPreference> {
  constructor(
    @InjectRepository(NotificationPreference)
    repo: Repository<NotificationPreference>,
  ) {
    super(repo);
  }

  findByUserId(userId: string): Promise<NotificationPreference | null> {
    return this.findOne({ where: { userId } });
  }
}
