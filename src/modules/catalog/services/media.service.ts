import { randomUUID } from 'crypto';
import * as path from 'path';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { CACHE_KEYS, CacheService } from '../../../shared/cache';
import {
  PresignedPut,
  STORAGE_PROVIDER,
  StorageProvider,
} from '../../../shared/storage';
import {
  ALLOWED_MEDIA_MIME_PREFIXES,
  MEDIA_UPLOAD_HARD_LIMIT_BYTES,
} from '../catalog.constants';
import { MediaResponseDto } from '../dto/media-response.dto';
import { PresignMediaDto, RecordMediaDto } from '../dto/presign-media.dto';
import { UpdateMediaDto } from '../dto/update-media.dto';
import { UploadMediaDto } from '../dto/upload-media.dto';
import { ProductMedia } from '../entities/product-media.entity';
import { MediaType } from '../enums/media-type.enum';
import { ProductMediaRepository } from '../repositories/product-media.repository';
import { ProductRepository } from '../repositories/product.repository';
import { ProductVariantRepository } from '../repositories/product-variant.repository';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

@Injectable()
export class MediaService {
  private readonly maxBytes: number;

  constructor(
    private readonly mediaRepository: ProductMediaRepository,
    private readonly productRepository: ProductRepository,
    private readonly variantRepository: ProductVariantRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly dataSource: DataSource,
    private readonly cache: CacheService,
    config: ConfigService,
  ) {
    this.maxBytes = Math.min(
      config.get<number>('storage.maxFileBytes') ??
        MEDIA_UPLOAD_HARD_LIMIT_BYTES,
      MEDIA_UPLOAD_HARD_LIMIT_BYTES,
    );
  }

  /** Server-proxied multipart upload (D7 default path). */
  async upload(
    productId: string,
    file: Express.Multer.File | undefined,
    dto: UploadMediaDto,
  ): Promise<MediaResponseDto> {
    await this.assertProduct(productId);
    if (!file) throw new BadRequestException('A "file" upload is required');
    const type = this.mediaTypeFor(file.mimetype);
    if (file.size > this.maxBytes) {
      throw new BadRequestException(
        `File exceeds the ${Math.floor(this.maxBytes / (1024 * 1024))}MB limit`,
      );
    }
    await this.assertVariant(productId, dto.variantId);

    const key = this.buildKey(productId, this.extFor(file));
    await this.storage.putObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    return this.persist(productId, {
      variantId: dto.variantId ?? null,
      type,
      storageKey: key,
      url: this.storage.getPublicUrl(key),
      alt: dto.alt ?? null,
      isPrimary: dto.isPrimary,
      position: dto.position,
    });
  }

  /** Record a row after a presigned direct upload (D7 S3 path). */
  async record(
    productId: string,
    dto: RecordMediaDto,
  ): Promise<MediaResponseDto> {
    await this.assertProduct(productId);
    await this.assertVariant(productId, dto.variantId);
    return this.persist(productId, {
      variantId: dto.variantId ?? null,
      type: this.mediaTypeFor(dto.contentType),
      storageKey: dto.key,
      url: this.storage.getPublicUrl(dto.key),
      alt: dto.alt ?? null,
      isPrimary: dto.isPrimary,
      position: undefined,
    });
  }

  /** Presigned PUT URL for direct-to-S3 upload (throws on the local driver). */
  async presign(
    productId: string,
    dto: PresignMediaDto,
  ): Promise<PresignedPut> {
    await this.assertProduct(productId);
    await this.assertVariant(productId, dto.variantId);
    this.mediaTypeFor(dto.contentType); // validate mime
    const key = this.buildKey(productId, path.extname(dto.fileName));
    return this.storage.createPresignedPut({
      key,
      contentType: dto.contentType,
    });
  }

  async listForProduct(productId: string): Promise<MediaResponseDto[]> {
    await this.assertProduct(productId);
    const rows = await this.mediaRepository.findByProduct(productId);
    return rows.map((m) => MediaResponseDto.fromEntity(m));
  }

  async update(id: string, dto: UpdateMediaDto): Promise<MediaResponseDto> {
    const media = await this.mediaRepository.findById(id);
    if (!media) throw new NotFoundException(`Media ${id} not found`);

    await this.dataSource.transaction(async (manager) => {
      if (dto.isPrimary === true) {
        await manager.update(
          ProductMedia,
          { productId: media.productId },
          { isPrimary: false },
        );
        media.isPrimary = true;
      } else if (dto.isPrimary === false) {
        media.isPrimary = false;
      }
      if (dto.alt !== undefined) media.alt = dto.alt ?? null;
      if (dto.position !== undefined) media.position = dto.position;
      await manager.save(media);
    });
    await this.cache.delByPrefix(CACHE_KEYS.productPrefix());
    return MediaResponseDto.fromEntity(media);
  }

  async remove(id: string): Promise<void> {
    const media = await this.mediaRepository.findById(id);
    if (!media) throw new NotFoundException(`Media ${id} not found`);
    if (media.storageKey) {
      await this.storage.deleteObject(media.storageKey);
    }
    await this.mediaRepository.hardDelete(id);
    await this.cache.delByPrefix(CACHE_KEYS.productPrefix());
  }

  // --- helpers ---

  /** Insert a media row, enforcing "first image is primary" + single-primary. */
  private async persist(
    productId: string,
    data: {
      variantId: string | null;
      type: MediaType;
      storageKey: string;
      url: string;
      alt: string | null;
      isPrimary?: boolean;
      position?: number;
    },
  ): Promise<MediaResponseDto> {
    const existing = await this.mediaRepository.countByProduct(productId);
    const makePrimary = data.isPrimary === true || existing === 0;
    const position =
      data.position ?? (await this.mediaRepository.maxPosition(productId)) + 1;

    let saved!: ProductMedia;
    await this.dataSource.transaction(async (manager) => {
      if (makePrimary) {
        await manager.update(ProductMedia, { productId }, { isPrimary: false });
      }
      saved = await manager.save(
        manager.create(ProductMedia, {
          productId,
          variantId: data.variantId,
          type: data.type,
          storageKey: data.storageKey,
          url: data.url,
          alt: data.alt,
          isPrimary: makePrimary,
          position,
        }),
      );
    });
    await this.cache.delByPrefix(CACHE_KEYS.productPrefix());
    return MediaResponseDto.fromEntity(saved);
  }

  private async assertProduct(productId: string): Promise<void> {
    if (!(await this.productRepository.exists({ id: productId }))) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
  }

  private async assertVariant(
    productId: string,
    variantId?: string,
  ): Promise<void> {
    if (!variantId) return;
    const variant = await this.variantRepository.findById(variantId);
    if (!variant || variant.productId !== productId) {
      throw new BadRequestException(
        `Variant ${variantId} does not belong to product ${productId}`,
      );
    }
  }

  private mediaTypeFor(mime: string): MediaType {
    if (!ALLOWED_MEDIA_MIME_PREFIXES.some((p) => mime?.startsWith(p))) {
      throw new BadRequestException(
        `Unsupported media type "${mime}" (allowed: ${ALLOWED_MEDIA_MIME_PREFIXES.join(', ')}*)`,
      );
    }
    return mime.startsWith('video/') ? MediaType.VIDEO : MediaType.IMAGE;
  }

  private extFor(file: Express.Multer.File): string {
    return (
      path.extname(file.originalname) ||
      MIME_EXT[file.mimetype] ||
      ''
    ).toLowerCase();
  }

  private buildKey(productId: string, ext: string): string {
    return `catalog/products/${productId}/${randomUUID()}${ext}`;
  }
}
