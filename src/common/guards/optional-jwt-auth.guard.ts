import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../interfaces/authenticated-request.interface';

/**
 * Optional authentication: validates a bearer token if present (populating
 * `req.user`), but never rejects an anonymous request. Used by endpoints that
 * serve both logged-in users and guests (e.g. the cart). Pair with `@Public()`
 * so the global `JwtAuthGuard` doesn't reject the request first.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Passport throws on a missing/invalid token by default; swallow that and
  // return the user (or undefined) instead.
  handleRequest<TUser = AuthenticatedUser | undefined>(
    _err: unknown,
    user: TUser,
  ): TUser {
    return user || (undefined as TUser);
  }
}
