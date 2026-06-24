import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { redisConfig } from './redis.config';
import { jwtConfig } from './jwt.config';
import { throttleConfig } from './throttle.config';
import { storageConfig } from './storage.config';

export * from './app.config';
export * from './database.config';
export * from './redis.config';
export * from './jwt.config';
export * from './throttle.config';
export * from './storage.config';
export * from './env.validation';

/** All namespaced config factories, loaded by ConfigModule.forRoot. */
export const configurations = [
  appConfig,
  databaseConfig,
  redisConfig,
  jwtConfig,
  throttleConfig,
  storageConfig,
];
