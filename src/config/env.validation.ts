import * as Joi from 'joi';

/**
 * Validates raw process environment on boot. Fails fast with a clear
 * message if a required variable is missing or malformed.
 */
export const envValidationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  APP_NAME: Joi.string().default('BuyHat'),
  API_PREFIX: Joi.string().default('api'),
  API_VERSION: Joi.string().default('1'),
  CORS_ORIGINS: Joi.string().default('*'),
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  LOG_LEVEL: Joi.string()
    .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal')
    .default('info'),

  // Database
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).optional(),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().default('buyhat'),
  DB_PASSWORD: Joi.string().allow('').default('buyhat_password'),
  DB_NAME: Joi.string().default('buyhat'),
  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_SYNCHRONIZE: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_MIGRATIONS_RUN: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().default(0),
  REDIS_KEY_PREFIX: Joi.string().default('buyhat:'),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('900s'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_TTL: Joi.string().default('7d'),

  // Throttler
  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(120),

  // Storage
  STORAGE_ENDPOINT: Joi.string().default('http://localhost:9000'),
  STORAGE_REGION: Joi.string().default('us-east-1'),
  STORAGE_BUCKET: Joi.string().default('buyhat-media'),
  STORAGE_ACCESS_KEY: Joi.string().default('minioadmin'),
  STORAGE_SECRET_KEY: Joi.string().default('minioadmin'),
  STORAGE_FORCE_PATH_STYLE: Joi.boolean().truthy('true').falsy('false').default(true),
  STORAGE_PUBLIC_URL: Joi.string().default('http://localhost:9000/buyhat-media'),
});
