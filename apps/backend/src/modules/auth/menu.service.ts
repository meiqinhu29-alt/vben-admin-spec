import { Injectable } from '@nestjs/common';

import { PermissionsService } from '../permissions/permissions.service';

@Injectable()
export class MenuService {
  constructor(private readonly permissions: PermissionsService) {}

  async getCodesByUserId(userId: string): Promise<string[]> {
    return this.permissions.resolvePermissions(userId);
  }

  async getMenusByUserId(userId: string) {
    return this.permissions.resolveMenuTree(userId);
  }
}
