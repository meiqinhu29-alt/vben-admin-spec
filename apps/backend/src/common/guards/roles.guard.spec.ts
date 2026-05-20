import type { ExecutionContext } from '@nestjs/common';

import { describe, expect, it, vi } from 'vitest';

import { RolesGuard } from './roles.guard';

function makeCtx(user: null | { roles: string[] }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => null,
    getClass: () => null,
  } as never;
}

describe('rolesGuard', () => {
  it('allows when no roles required', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    };
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(makeCtx({ roles: ['staff'] }))).toBe(true);
  });

  it('allows when user role matches one of the required', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['finance', 'admin']),
    };
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(makeCtx({ roles: ['finance'] }))).toBe(true);
  });

  it('denies when user role missing from required', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['admin']),
    };
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(makeCtx({ roles: ['staff'] }))).toBe(false);
  });

  it('denies when no user in context', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['admin']),
    };
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(makeCtx(null))).toBe(false);
  });
});
