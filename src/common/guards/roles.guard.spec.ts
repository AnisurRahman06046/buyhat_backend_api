import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { AuthenticatedUser } from '../interfaces/authenticated-request.interface';
import { RolesGuard } from './roles.guard';

function makeContext(user?: Partial<AuthenticatedUser>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const requireRoles = (roles?: Role[]) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  it('allows any authenticated user when no roles are required', () => {
    requireRoles(undefined);
    expect(guard.canActivate(makeContext({ roles: [Role.CUSTOMER] }))).toBe(
      true,
    );
  });

  it('allows when the user has at least one required role (OR semantics)', () => {
    requireRoles([Role.ADMIN, Role.CUSTOMER_SUPPORT]);
    expect(
      guard.canActivate(makeContext({ roles: [Role.CUSTOMER_SUPPORT] })),
    ).toBe(true);
  });

  it('denies when the user has none of the required roles', () => {
    requireRoles([Role.ADMIN]);
    expect(() =>
      guard.canActivate(makeContext({ roles: [Role.CUSTOMER] })),
    ).toThrow(ForbiddenException);
  });

  it('denies when there is no authenticated user', () => {
    requireRoles([Role.ADMIN]);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
