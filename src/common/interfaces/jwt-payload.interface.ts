import { Role } from '../enums/role.enum';

/**
 * Decoded JWT access-token payload.
 * `sub` is the standard subject claim (the user id).
 */
export interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[];
  /** Refresh-token id (JWT `jti` claim) — used for rotation & revocation. */
  jti?: string;
  iat?: number;
  exp?: number;
}
