import { CacheService } from './cache.service';

// MVP: CacheService is a Redis-free no-op — `getOrSet` always runs the loader
// and `del`/`delByPrefix` do nothing. These tests pin that contract so callers
// keep behaving correctly without a cache.
describe('CacheService (no-op)', () => {
  it('getOrSet always runs the loader and returns its value', async () => {
    const service = new CacheService();
    const loader = jest.fn().mockResolvedValue({ v: 42 });

    const result = await service.getOrSet('k', 60, loader);

    expect(result).toEqual({ v: 42 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('getOrSet runs the loader again on every call (no caching)', async () => {
    const service = new CacheService();
    const loader = jest.fn().mockResolvedValue('x');

    await service.getOrSet('k', 60, loader);
    await service.getOrSet('k', 60, loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('del / delByPrefix resolve without error', async () => {
    const service = new CacheService();

    await expect(service.del('a', 'b')).resolves.toBeUndefined();
    await expect(service.delByPrefix('prefix:')).resolves.toBeUndefined();
  });
});
