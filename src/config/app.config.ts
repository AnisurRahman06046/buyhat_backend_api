import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  name: string;
  apiPrefix: string;
  apiVersion: string;
  corsOrigins: string[];
  swaggerEnabled: boolean;
  logLevel: string;
}

export const appConfig = registerAs('app', (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: parseInt(process.env.PORT ?? '3000', 10),
    name: process.env.APP_NAME ?? 'BuyHat',
    apiPrefix: process.env.API_PREFIX ?? 'api',
    apiVersion: process.env.API_VERSION ?? '1',
    corsOrigins: (process.env.CORS_ORIGINS ?? '*')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    swaggerEnabled: (process.env.SWAGGER_ENABLED ?? 'true') === 'true',
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
});
