import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Profile } from '../entities/profile.entity';

@Injectable()
export class ProfileRepository extends BaseRepository<Profile> {
  constructor(
    @InjectRepository(Profile)
    repo: Repository<Profile>,
  ) {
    super(repo);
  }

  findByUserId(userId: string): Promise<Profile | null> {
    return this.findOne({ where: { userId } });
  }

  /** Profiles for a set of user ids — used to compose admin user listings. */
  findByUserIds(userIds: string[]): Promise<Profile[]> {
    if (userIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.repository
      .createQueryBuilder('profile')
      .where('profile.user_id IN (:...userIds)', { userIds })
      .getMany();
  }
}
