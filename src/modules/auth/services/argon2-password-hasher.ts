import { Injectable } from '@nestjs/common';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { PasswordHasher } from './password-hasher';

/**
 * Argon2id password hasher (memory-hard → far costlier to crack a stolen hash
 * table on GPUs/ASICs than bcrypt). Parameters follow the OWASP baseline; tune
 * `memoryCost` to the host's RAM/concurrency budget.
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  private readonly options = {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456, // 19 MiB (OWASP minimum)
    timeCost: 2,
    parallelism: 1,
  };

  /** Substring every hash made with the current params contains. */
  private readonly currentParams = `$argon2id$v=19$m=${this.options.memoryCost},t=${this.options.timeCost},p=${this.options.parallelism}$`;

  hash(plain: string): Promise<string> {
    return hash(plain, this.options);
  }

  async verify(hashStr: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashStr, plain);
    } catch {
      // Malformed hash → treat as a non-match rather than throwing.
      return false;
    }
  }

  needsRehash(hashStr: string): boolean {
    return !hashStr.startsWith(this.currentParams);
  }
}
