/** DI token for the active storage provider (depend on this, not the impl). */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface UploadParams {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
}

export interface UploadResult {
  key: string;
  url: string;
}

/**
 * Object-storage port. Swap the S3 adapter for GCS/Azure/local without
 * touching any module that depends on STORAGE_PROVIDER.
 */
export interface StorageProvider {
  upload(params: UploadParams): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  publicUrl(key: string): string;
}
