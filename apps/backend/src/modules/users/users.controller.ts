import { Controller, Get, NotFoundException } from '@nestjs/common';

import {
  type AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('user/info')
  async getCurrentUserInfo(@CurrentUser() user: AuthUser) {
    const fresh = await this.users.findById(user.id);
    if (!fresh) throw new NotFoundException('User not found');

    return {
      id: fresh.id,
      username: fresh.username,
      displayName: fresh.displayName,
      role: fresh.role,
      shopIds: fresh.shopAccess.map((s) => s.shopId),
    };
  }
}
