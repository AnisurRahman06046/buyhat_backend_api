import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { databaseConfig } from '../../config';
import { buildDataSourceOptions } from './build-data-source-options';

// Used by the TypeORM CLI (migration:generate / migration:run / migration:revert).
// Loads .env directly since Nest's ConfigModule is not running in CLI context.
dotenv.config();

const dataSource = new DataSource(buildDataSourceOptions(databaseConfig()));

export default dataSource;
