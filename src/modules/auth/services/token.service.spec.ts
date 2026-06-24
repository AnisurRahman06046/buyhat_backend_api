import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../../../common/enums/role.enum';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const jwtService = new JwtService({});
  const configService = {
    get: () => ({
      secret: 'a'.repeat(32),
      expiresIn: '15m',
      refreshSecret: 'b'.repeat(32),
      refreshExpiresIn: '7d',
    }),
  } as unknown as ConfigService;

  const service = new TokenService(jwtService, configService);

  it('issues a token pair with a jti and the refresh TTL', async () => {
    const issued = await service.issueTokens('user-1', 'a@b.com', [
      Role.CUSTOMER,
    ]);
    expect(issued.tokens.accessToken).toEqual(expect.any(String));
    expect(issued.tokens.refreshToken).toEqual(expect.any(String));
    expect(issued.tokens.tokenType).toBe('Bearer');
    expect(issued.jti).toHaveLength(36);
    expect(issued.refreshTtlSeconds).toBe(7 * 24 * 60 * 60);
  });

  it('round-trips roles + jti through the refresh token', async () => {
    const issued = await service.issueTokens('user-1', 'a@b.com', [Role.ADMIN]);
    const payload = await service.verifyRefreshToken(
      issued.tokens.refreshToken,
    );
    expect(payload.sub).toBe('user-1');
    expect(payload.roles).toEqual([Role.ADMIN]);
    expect(payload.jti).toBe(issued.jti);
  });

  it('rejects a refresh token verified against the wrong secret', async () => {
    const issued = await service.issueTokens('user-1', 'a@b.com', [
      Role.CUSTOMER,
    ]);
    // The access token is signed with the access secret, so verifying it as a
    // refresh token (refresh secret) must fail.
    await expect(
      service.verifyRefreshToken(issued.tokens.accessToken),
    ).rejects.toBeDefined();
  });
});
