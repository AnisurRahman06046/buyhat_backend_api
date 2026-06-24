import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { Address } from '../entities/address.entity';

@Injectable()
export class AddressRepository extends BaseRepository<Address> {
  constructor(
    @InjectRepository(Address)
    repo: Repository<Address>,
  ) {
    super(repo);
  }

  findByProfile(profileId: string): Promise<Address[]> {
    return this.findMany({
      where: { profileId },
      order: { createdAt: 'ASC' },
    });
  }

  /** Scope a single address to its owning profile (ownership check). */
  findOneForProfile(id: string, profileId: string): Promise<Address | null> {
    return this.findOne({ where: { id, profileId } });
  }
}
