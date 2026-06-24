/** DI token for the password hashing strategy (swappable). */
export const PASSWORD_HASHER = 'PASSWORD_HASHER';

/**
 * Password hashing port. Hides the concrete KDF (Argon2id) so the algorithm /
 * parameters can change in one place, with transparent upgrade via `needsRehash`.
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
  /** True if `hash` was produced with weaker/older params and should be re-hashed on next login. */
  needsRehash(hash: string): boolean;
}
