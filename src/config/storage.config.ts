import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  publicUrl: string;
}

export const storageConfig = registerAs('storage', (): StorageConfig => ({
  endpoint: process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000',
  region: process.env.STORAGE_REGION ?? 'us-east-1',
  bucket: process.env.STORAGE_BUCKET ?? 'buyhat-media',
  accessKey: process.env.STORAGE_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.STORAGE_SECRET_KEY ?? 'minioadmin',
  forcePathStyle: (process.env.STORAGE_FORCE_PATH_STYLE ?? 'true') === 'true',
  publicUrl: process.env.STORAGE_PUBLIC_URL ?? 'http://localhost:9000/buyhat-media',
}));
