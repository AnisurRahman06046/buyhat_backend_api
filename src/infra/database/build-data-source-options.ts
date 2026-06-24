import { join } from 'path';
import { DataSourceOptions } from 'typeorm';
import { DatabaseConfig } from '../../config';

/**
 * Single source of truth for TypeORM connection options, shared by the
 * NestJS DatabaseModule (runtime) and the standalone CLI DataSource
 * (migrations). Entities and migrations are discovered by glob so they
 * work for both ts-node (dev/CLI) and compiled JS (prod).
 *
 * `synchronize` / `migrationsRun` are intentionally false here; the
 * DatabaseModule decides whether to sync or run migrations *after* it has
 * ensured the per-module schemas exist.
 */
export function buildDataSourceOptions(config: DatabaseConfig): DataSourceOptions {
  // __dirname => src/infra/database (dev) or dist/infra/database (prod)
  const rootDir = join(__dirname, '..', '..');

  const common = {
    type: 'postgres' as const,
    entities: [join(rootDir, '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    synchronize: false,
    migrationsRun: false,
    logging: config.logging,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
  };

  if (config.url) {
    return { ...common, url: config.url };
  }

  return {
    ...common,
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
  };
}
