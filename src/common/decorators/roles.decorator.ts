import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants';
import { Role } from '../enums';

/** Restricts a route to the given roles (enforced by RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
