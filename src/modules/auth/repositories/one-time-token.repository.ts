import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BaseRepository } from '../../../common/repositories/base.repository';
import { OneTimeToken } from '../entities/one-time-token.entity';
import { OneTimeTokenPurpose } from '../enums/one-time-token-purpose.enum';

@Injectable()
export class OneTimeTokenRepository extends BaseRepository<OneTimeToken> {
  constructor(
    @InjectRepository(OneTimeToken)
    repo: Repository<OneTimeToken>,
  ) {
    super(repo);
  }

  /** An unconsumed token matching the hash + purpose (expiry checked by caller). */
  findActiveByHash(
    tokenHash: string,
    purpose: OneTimeTokenPurpose,
  ): Promise<OneTimeToken | null> {
    return this.findOne({
      where: { tokenHash, purpose, consumedAt: IsNull() },
    });
  }

  /** Invalidate all of an account's unconsumed tokens of a purpose (e.g. on re-issue). */
  async consumeAllForPurpose(
    accountId: string,
    purpose: OneTimeTokenPurpose,
  ): Promise<void> {
    await this.repository.update(
      { accountId, purpose, consumedAt: IsNull() },
      { consumedAt: new Date() },
    );
  }
}
