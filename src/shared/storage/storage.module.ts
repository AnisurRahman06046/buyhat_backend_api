import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { STORAGE_PROVIDER } from './storage.types';

/**
 * Global storage infrastructure. Binds {@link STORAGE_PROVIDER} to the adapter
 * named by `STORAGE_DRIVER` (`local` disk by default, `s3` for production).
 * Only the chosen adapter is instantiated; inject the token to store/serve media.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('storage.driver') === 's3'
          ? new S3StorageProvider(config)
          : new LocalDiskStorageProvider(config),
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
