import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Supported runtime environments.
 */
export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/** Storage backend for product media (D7 / Phase 2). */
export enum StorageDriver {
  Local = 'local',
  S3 = 's3',
}

/** Product search backend (D72 / Phase 12). */
export enum SearchDriver {
  Pg = 'pg',
  Elasticsearch = 'elasticsearch',
}

/**
 * Strongly-typed schema for all environment variables the app expects.
 * `@nestjs/config` calls `validate()` at startup; if any required var is
 * missing or malformed the process fails fast with a descriptive error
 * instead of crashing later at runtime.
 */
export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  PORT = 3000;

  // ---- Database ----
  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  // ---- Redis ----
  @IsString()
  @IsNotEmpty()
  REDIS_HOST: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  REDIS_PORT: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  // ---- JWT ----
  @IsString()
  @IsNotEmpty()
  @MinLength(32, {
    message:
      'JWT_SECRET must be at least 32 characters (use `openssl rand -base64 48`)',
  })
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN = '15m';

  @IsString()
  @IsNotEmpty()
  @MinLength(32, {
    message:
      'JWT_REFRESH_SECRET must be at least 32 characters (use `openssl rand -base64 48`)',
  })
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN = '7d';

  // ---- Throttling / rate limiting ----
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_TTL = 60;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLE_LIMIT = 100;

  // ---- CORS ----
  @IsString()
  @IsOptional()
  CORS_ORIGIN = '*';

  // ---- Storage (product media) ----
  @IsEnum(StorageDriver)
  @IsOptional()
  STORAGE_DRIVER: StorageDriver = StorageDriver.Local;

  @IsString()
  @IsOptional()
  STORAGE_LOCAL_ROOT = './storage/uploads';

  @IsString()
  @IsOptional()
  STORAGE_PUBLIC_URL = '/uploads';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  STORAGE_MAX_FILE_MB = 10;

  @IsString()
  @IsOptional()
  S3_ENDPOINT?: string;

  @IsString()
  @IsOptional()
  S3_REGION = 'us-east-1';

  @IsString()
  @IsOptional()
  S3_BUCKET?: string;

  @IsString()
  @IsOptional()
  S3_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  S3_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  S3_FORCE_PATH_STYLE = 'false';

  // ---- Catalog ----
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  CATALOG_MAX_VARIANTS_PER_GENERATION = 200;

  // ---- Search ----
  @IsEnum(SearchDriver)
  @IsOptional()
  SEARCH_DRIVER: SearchDriver = SearchDriver.Pg;

  // ---- Inventory ----
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  INVENTORY_RESERVATION_TTL_MIN = 15;

  // ---- Cart ----
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  CART_ABANDONED_AFTER_MIN = 1440;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  CART_MAX_QTY_PER_LINE = 99;

  // ---- Payments ----
  @IsString()
  @IsOptional()
  PAYMENTS_MOCK_SECRET = 'mock-secret';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  PAYMENTS_RECONCILE_INTERVAL_MIN = 5;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  PAYMENTS_RECONCILE_AFTER_MIN = 10;
}

/**
 * Validation function wired into ConfigModule (`validate` option).
 * Converts raw env strings into the typed class and runs class-validator.
 */
export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors
        .map((e) => `  - ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }

  return validatedConfig;
}
