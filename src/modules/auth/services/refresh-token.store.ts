import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../shared/redis/redis.service';

/**
 * Tracks the set of *currently valid* refresh-token ids (the JWT `jti`) per user
 * in Redis. This is what makes stateless JWT refresh tokens revocable and
 * rotatable:
 *
 * - issuing a token `add`s its jti;
 * - using a token `consume`s (removes) it and a new one is issued (rotation);
 * - a signature-valid token whose jti is NOT in the store has already been
 *   rotated or revoked → treated as replay/reuse;
 * - logout / compromise calls `revokeAll`.
 *
 * Keys auto-expire with the refresh token's own lifetime, so the store never
 * grows unbounded.
 */
@Injectable()
export class RefreshTokenStore {
  private static readonly PREFIX = 'auth:refresh';

  constructor(private readonly redis: RedisService) {}

  private key(userId: string, jti: string): string {
    return `${RefreshTokenStore.PREFIX}:${userId}:${jti}`;
  }

  /** Record a freshly issued refresh token as valid for `ttlSeconds`. */
  async add(userId: string, jti: string, ttlSeconds: number): Promise<void> {
    await this.redis
      .getClient()
      .set(this.key(userId, jti), '1', 'EX', Math.max(ttlSeconds, 1));
  }

  /**
   * Atomically consume a jti. Returns `true` if it was present (a live session)
   * and is now removed; `false` if it was absent (already used / revoked).
   */
  async consume(userId: string, jti: string): Promise<boolean> {
    const removed = await this.redis.getClient().del(this.key(userId, jti));
    return removed === 1;
  }

  /** Revoke every active refresh token for a user (logout-all / reuse defence). */
  async revokeAll(userId: string): Promise<void> {
    const client = this.redis.getClient();
    const pattern = `${RefreshTokenStore.PREFIX}:${userId}:*`;
    let cursor = '0';
    do {
      const [next, keys] = await client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = next;
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== '0');
  }
}
