import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OneTimeToken } from '../entities/one-time-token.entity';
import { OneTimeTokenPurpose } from '../enums/one-time-token-purpose.enum';
import { OneTimeTokenRepository } from '../repositories/one-time-token.repository';

/**
 * Issues and consumes single-use tokens (email verification, password reset,
 * OTP). The raw token is returned to the caller (to email/SMS) but only its
 * SHA-256 hash is stored — a leaked DB never yields usable tokens.
 */
@Injectable()
export class OneTimeTokenService {
  constructor(private readonly repository: OneTimeTokenRepository) {}

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Issue a token, returning the RAW value. Pass `manager` to enlist the insert
   * in an existing transaction (e.g. registration).
   */
  async issue(
    accountId: string,
    purpose: OneTimeTokenPurpose,
    ttlSeconds: number,
    manager?: EntityManager,
  ): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    const data = {
      accountId,
      purpose,
      tokenHash: this.hashToken(raw),
      expiresAt: new Date(Date.now() + ttlSeconds * 1_000),
    };
    if (manager) {
      await manager.insert(OneTimeToken, data);
    } else {
      await this.repository.save(this.repository.create(data));
    }
    return raw;
  }

  /** Validate + consume a token; returns the owning accountId, or null if invalid/expired/used. */
  async consume(
    rawToken: string,
    purpose: OneTimeTokenPurpose,
  ): Promise<string | null> {
    const token = await this.repository.findActiveByHash(
      this.hashToken(rawToken),
      purpose,
    );
    if (!token || token.expiresAt.getTime() < Date.now()) {
      return null;
    }
    token.consumedAt = new Date();
    await this.repository.save(token);
    return token.accountId;
  }

  /** Invalidate all unconsumed tokens of a purpose (e.g. before re-issuing). */
  invalidateAll(
    accountId: string,
    purpose: OneTimeTokenPurpose,
  ): Promise<void> {
    return this.repository.consumeAllForPurpose(accountId, purpose);
  }
}
