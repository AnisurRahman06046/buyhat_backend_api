import { Request } from 'express';
import { Role } from '../enums/role.enum';

/**
 * The user object attached to `request.user` by the JWT strategy /
 * authentication guard. Keep this minimal and serializable.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: Role[];
}

/**
 * Express request enriched with the authenticated user.
 * Controllers receive this (via @CurrentUser) only on guarded routes.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
