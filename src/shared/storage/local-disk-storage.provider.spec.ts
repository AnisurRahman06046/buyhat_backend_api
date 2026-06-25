import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';

function providerWith(
  root: string,
  publicUrl: string,
): LocalDiskStorageProvider {
  const config = {
    get: (key: string) => (key === 'storage.local.root' ? root : publicUrl),
  } as unknown as ConfigService;
  return new LocalDiskStorageProvider(config);
}

describe('LocalDiskStorageProvider', () => {
  describe('getPublicUrl', () => {
    it('joins the public base with the key, trimming slashes', () => {
      const provider = providerWith('./storage/uploads', '/uploads/');
      expect(provider.getPublicUrl('catalog/products/a/x.jpg')).toBe(
        '/uploads/catalog/products/a/x.jpg',
      );
      expect(provider.getPublicUrl('/leading.jpg')).toBe(
        '/uploads/leading.jpg',
      );
    });
  });

  describe('createPresignedPut', () => {
    it('is unsupported on the local driver', () => {
      const provider = providerWith('./storage/uploads', '/uploads');
      expect(() => provider.createPresignedPut()).toThrow(
        NotImplementedException,
      );
    });
  });

  describe('put/delete round-trip', () => {
    let root: string;
    beforeAll(async () => {
      root = await fs.mkdtemp(path.join(os.tmpdir(), 'buyhat-storage-'));
    });
    afterAll(async () => {
      await fs.rm(root, { recursive: true, force: true });
    });

    it('writes, then deletes (idempotently) under nested keys', async () => {
      const provider = providerWith(root, '/uploads');
      const key = 'catalog/products/p1/file.png';

      await provider.putObject({
        key,
        body: Buffer.from('hello'),
        contentType: 'image/png',
      });
      expect((await fs.readFile(path.join(root, key))).toString()).toBe(
        'hello',
      );

      await provider.deleteObject(key);
      await expect(fs.access(path.join(root, key))).rejects.toBeDefined();
      // deleting a missing object must not throw
      await expect(provider.deleteObject(key)).resolves.toBeUndefined();
    });

    it('rejects path traversal outside the root', async () => {
      const provider = providerWith(root, '/uploads');
      await expect(
        provider.putObject({
          key: '../escape.png',
          body: Buffer.from('x'),
          contentType: 'image/png',
        }),
      ).rejects.toThrow(/Illegal storage key/);
    });
  });
});
