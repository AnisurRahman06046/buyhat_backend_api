import { Role } from '../enums';

export type TokenType = 'access' | 'refresh';

/** Decoded JWT claims. `sub` is the user id. */
export interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[];
  type: TokenType;
  /** JWT id — useful for refresh-token rotation / revocation. */
  jti?: string;
}
