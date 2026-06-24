import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../constants';
import { Role } from '../enums';
import { AuthenticatedRequest } from '../interfaces';

/**
 * RBAC guard. Allows the request if the user holds at least one of the
 * roles declared via @Roles(). Routes without @Roles() are unrestricted
 * (authentication is still enforced separately by JwtAuthGuard).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const hasRole = user?.roles?.some((role) => requiredRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions for this resource');
    }
    return true;
  }
}
