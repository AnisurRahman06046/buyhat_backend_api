import { registerAs } from '@nestjs/config';

export interface ThrottleConfig {
  /** Window length in milliseconds (@nestjs/throttler v6). */
  ttl: number;
  /** Max requests per window per client. */
  limit: number;
}

export const throttleConfig = registerAs('throttle', (): ThrottleConfig => ({
  ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
}));
