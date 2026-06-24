import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * Standalone TypeORM DataSource used exclusively by the TypeORM CLI for
 * generating, running and reverting migrations (see package.json scripts).
 *
 * The running application configures TypeORM via DatabaseModule + ConfigService;
 * this file exists because the CLI runs OUTSIDE the Nest DI container and needs
 * its own connection definition. Keep the options in sync with DatabaseModule.
 *
 * NOTE: `synchronize` is hard-disabled — schema changes go through migrations
 * only, which is mandatory for safe production deployments.
 */
loadEnv();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'app',
  // Glob both .ts (ts-node CLI) and .js (compiled runtime) so the same config
  // works for the CLI and the built app.
  entities: ['src/**/*.entity{.ts,.js}', 'dist/**/*.entity{.js}'],
  migrations: [
    'src/database/migrations/*{.ts,.js}',
    'dist/database/migrations/*{.js}',
  ],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
