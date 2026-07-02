import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DatabaseConfig } from '../config/configuration';
import { DB_SCHEMAS } from './schemas';

/**
 * Configures the TypeORM connection asynchronously from ConfigService.
 *
 * - `autoLoadEntities: true` so each feature module registers its own entities
 *   via `TypeOrmModule.forFeature([...])` (modules own their data; no central
 *   entity registry to edit when adding a module).
 * - `synchronize: false` always — production safety; use migrations.
 * - `dataSourceFactory` provisions one Postgres schema per module before the
 *   connection is handed to the app, so schema-pinned entities always resolve.
 * - Connection pooling tuned via `extra` for high-concurrency workloads.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const db = configService.get<DatabaseConfig>('db')!;
        const isProduction =
          configService.get<string>('app.env') === 'production';

        return {
          type: 'postgres',
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          // Managed Postgres (e.g. Render external URLs) requires TLS; the
          // provider terminates with its own CA, so skip chain verification.
          ssl: db.ssl ? { rejectUnauthorized: false } : undefined,
          autoLoadEntities: true,
          synchronize: false,
          logging: !isProduction,
          // Connection pool — sized for many concurrent requests. Tune per env.
          extra: {
            max: 20,
            connectionTimeoutMillis: 5_000,
            idleTimeoutMillis: 30_000,
          },
        };
      },
      // Create the per-module schemas before the app uses the connection.
      // Idempotent (IF NOT EXISTS); migrations also create them for deploys.
      dataSourceFactory: async (options?: DataSourceOptions) => {
        const dataSource = new DataSource(options!);
        await dataSource.initialize();
        for (const schema of DB_SCHEMAS) {
          await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
        }
        return dataSource;
      },
    }),
  ],
})
export class DatabaseModule {}
