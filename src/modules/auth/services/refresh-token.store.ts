import { Injectable } from '@nestjs/common';

/**
 * MVP: in-memory refresh-token store (no Redis).
 *
 * Tracks the set of *currently valid* refresh-token ids (the JWT `jti`) per user
 * in a process-local Map — the same revocation/rotation semantics as the
 * Redis-backed version, but single-instance and non-durable:
 *
 * - issuing a token `add`s its jti (with a lazy TTL);
 * - using a token `consume`s (removes) it and a new one is issued (rotation);
 * - a signature-valid token whose jti is absent has been rotated/revoked;
 * - logout / compromise calls `revokeAll`.
 *
 * Entries expire lazily (checked on read) and are swept opportunistically. On
 * process restart the store is empty, so all sessions must re-authenticate —
 * acceptable for the MVP. Restore the Redis-backed store (git history) for
 * durable, multi-instance sessions.
 */
@Injectable()
export class RefreshTokenStore {
  /** `${userId}:${jti}` → expiry (epoch ms). */
  private readonly tokens = new Map<string, number>();

  /** Record a freshly issued refresh token as valid for `ttlSeconds`. */
  add(userId: string, jti: string, ttlSeconds: number): Promise<void> {
    this.tokens.set(
      this.key(userId, jti),
      Date.now() + Math.max(ttlSeconds, 1) * 1000,
    );
    return Promise.resolve();
  }

  /**
   * Atomically consume a jti. Returns `true` if it was present and live (now
   * removed); `false` if it was absent or expired (already used / revoked).
   */
  consume(userId: string, jti: string): Promise<boolean> {
    const k = this.key(userId, jti);
    const expiresAt = this.tokens.get(k);
    if (expiresAt === undefined) return Promise.resolve(false);
    this.tokens.delete(k);
    return Promise.resolve(expiresAt >= Date.now());
  }

  /** Revoke every active refresh token for a user (logout-all / reuse defence). */
  revokeAll(userId: string): Promise<void> {
    const prefix = `${userId}:`;
    for (const k of this.tokens.keys()) {
      if (k.startsWith(prefix)) this.tokens.delete(k);
    }
    this.sweepExpired();
    return Promise.resolve();
  }

  private key(userId: string, jti: string): string {
    return `${userId}:${jti}`;
  }

  /** Opportunistically drop expired entries so the map can't grow unbounded. */
  private sweepExpired(): void {
    const now = Date.now();
    for (const [k, expiresAt] of this.tokens) {
      if (expiresAt < now) this.tokens.delete(k);
    }
  }
}
