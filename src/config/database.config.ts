import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  synchronize: boolean;
  migrationsRun: boolean;
  logging: boolean;
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'buyhat',
  password: process.env.DB_PASSWORD ?? 'buyhat_password',
  database: process.env.DB_NAME ?? 'buyhat',
  ssl: process.env.DB_SSL === 'true',
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  migrationsRun: process.env.DB_MIGRATIONS_RUN === 'true',
  logging: process.env.DB_LOGGING === 'true',
}));
