import { NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudinaryStorageProvider } from './cloudinary-storage.provider';

describe('CloudinaryStorageProvider', () => {
  let provider: CloudinaryStorageProvider;

  beforeEach(() => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue({
        cloudName: 'demo-cloud',
        apiKey: 'key',
        apiSecret: 'secret',
      }),
    } as unknown as ConfigService;
    provider = new CloudinaryStorageProvider(config);
  });

  describe('getPublicUrl', () => {
    it('builds an image URL with f_auto,q_auto and the extension stripped', () => {
      expect(provider.getPublicUrl('products/abc-123.jpg')).toBe(
        'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/products/abc-123',
      );
    });

    it('routes video extensions through the video pipeline', () => {
      expect(provider.getPublicUrl('products/clip.mp4')).toBe(
        'https://res.cloudinary.com/demo-cloud/video/upload/f_auto,q_auto/products/clip',
      );
    });

    it('normalizes leading slashes', () => {
      expect(provider.getPublicUrl('/cms/banner.png')).toBe(
        'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/cms/banner',
      );
    });

    it('leaves extensionless keys untouched', () => {
      expect(provider.getPublicUrl('cms/raw-key')).toBe(
        'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/cms/raw-key',
      );
    });
  });

  it('createPresignedPut throws NotImplemented (multipart is the default path)', () => {
    expect(() => provider.createPresignedPut()).toThrow(
      NotImplementedException,
    );
  });
});
