import { randomUUID } from 'crypto';
import * as path from 'path';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { STORAGE_PROVIDER, StorageProvider } from '../../../shared/storage';
import {
  CMS_ALLOWED_IMAGE_PREFIX,
  CMS_MEDIA_UPLOAD_LIMIT_BYTES,
} from '../cms.constants';
import { MediaUploadResponseDto } from '../dto/media-upload-response.dto';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
};

/**
 * CMS image upload (D47). Stores bytes via the shared StorageModule (local-disk
 * dev / S3 prod) and returns the public URL to drop into a banner/popup/section
 * payload. Standalone (not tied to a product) so hero/banner/popup images are
 * self-managed.
 */
@Injectable()
export class CmsMediaService {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async upload(
    file: Express.Multer.File | undefined,
  ): Promise<MediaUploadResponseDto> {
    if (!file) throw new BadRequestException('A "file" upload is required');
    if (!file.mimetype.startsWith(CMS_ALLOWED_IMAGE_PREFIX)) {
      throw new BadRequestException('Only image uploads are allowed');
    }
    if (file.size > CMS_MEDIA_UPLOAD_LIMIT_BYTES) {
      throw new BadRequestException(
        `File exceeds the ${Math.floor(
          CMS_MEDIA_UPLOAD_LIMIT_BYTES / (1024 * 1024),
        )}MB limit`,
      );
    }

    const ext = (
      path.extname(file.originalname) ||
      MIME_EXT[file.mimetype] ||
      ''
    ).toLowerCase();
    const key = `cms/${randomUUID()}${ext}`;
    await this.storage.putObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const dto = new MediaUploadResponseDto();
    dto.key = key;
    dto.url = this.storage.getPublicUrl(key);
    return dto;
  }
}
