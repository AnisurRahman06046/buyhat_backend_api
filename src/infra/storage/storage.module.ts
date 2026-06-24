import { Global, Module } from '@nestjs/common';
import { S3StorageProvider } from './s3-storage.provider';
import { STORAGE_PROVIDER } from './storage.interface';

/**
 * Binds the StorageProvider port to the S3 adapter and exposes it globally
 * via STORAGE_PROVIDER. Swap the adapter here (GCS/Azure/local) without
 * touching any consuming module.
 */
@Global()
@Module({
  providers: [{ provide: STORAGE_PROVIDER, useClass: S3StorageProvider }],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
