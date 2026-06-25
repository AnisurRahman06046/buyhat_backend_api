import { promises as fs } from 'fs';
import * as path from 'path';
import { Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PresignedPut,
  PutObjectParams,
  StorageProvider,
} from './storage.types';

/**
 * Local filesystem storage (dev default). Writes objects under
 * `STORAGE_LOCAL_ROOT`; files are served as static assets at the
 * `STORAGE_PUBLIC_URL` prefix (wired in `main.ts`). Good for a single VPS.
 */
@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly root: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(
      config.get<string>('storage.local.root') ?? './storage/uploads',
    );
    this.publicUrl = (
      config.get<string>('storage.publicUrl') ?? '/uploads'
    ).replace(/\/+$/, '');
  }

  async putObject({ key, body }: PutObjectParams): Promise<{ key: string }> {
    const target = this.resolveKey(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    return { key };
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key.replace(/^\/+/, '')}`;
  }

  createPresignedPut(): Promise<PresignedPut> {
    throw new NotImplementedException(
      'Presigned uploads are not supported by the local-disk driver; use the multipart POST .../media endpoint (or set STORAGE_DRIVER=s3).',
    );
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolveKey(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  /** Resolve a key under the root, rejecting path traversal outside it. */
  private resolveKey(key: string): string {
    const target = path.resolve(this.root, key);
    if (target !== this.root && !target.startsWith(this.root + path.sep)) {
      throw new Error(`Illegal storage key "${key}"`);
    }
    return target;
  }
}
