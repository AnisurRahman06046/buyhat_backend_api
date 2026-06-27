import type { RedisService } from '../redis/redis.service';
import { CacheService } from './cache.service';

interface MockClient {
  get: jest.Mock;
  set: jest.Mock;
  eval: jest.Mock;
  del: jest.Mock;
  scan: jest.Mock;
}

const makeClient = (): MockClient => ({
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
  eval: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  scan: jest.fn().mockResolvedValue(['0', []]),
});

const makeService = (client: MockClient): CacheService =>
  new CacheService({ getClient: () => client } as unknown as RedisService);

describe('CacheService.getOrSet', () => {
  it('returns the cached value without calling the loader', async () => {
    const client = makeClient();
    client.get.mockResolvedValue(JSON.stringify({ hi: 1 }));
    const loader = jest.fn();
    const service = makeService(client);

    const result = await service.getOrSet('k', 60, loader);

    expect(result).toEqual({ hi: 1 });
    expect(loader).not.toHaveBeenCalled();
  });

  it('on a miss, the lock winner computes once and caches', async () => {
    const client = makeClient();
    client.get.mockResolvedValue(null); // miss + double-check both empty
    client.set.mockResolvedValue('OK'); // acquires the lock
    const loader = jest.fn().mockResolvedValue({ v: 42 });
    const service = makeService(client);

    const result = await service.getOrSet('k', 60, loader);

    expect(result).toEqual({ v: 42 });
    expect(loader).toHaveBeenCalledTimes(1);
    // a value SET (EX) happened in addition to the lock SET (NX)
    const setCalls = client.set.mock.calls as unknown[][];
    expect(setCalls.some((args) => args.includes('EX'))).toBe(true);
  });

  it('a lock loser waits and reads the winner value (no loader call)', async () => {
    const client = makeClient();
    client.get
      .mockResolvedValueOnce(null) // initial miss
      .mockResolvedValue(JSON.stringify({ v: 7 })); // winner published it
    client.set.mockResolvedValue(null); // did NOT acquire the lock
    const loader = jest.fn();
    const service = makeService(client);

    const result = await service.getOrSet('k', 60, loader);

    expect(result).toEqual({ v: 7 });
    expect(loader).not.toHaveBeenCalled();
  });

  it('fails open: a Redis get error falls through to the loader', async () => {
    const client = makeClient();
    client.get.mockRejectedValue(new Error('redis down'));
    client.set.mockResolvedValue('OK');
    const loader = jest.fn().mockResolvedValue({ ok: true });
    const service = makeService(client);

    const result = await service.getOrSet('k', 60, loader);

    expect(result).toEqual({ ok: true });
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
