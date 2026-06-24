import { Role } from '../enums';

/** Shape attached to `request.user` after JWT validation. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: Role[];
}
