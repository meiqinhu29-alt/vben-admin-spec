import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveMenuTree(userId: string) {
    // 获取用户角色
    const userRoles = await this.prisma.userRoleRelation.findMany({
      where: { userId },
      select: { roleId: true },
    });
    const roleIds = userRoles.map((ur) => ur.roleId);
    if (roleIds.length === 0) return [];

    // 通过 role_menus 找到角色拥有的菜单 ID
    const roleMenus = await this.prisma.roleMenu.findMany({
      where: { roleId: { in: roleIds } },
      select: { menuId: true },
    });
    const menuIds = [...new Set(roleMenus.map((rm) => rm.menuId))];
    if (menuIds.length === 0) return [];

    // 仅查询用户拥有权限的活动 catalog/menu
    const accessible = await this.prisma.menu.findMany({
      where: {
        id: { in: menuIds },
        status: 'active',
        type: { in: ['catalog', 'menu'] },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

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

    return [...permissions].sort();
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
      .map((m) => {
        const children = this.buildTree(menus, m.id);
        const node: any = {
          name: m.name,
          path: m.path,
          component: m.component,
          meta: m.meta,
        };
        if (children.length > 0) {
          node.children = children;
          // catalog 自动 redirect 到第一个子路由
          if (m.type === 'catalog' && children[0]?.path) {
            node.redirect = children[0].path;
          }
        }
        return { __type: m.type, ...node };
      })
      .filter((node: any) => {
        // 过滤掉没有子菜单的 catalog
        if (
          node.__type === 'catalog' &&
          (!node.children || node.children.length === 0)
        ) {
          return false;
        }
        return true;
      })
      .map(({ __type, ...rest }: any) => rest);
  }
}
