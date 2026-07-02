import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudinaryStorageProvider } from './cloudinary-storage.provider';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { STORAGE_PROVIDER } from './storage.types';

/**
 * Global storage infrastructure. Binds {@link STORAGE_PROVIDER} to the adapter
 * named by `STORAGE_DRIVER` (`local` disk by default; `s3` or `cloudinary`
 * for production). Only the chosen adapter is instantiated; inject the token
 * to store/serve media.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        switch (config.get<string>('storage.driver')) {
          case 's3':
            return new S3StorageProvider(config);
          case 'cloudinary':
            return new CloudinaryStorageProvider(config);
          default:
            return new LocalDiskStorageProvider(config);
        }
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
