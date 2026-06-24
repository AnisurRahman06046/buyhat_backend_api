import { Argon2PasswordHasher } from './argon2-password-hasher';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('produces an argon2id hash and verifies the correct password', async () => {
    const hash = await hasher.hash('S3cureP@ss');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(hasher.verify(hash, 'S3cureP@ss')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hasher.hash('S3cureP@ss');
    await expect(hasher.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('returns false (not throw) for a malformed hash', async () => {
    await expect(hasher.verify('not-a-real-hash', 'x')).resolves.toBe(false);
  });

  it('flags a non-argon2id hash as needing rehash', () => {
    expect(hasher.needsRehash('$2b$12$0123456789012345678901')).toBe(true);
  });

  it('does not flag a freshly-created hash for rehash', async () => {
    const hash = await hasher.hash('S3cureP@ss');
    expect(hasher.needsRehash(hash)).toBe(false);
  });
});
