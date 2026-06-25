import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  const guard = new OptionalJwtAuthGuard();

  it('returns the authenticated user when present', () => {
    const user = { id: 'u1', email: 'a@b.com', roles: [] };
    expect(guard.handleRequest(null, user)).toBe(user);
  });

  it('returns undefined for an anonymous request instead of throwing', () => {
    expect(guard.handleRequest(null, false as never)).toBeUndefined();
  });

  it('does not throw even when passport reports an error', () => {
    expect(() =>
      guard.handleRequest(new Error('no token'), undefined),
    ).not.toThrow();
    expect(
      guard.handleRequest(new Error('no token'), undefined),
    ).toBeUndefined();
  });
});
