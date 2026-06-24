import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { JwtConfig } from '../../../config/configuration';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { Role } from '../../../common/enums/role.enum';
import { AuthTokensDto } from '../dto/auth-tokens.dto';

/**
 * Result of issuing a token pair. `jti` and `refreshTtlSeconds` let the caller
 * register the refresh token in the revocation store (see RefreshTokenStore).
 */
export interface IssuedTokens {
  tokens: AuthTokensDto;
  jti: string;
  refreshTtlSeconds: number;
}

/** Parse a JWT-style duration ('15m', '7d', '3600', '12h') into seconds. */
function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) {
    return 0;
  }
  const amount = parseInt(match[1], 10);
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3_600,
    d: 86_400,
  };
  return amount * multipliers[unit];
}

/**
 * Single-responsibility token factory. Isolates all JWT signing/verification so
 * AuthService stays focused on the auth use-cases, and so swapping the token
 * scheme (e.g. to asymmetric RS256 keys) touches exactly one class.
 */
@Injectable()
export class TokenService {
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtConfig = this.configService.get<JwtConfig>('jwt')!;
  }

  async issueTokens(
    userId: string,
    email: string,
    roles: Role[],
  ): Promise<IssuedTokens> {
    // Unique id for this refresh token, embedded as the `jti` claim so the
    // token can be tracked (rotated/revoked) in RefreshTokenStore.
    const jti = randomUUID();
    const payload: JwtPayload = { sub: userId, email, roles };

    // `expiresIn` accepts the ms string format ('15m', '7d'); cast because the
    // jsonwebtoken types model it as a narrow template type, not plain string.
    const accessOptions: JwtSignOptions = {
      secret: this.jwtConfig.secret,
      expiresIn: this.jwtConfig.expiresIn as JwtSignOptions['expiresIn'],
    };
    const refreshOptions: JwtSignOptions = {
      secret: this.jwtConfig.refreshSecret,
      expiresIn: this.jwtConfig.refreshExpiresIn as JwtSignOptions['expiresIn'],
      jwtid: jti,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, accessOptions),
      this.jwtService.signAsync(payload, refreshOptions),
    ]);

    return {
      tokens: { accessToken, refreshToken, tokenType: 'Bearer' },
      jti,
      refreshTtlSeconds: parseDurationToSeconds(
        this.jwtConfig.refreshExpiresIn,
      ),
    };
  }

  /** Verifies a refresh token against the refresh secret; throws if invalid. */
  verifyRefreshToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.jwtConfig.refreshSecret,
    });
  }
}
