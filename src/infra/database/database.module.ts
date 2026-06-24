import { Global, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseConfig } from '../../config';
import { buildDataSourceOptions } from './build-data-source-options';
import { DB_SCHEMAS } from './db.constants';

/**
 * Root database module.
 *
 * The custom `dataSourceFactory` guarantees every per-module Postgres schema
 * exists BEFORE TypeORM synchronizes or runs migrations — so the app boots
 * cleanly on a fresh database with no manual `CREATE SCHEMA` step, whether
 * running locally or in Docker.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>) =>
        buildDataSourceOptions(config),
      dataSourceFactory: async (options?: DataSourceOptions) => {
        const config = databaseConfig();
        const dataSource = new DataSource({
          ...(options as DataSourceOptions),
          synchronize: false,
          migrationsRun: false,
        });

        await dataSource.initialize();

        for (const schema of DB_SCHEMAS) {
          await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
        }

        if (config.synchronize) {
          await dataSource.synchronize();
        }
        if (config.migrationsRun) {
          await dataSource.runMigrations({ transaction: 'all' });
        }

        return dataSource;
      },
    }),
  ],
})
export class DatabaseModule {}
