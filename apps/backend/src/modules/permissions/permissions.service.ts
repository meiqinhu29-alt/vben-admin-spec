import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveMenuTree(userId: string) {
    const permissions = await this.resolvePermissions(userId);
    const allMenus = await this.prisma.menu.findMany({
      where: { status: 'active', type: { in: ['catalog', 'menu'] } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    // A menu is accessible if it has no authCode OR its authCode is in permissions
    const accessible = allMenus.filter(
      (m) => !m.authCode || permissions.includes(m.authCode),
    );

    return this.buildTree(accessible);
  }

  async resolvePermissions(userId: string): Promise<string[]> {
    // 1. Get user's role IDs
    const userRoles = await this.prisma.userRoleRelation.findMany({
      where: { userId },
      select: { roleId: true },
    });
    const roleIds = userRoles.map((ur) => ur.roleId);

    const permissions = new Set<string>();

    // 2. Get all authCodes from role_menus where menu has authCode and is active
    if (roleIds.length > 0) {
      const roleMenus = await this.prisma.roleMenu.findMany({
        where: {
          roleId: { in: roleIds },
          menu: { authCode: { not: null }, status: 'active' },
        },
        include: { menu: { select: { authCode: true } } },
      });
      for (const rm of roleMenus) {
        if (rm.menu.authCode) permissions.add(rm.menu.authCode);
      }
    }

    // 3. Apply user-level overrides
    const userPerms = await this.prisma.userPermission.findMany({
      where: { userId },
    });
    for (const p of userPerms) {
      if (p.effect === 'grant') permissions.add(p.authCode);
      else permissions.delete(p.authCode);
    }

    return [...permissions].toSorted();
  }

  async resolveUserRoleCodes(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRoleRelation.findMany({
      where: { userId, role: { status: 'active' } },
      include: { role: { select: { code: true } } },
    });
    return userRoles.map((ur) => ur.role.code);
  }

  private buildTree(menus: any[], parentId: null | string = null): any[] {
    return menus
      .filter((m) => m.parentId === parentId)
      .map((m) => ({
        name: m.name,
        path: m.path,
        component: m.component,
        meta: m.meta,
        children: this.buildTree(menus, m.id),
      }))
      .map((m) =>
        m.children.length === 0 ? { ...m, children: undefined } : m,
      );
  }
}
