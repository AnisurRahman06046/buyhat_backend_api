/**
 * Typed configuration factory.
 *
 * Groups raw environment variables into logical, strongly-typed namespaces
 * (app, db, redis, jwt, throttle). Consumers read these via
 * `ConfigService.get('db.host')` etc., keeping env-var names in ONE place.
 */
export interface AppConfig {
  env: string;
  port: number;
  corsOrigin: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

export interface ThrottleConfig {
  ttl: number;
  limit: number;
}

export interface StorageConfig {
  /** `local` = disk (dev default); `s3` = S3/MinIO-compatible object store. */
  driver: 'local' | 's3';
  /** Public base URL/path objects are served from (e.g. `/uploads` or a CDN). */
  publicUrl: string;
  /** Max accepted upload size in bytes. */
  maxFileBytes: number;
  local: { root: string };
  s3: {
    endpoint?: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  };
}

export interface CatalogConfig {
  /** Guard against cartesian explosion when auto-generating variants (D10). */
  maxVariantsPerGeneration: number;
}

export interface Configuration {
  app: AppConfig;
  db: DatabaseConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
  throttle: ThrottleConfig;
  storage: StorageConfig;
  catalog: CatalogConfig;
}

export default (): Configuration => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
  },
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'app',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER as 'local' | 's3') ?? 'local',
    publicUrl: process.env.STORAGE_PUBLIC_URL ?? '/uploads',
    maxFileBytes:
      parseInt(process.env.STORAGE_MAX_FILE_MB ?? '10', 10) * 1024 * 1024,
    local: { root: process.env.STORAGE_LOCAL_ROOT ?? './storage/uploads' },
    s3: {
      endpoint: process.env.S3_ENDPOINT || undefined,
      region: process.env.S3_REGION ?? 'us-east-1',
      bucket: process.env.S3_BUCKET ?? '',
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'false') === 'true',
    },
  },
  catalog: {
    maxVariantsPerGeneration: parseInt(
      process.env.CATALOG_MAX_VARIANTS_PER_GENERATION ?? '200',
      10,
    ),
  },
});
