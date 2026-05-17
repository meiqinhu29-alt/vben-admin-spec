import type { MenuItem } from './menu-permissions.config';

import { UserRole } from '@vben/types';

import { Injectable } from '@nestjs/common';

import { ROLE_CODES_MAP, ROLE_MENU_MAP } from './menu-permissions.config';

@Injectable()
export class MenuService {
  getCodesByRole(role: string): string[] {
    const userRole = role as UserRole;
    return ROLE_CODES_MAP[userRole] ?? [];
  }

  getMenuByRole(role: string): MenuItem[] {
    const userRole = role as UserRole;
    return ROLE_MENU_MAP[userRole] ?? [];
  }
}
