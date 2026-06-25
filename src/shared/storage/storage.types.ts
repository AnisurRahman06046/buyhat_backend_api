/**
 * Swappable object-storage port. Bound to a concrete adapter (local disk or S3)
 * in {@link StorageModule} via the {@link STORAGE_PROVIDER} token, so feature
 * code depends on this interface only and the backend is a one-env-var change.
 */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface PutObjectParams {
  /** Object key (path) relative to the storage root/bucket. */
  key: string;
  body: Buffer;
  contentType: string;
}

export interface PresignedPutParams {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface PresignedPut {
  uploadUrl: string;
  key: string;
}

export interface StorageProvider {
  /** Store bytes at `key`; returns the stored key. */
  putObject(params: PutObjectParams): Promise<{ key: string }>;
  /** Public URL a client can GET the object from. */
  getPublicUrl(key: string): string;
  /**
   * Short-lived signed URL for a direct client PUT. Supported by the S3 driver;
   * the local-disk driver throws (multipart upload is the default path — D7).
   */
  createPresignedPut(params: PresignedPutParams): Promise<PresignedPut>;
  /** Best-effort delete; must not throw if the object is already gone. */
  deleteObject(key: string): Promise<void>;
}
