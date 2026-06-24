import { Request } from 'express';
import { AuthenticatedUser } from './authenticated-user.interface';

/**
 * Express request after JWT validation. The correlation `id` is provided
 * globally by pino-http's type augmentation, so it is not re-declared here.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
