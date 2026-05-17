import type { AuthUser } from '../../common/decorators/current-user.decorator';

import { Controller, Get, NotFoundException } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('user/info')
  async getCurrentUserInfo(@CurrentUser() user: AuthUser) {
    const fresh = await this.users.findById(user.userId);
    if (!fresh) throw new NotFoundException('User not found');

    return {
      id: fresh.id,
      username: fresh.username,
      displayName: fresh.displayName,
      roles: fresh.userRoles.map((ur) => ur.role.code),
      shopIds: fresh.shopAccess.map((s) => s.shopId),
    };
  }
}
