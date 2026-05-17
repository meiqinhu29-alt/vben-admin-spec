import type { CanActivate, ExecutionContext } from '@nestjs/common';

import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = ctx
      .switchToHttp()
      .getRequest<{ user?: { roles?: string[] } }>();
    const userRoles = req.user?.roles ?? [];
    if (userRoles.length === 0) return false;
    return required.some((r) => userRoles.includes(r));
  }
}
