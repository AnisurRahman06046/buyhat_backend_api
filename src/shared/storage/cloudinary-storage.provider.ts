import { Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import { StorageConfig } from '../../config/configuration';
import {
  PresignedPut,
  PutObjectParams,
  StorageProvider,
} from './storage.types';

/** Extensions delivered from Cloudinary's `/video/` pipeline (everything else = image). */
const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'mov',
  'avi',
  'mkv',
  'm4v',
  'ogv',
]);

/**
 * Cloudinary storage (`STORAGE_DRIVER=cloudinary`). Unlike S3/R2 this is a
 * media platform: delivery URLs embed `f_auto,q_auto` so every stored asset is
 * served format-negotiated (WebP/AVIF) and quality-optimized from their CDN.
 *
 * Keys keep their extension (`products/<uuid>.jpg`); the Cloudinary public_id
 * is the key minus extension, and the extension picks the delivery pipeline
 * (image vs video) so `getPublicUrl`/`deleteObject` stay deterministic from
 * the key alone.
 */
@Injectable()
export class CloudinaryStorageProvider implements StorageProvider {
  private readonly cloudName: string;

  constructor(config: ConfigService) {
    const cfg =
      config.getOrThrow<StorageConfig['cloudinary']>('storage.cloudinary');
    this.cloudName = cfg.cloudName;
    cloudinary.config({
      cloud_name: cfg.cloudName,
      api_key: cfg.apiKey,
      api_secret: cfg.apiSecret,
      secure: true,
    });
  }

  async putObject({ key, body }: PutObjectParams): Promise<{ key: string }> {
    const normalized = this.normalizeKey(key);
    await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: this.publicIdFor(normalized),
          resource_type: this.resourceTypeFor(normalized),
          overwrite: true,
          invalidate: true,
        },
        (error, result) => {
          if (error || !result) {
            reject(
              error instanceof Error
                ? error
                : new Error(
                    (error as { message?: string } | undefined)?.message ??
                      'Cloudinary upload failed',
                  ),
            );
            return;
          }
          resolve(result);
        },
      );
      stream.end(body);
    });
    return { key: normalized };
  }

  getPublicUrl(key: string): string {
    const normalized = this.normalizeKey(key);
    // f_auto,q_auto = automatic format (WebP/AVIF) + quality per requesting client.
    return `https://res.cloudinary.com/${this.cloudName}/${this.resourceTypeFor(
      normalized,
    )}/upload/f_auto,q_auto/${this.publicIdFor(normalized)}`;
  }

  createPresignedPut(): Promise<PresignedPut> {
    throw new NotImplementedException(
      'Presigned uploads are not supported by the cloudinary driver; use the multipart POST .../media endpoint (or set STORAGE_DRIVER=s3).',
    );
  }

  async deleteObject(key: string): Promise<void> {
    const normalized = this.normalizeKey(key);
    // destroy() resolves with { result: 'not found' } for missing assets, so
    // the port's "must not throw if already gone" contract holds.
    await cloudinary.uploader.destroy(this.publicIdFor(normalized), {
      resource_type: this.resourceTypeFor(normalized),
      invalidate: true,
    });
  }

  private normalizeKey(key: string): string {
    return key.replace(/^\/+/, '');
  }

  /** Cloudinary public_id = key minus its extension (delivery format is separate). */
  private publicIdFor(key: string): string {
    return key.replace(/\.[^./]+$/, '');
  }

  private resourceTypeFor(key: string): 'image' | 'video' {
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    return VIDEO_EXTENSIONS.has(ext) ? 'video' : 'image';
  }
}
