import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../../common/interfaces/authenticated-request.interface';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';

/**
 * Passport "jwt" strategy. Registered as a provider in AuthModule, it wires
 * itself into passport at boot — which is what makes the globally-registered
 * `JwtAuthGuard` (AuthGuard('jwt')) functional across the whole app.
 *
 * `validate()` runs only after the signature + expiry have been verified; its
 * return value becomes `request.user` (typed as AuthenticatedUser).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
    };
  }
}
