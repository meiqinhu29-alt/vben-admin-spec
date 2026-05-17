import { Controller, Get } from '@nestjs/common';

import {
  type AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { MenuService } from './menu.service';

@Controller()
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get('menu/all')
  async getMenus(@CurrentUser() user: AuthUser) {
    return this.menu.getMenuByRole(user.role);
  }

  @Get('auth/codes')
  async getCodes(@CurrentUser() user: AuthUser) {
    return this.menu.getCodesByRole(user.role);
  }
}
