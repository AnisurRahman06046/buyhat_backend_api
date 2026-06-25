import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageConfig } from '../../config/configuration';
import {
  PresignedPut,
  PresignedPutParams,
  PutObjectParams,
  StorageProvider,
} from './storage.types';

/**
 * S3-compatible storage (AWS S3 or MinIO via `endpoint` + `forcePathStyle`).
 * Used in production (`STORAGE_DRIVER=s3`); supports both server-proxied uploads
 * (`putObject`) and presigned direct-to-bucket PUTs (`createPresignedPut`).
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly cfg: StorageConfig['s3'];
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.cfg = config.getOrThrow<StorageConfig['s3']>('storage.s3');
    this.publicUrl = (config.get<string>('storage.publicUrl') ?? '').replace(
      /\/+$/,
      '',
    );
    this.client = new S3Client({
      region: this.cfg.region,
      endpoint: this.cfg.endpoint,
      forcePathStyle: this.cfg.forcePathStyle,
      credentials: {
        accessKeyId: this.cfg.accessKeyId,
        secretAccessKey: this.cfg.secretAccessKey,
      },
    });
  }

  async putObject({
    key,
    body,
    contentType,
  }: PutObjectParams): Promise<{ key: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { key };
  }

  getPublicUrl(key: string): string {
    const normalized = key.replace(/^\/+/, '');
    if (this.publicUrl) return `${this.publicUrl}/${normalized}`;
    const base = this.cfg.endpoint?.replace(/\/+$/, '');
    if (base) {
      return this.cfg.forcePathStyle
        ? `${base}/${this.cfg.bucket}/${normalized}`
        : `${base}/${normalized}`;
    }
    return `https://${this.cfg.bucket}.s3.${this.cfg.region}.amazonaws.com/${normalized}`;
  }

  createPresignedPut({
    key,
    contentType,
    expiresInSeconds = 900,
  }: PresignedPutParams): Promise<PresignedPut> {
    const command = new PutObjectCommand({
      Bucket: this.cfg.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    }).then((uploadUrl) => ({ uploadUrl, key }));
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
    );
  }
}
