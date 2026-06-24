import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { storageConfig } from '../../config';
import {
  StorageProvider,
  UploadParams,
  UploadResult,
} from './storage.interface';

/** Default lifetime for presigned URLs when a caller does not specify one. */
const DEFAULT_SIGNED_URL_TTL_SECONDS = 15 * 60;

/**
 * S3-compatible storage adapter (AWS S3, MinIO, R2, ...). It is the only
 * place that imports the AWS SDK; everything else depends on the
 * StorageProvider port via the STORAGE_PROVIDER token.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(
    @Inject(storageConfig.KEY)
    private readonly config: ConfigType<typeof storageConfig>,
  ) {
    this.bucket = config.bucket;
    this.publicBaseUrl = config.publicUrl.replace(/\/+$/, '');
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
    this.logger.log(
      `S3 storage ready (bucket="${this.bucket}", endpoint="${config.endpoint}")`,
    );
  }

  async upload(params: UploadParams): Promise<UploadResult> {
    const key = this.normalizeKey(params.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );
    return { key, url: this.publicUrl(key) };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.normalizeKey(key),
      }),
    );
  }

  async getSignedUrl(
    key: string,
    expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.normalizeKey(key),
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${this.normalizeKey(key)}`;
  }

  /** Strip leading slashes so keys are stored consistently. */
  private normalizeKey(key: string): string {
    return key.replace(/^\/+/, '');
  }
}
