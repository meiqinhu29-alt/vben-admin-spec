import type { ExecutionContext } from '@nestjs/common';

import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { RolesGuard } from './roles.guard';

function makeCtx(user: null | { role: string }): ExecutionContext {
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
    expect(guard.canActivate(makeCtx({ role: 'staff' }))).toBe(true);
  });

  it('allows when user role matches one of the required', () => {
    const reflector = {
      getAllAndOverride: vi
        .fn()
        .mockReturnValue([UserRole.finance, UserRole.admin]),
    };
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(makeCtx({ role: 'finance' }))).toBe(true);
  });

  it('denies when user role missing from required', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.admin]),
    };
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(makeCtx({ role: 'staff' }))).toBe(false);
  });

  it('denies when no user in context', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.admin]),
    };
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(makeCtx(null))).toBe(false);
  });
});
