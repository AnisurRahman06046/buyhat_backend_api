import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  accessSecret: string;
  accessTtl: string;
  refreshSecret: string;
  refreshTtl: string;
}

export const jwtConfig = registerAs('jwt', (): JwtConfig => ({
  accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret_change_me',
  accessTtl: process.env.JWT_ACCESS_TTL ?? '900s',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret_change_me',
  refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
}));
