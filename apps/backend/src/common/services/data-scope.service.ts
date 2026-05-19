import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

export type DataScopeMode = 'all' | 'shop' | 'self';

export interface UserDataScope {
  scope: DataScopeMode;
  shopIds: string[]; // 仅 scope='shop' 时有意义
}

@Injectable()
export class DataScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 解析用户的数据权限范围，多角色取最宽松的。
   * - 任一角色为 all → all
   * - 否则任一角色为 shop → shop
   * - 全部为 self → self
   */
  async resolveUserScope(userId: string): Promise<UserDataScope> {
    const userRoles = await this.prisma.userRoleRelation.findMany({
      where: { userId, role: { status: 'active' } },
      include: { role: { select: { dataScope: true } } },
    });

    if (userRoles.length === 0) {
      return { scope: 'self', shopIds: [] };
    }

    const scopes = userRoles.map((ur) => ur.role.dataScope);

    let scope: DataScopeMode;
    if (scopes.includes('all')) {
      scope = 'all';
    } else if (scopes.includes('shop')) {
      scope = 'shop';
    } else {
      scope = 'self';
    }

    let shopIds: string[] = [];
    if (scope === 'shop' || scope === 'self') {
      // self 范围在涉及店铺关联资源时仍需限定到用户有权访问的店铺
      const access = await this.prisma.userShopAccess.findMany({
        where: { userId },
        select: { shopId: true },
      });
      shopIds = access.map((a) => a.shopId);
    }

    return { scope, shopIds };
  }
}
