import { Injectable } from '@nestjs/common';
import { UserRole } from '@vben/types';

import {
  type MenuItem,
  ROLE_CODES_MAP,
  ROLE_MENU_MAP,
} from './menu-permissions.config';

@Injectable()
export class MenuService {
  getMenuByRole(role: string): MenuItem[] {
    const userRole = role as UserRole;
    return ROLE_MENU_MAP[userRole] ?? [];
  }

  getCodesByRole(role: string): string[] {
    const userRole = role as UserRole;
    return ROLE_CODES_MAP[userRole] ?? [];
  }
}
