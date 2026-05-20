# 计划 #2：完整多角色 RBAC 系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现完整的多角色 RBAC 权限系统：用户可拥有多个角色，角色关联菜单/按钮权限点，支持用户级额外授权（grant/deny）。包含后端 API + 前端管理页面（角色管理、菜单管理、用户角色分配）。完成后管理员能在网页上动态配置角色权限，无需发版。

**Architecture:** 采用 vben-admin playground 的统一菜单树模型（menus 表含 catalog/menu/button/link/embedded 五种类型），button 类型节点作为按钮级权限点。角色通过 role_menus 关联表绑定权限。用户通过 user_roles 多对多关联角色（支持一人多角色），权限解析为所有角色权限的并集。user_permissions 表支持用户级额外 grant/deny 覆盖。

**Tech Stack:** NestJS 11 + Prisma 6 + PostgreSQL（已有），Vue 3 + Naive UI（已有），class-validator DTO，Vitest e2e 测试。

**Breaking Change:** 删除现有 `users.role` enum 字段，改用 `user_roles` 多对多关联。无旧数据需迁移。

---

## 数据库表设计

```sql
-- 角色表
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) UNIQUE NOT NULL,   -- 如 'admin', 'finance'
  name        VARCHAR(100) NOT NULL,          -- 如 '系统管理员', '财务'
  description VARCHAR(500),
  status      VARCHAR(20) DEFAULT 'active',   -- active | inactive
  is_system   BOOLEAN DEFAULT false,          -- 系统内置角色不可删
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 菜单/权限点统一树
CREATE TABLE menus (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID REFERENCES menus(id) ON DELETE SET NULL,
  type        VARCHAR(20) NOT NULL,           -- catalog | menu | button | link | embedded
  name        VARCHAR(100) NOT NULL,          -- 路由 name（唯一）
  path        VARCHAR(200),                   -- 路由 path
  component   VARCHAR(200),                   -- 组件路径或 layout 名
  auth_code   VARCHAR(100) UNIQUE,            -- 权限标识（button 必填）
  meta        JSONB DEFAULT '{}',             -- {title, icon, order, ...}
  status      VARCHAR(20) DEFAULT 'active',
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 角色 ↔ 菜单/权限 多对多
CREATE TABLE role_menus (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  menu_id UUID REFERENCES menus(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, menu_id)
);

-- 用户 ↔ 角色 多对多
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- 用户额外权限（覆盖角色）
CREATE TABLE user_permissions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  auth_code VARCHAR(100) NOT NULL,
  effect    VARCHAR(10) NOT NULL,             -- 'grant' | 'deny'
  UNIQUE(user_id, auth_code)
);
```

## 权限解析算法

```
effective_permissions(userId) =
  UNION(role.menus.authCode for role in user.roles where role.status='active')
  + user_permissions where effect='grant'
  - user_permissions where effect='deny'
```

---

## File Structure Overview

### 新建文件

```
apps/backend/
├── prisma/migrations/<ts>_rbac_tables/
└── src/modules/
    ├── roles/
    │   ├── roles.module.ts
    │   ├── roles.service.ts
    │   ├── roles.controller.ts
    │   └── dto/
    │       ├── create-role.dto.ts
    │       └── update-role.dto.ts
    ├── menus/
    │   ├── menus.module.ts
    │   ├── menus.service.ts
    │   ├── menus.controller.ts
    │   └── dto/
    │       ├── create-menu.dto.ts
    │       └── update-menu.dto.ts
    └── permissions/
        ├── permissions.module.ts
        └── permissions.service.ts    ← 权限解析核心

apps/backend/test/integration/
├── roles.e2e-spec.ts
├── menus.e2e-spec.ts
└── permissions.e2e-spec.ts

apps/web-naive/src/
├── api/system/
│   ├── role.ts
│   └── menu.ts
└── views/system/
    ├── role/
    │   ├── index.vue
    │   └── components/
    │       └── role-form-modal.vue
    └── menu/
        ├── index.vue
        └── components/
            └── menu-form-modal.vue
```

### 修改文件

```
apps/backend/prisma/schema.prisma              ← 删 UserRole enum, 加 5 新模型
apps/backend/prisma/seed.ts                    ← 重写: seed 角色 + 菜单 + 关联
apps/backend/src/app.module.ts                 ← imports 加新模块
apps/backend/src/common/decorators/current-user.decorator.ts  ← AuthUser 改多角色
apps/backend/src/common/decorators/roles.decorator.ts         ← 改为 string[]
apps/backend/src/common/guards/roles.guard.ts                 ← 多角色判断
apps/backend/src/common/guards/roles.guard.spec.ts            ← 更新测试
apps/backend/src/modules/auth/strategies/jwt.strategy.ts      ← payload 含 roles
apps/backend/src/modules/auth/auth.service.ts                 ← login 返回 roles
apps/backend/src/modules/auth/menu.service.ts                 ← 改为 DB 查询
apps/backend/src/modules/auth/menu-permissions.config.ts      ← 删除
apps/backend/src/modules/auth/menu.controller.ts              ← 改参数
apps/backend/src/modules/users/users.service.ts               ← include roles
apps/backend/src/modules/users/users.controller.ts            ← 返回 roles
apps/backend/test/integration/*.e2e-spec.ts                   ← 全部更新 seed 方式
```

---

## Task 1: Prisma schema — 删旧 enum + 加 RBAC 表

**Files:**

- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Step 1: 修改 schema.prisma**

删除 `enum UserRole { ... }` 和 `User.role` 字段。添加 5 个新模型：Role, Menu, RoleMenu, UserRole, UserPermission。修改 User 模型移除 role 字段，加 userRoles 关系。

新增 Prisma 模型（追加到 schema.prisma 末尾）：

```prisma
enum RoleStatus {
  active
  inactive
}

enum MenuType {
  catalog
  menu
  button
  link
  embedded
}

enum MenuStatus {
  active
  inactive
}

enum PermissionEffect {
  grant
  deny
}

model Role {
  id          String     @id @default(uuid()) @db.Uuid
  code        String     @unique @db.VarChar(50)
  name        String     @db.VarChar(100)
  description String?    @db.VarChar(500)
  status      RoleStatus @default(active)
  isSystem    Boolean    @default(false) @map("is_system")
  createdAt   DateTime   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime   @updatedAt @map("updated_at") @db.Timestamptz

  roleMenus  RoleMenu[]
  userRoles  UserRoleRelation[]

  @@map("roles")
}

model Menu {
  id        String     @id @default(uuid()) @db.Uuid
  parentId  String?    @map("parent_id") @db.Uuid
  type      MenuType
  name      String     @db.VarChar(100)
  path      String?    @db.VarChar(200)
  component String?    @db.VarChar(200)
  authCode  String?    @unique @map("auth_code") @db.VarChar(100)
  meta      Json       @default("{}")
  status    MenuStatus @default(active)
  sortOrder Int        @default(0) @map("sort_order")
  createdAt DateTime   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime   @updatedAt @map("updated_at") @db.Timestamptz

  parent    Menu?      @relation("MenuTree", fields: [parentId], references: [id], onDelete: SetNull)
  children  Menu[]     @relation("MenuTree")
  roleMenus RoleMenu[]

  @@index([parentId])
  @@map("menus")
}

model RoleMenu {
  roleId String @map("role_id") @db.Uuid
  menuId String @map("menu_id") @db.Uuid

  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)
  menu Menu @relation(fields: [menuId], references: [id], onDelete: Cascade)

  @@id([roleId, menuId])
  @@map("role_menus")
}

model UserRoleRelation {
  userId String @map("user_id") @db.Uuid
  roleId String @map("role_id") @db.Uuid

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("user_roles")
}

model UserPermission {
  id       String           @id @default(uuid()) @db.Uuid
  userId   String           @map("user_id") @db.Uuid
  authCode String           @map("auth_code") @db.VarChar(100)
  effect   PermissionEffect

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, authCode])
  @@map("user_permissions")
}
```

修改 User 模型：删除 `role UserRole` 字段，加关系：

```prisma
model User {
  id           String   @id @default(uuid()) @db.Uuid
  username     String   @unique @db.VarChar(50)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  displayName  String   @map("display_name") @db.VarChar(100)
  status       UserStatus @default(active)
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz

  refreshTokens  RefreshToken[]
  shopAccess     UserShopAccess[]
  userRoles      UserRoleRelation[]
  userPermissions UserPermission[]

  @@map("users")
}
```

删除 `enum UserRole { ... }` 定义。

- [ ] **Step 2: 跑 prisma migrate**

Run: `cd apps/backend && pnpm prisma:migrate:dev --name rbac_tables`

Expected: 迁移成功，生成 SQL 文件。

- [ ] **Step 3: 同步测试库**

Run: `DATABASE_URL=postgresql://vben:vben_dev_pwd@localhost:5432/shop_bookkeeping_test pnpm prisma migrate deploy`

- [ ] **Step 4: 验证**

Run: `docker exec vben_pg_dev psql -U vben -d shop_bookkeeping -c "\dt" | grep -E "roles|menus|role_menus|user_roles|user_permissions"`

Expected: 5 张新表都存在。

- [ ] **Step 5: 提交**

```bash
git add apps/backend/prisma
git commit -m "feat(@vben/backend): add RBAC tables (roles, menus, role_menus, user_roles, user_permissions)"
```

---

## Task 2: PermissionsService — 权限解析核心

**Files:**

- Create: `apps/backend/src/modules/permissions/permissions.service.ts`
- Create: `apps/backend/src/modules/permissions/permissions.service.spec.ts`
- Create: `apps/backend/src/modules/permissions/permissions.module.ts`

- [ ] **Step 1: 写失败测试 permissions.service.spec.ts**

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { PermissionsService } from './permissions.service';

describe('permissionsService', () => {
  let service: PermissionsService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      userRoleRelation: { findMany: vi.fn() },
      roleMenu: { findMany: vi.fn() },
      userPermission: { findMany: vi.fn() },
    };
    service = new PermissionsService(prismaMock);
  });

  it('returns empty when user has no roles', async () => {
    prismaMock.userRoleRelation.findMany.mockResolvedValue([]);
    prismaMock.userPermission.findMany.mockResolvedValue([]);
    const result = await service.resolvePermissions('user1');
    expect(result).toEqual([]);
  });

  it('unions permissions from multiple roles', async () => {
    prismaMock.userRoleRelation.findMany.mockResolvedValue([
      { roleId: 'r1' },
      { roleId: 'r2' },
    ]);
    prismaMock.roleMenu.findMany.mockResolvedValue([
      { menu: { authCode: 'report:view' } },
      { menu: { authCode: 'report:create' } },
      { menu: { authCode: 'report:view' } },
    ]);
    prismaMock.userPermission.findMany.mockResolvedValue([]);
    const result = await service.resolvePermissions('user1');
    expect(result.sort()).toEqual(['report:create', 'report:view']);
  });

  it('applies user grant override', async () => {
    prismaMock.userRoleRelation.findMany.mockResolvedValue([{ roleId: 'r1' }]);
    prismaMock.roleMenu.findMany.mockResolvedValue([
      { menu: { authCode: 'report:view' } },
    ]);
    prismaMock.userPermission.findMany.mockResolvedValue([
      { authCode: 'user:manage', effect: 'grant' },
    ]);
    const result = await service.resolvePermissions('user1');
    expect(result.sort()).toEqual(['report:view', 'user:manage']);
  });

  it('applies user deny override', async () => {
    prismaMock.userRoleRelation.findMany.mockResolvedValue([{ roleId: 'r1' }]);
    prismaMock.roleMenu.findMany.mockResolvedValue([
      { menu: { authCode: 'report:view' } },
      { menu: { authCode: 'report:export' } },
    ]);
    prismaMock.userPermission.findMany.mockResolvedValue([
      { authCode: 'report:export', effect: 'deny' },
    ]);
    const result = await service.resolvePermissions('user1');
    expect(result).toEqual(['report:view']);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/backend && pnpm test:unit src/modules/permissions/permissions.service.spec.ts`

- [ ] **Step 3: 实现 permissions.service.ts**

```ts
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePermissions(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRoleRelation.findMany({
      where: { userId },
      select: { roleId: true },
    });

    const roleIds = userRoles.map((ur) => ur.roleId);

    let permissions = new Set<string>();

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

    const userPerms = await this.prisma.userPermission.findMany({
      where: { userId },
    });
    for (const p of userPerms) {
      if (p.effect === 'grant') permissions.add(p.authCode);
      else permissions.delete(p.authCode);
    }

    return Array.from(permissions).sort();
  }

  async resolveUserRoleCodes(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRoleRelation.findMany({
      where: { userId, role: { status: 'active' } },
      include: { role: { select: { code: true } } },
    });
    return userRoles.map((ur) => ur.role.code);
  }

  async resolveMenuTree(userId: string) {
    const permissions = await this.resolvePermissions(userId);
    const allMenus = await this.prisma.menu.findMany({
      where: { status: 'active', type: { in: ['catalog', 'menu'] } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const accessible = allMenus.filter(
      (m) => !m.authCode || permissions.includes(m.authCode),
    );

    return this.buildTree(accessible);
  }

  private buildTree(menus: any[], parentId: string | null = null): any[] {
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/backend && pnpm test:unit src/modules/permissions/permissions.service.spec.ts`

Expected: 4 个测试全过。

- [ ] **Step 5: 创建 permissions.module.ts**

```ts
import { Module } from '@nestjs/common';

import { PermissionsService } from './permissions.service';

@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
```

- [ ] **Step 6: 提交**

```bash
git add apps/backend/src/modules/permissions
git commit -m "feat(@vben/backend): add PermissionsService with multi-role union + user override"
```

---

## Task 3-13: 详见完整计划文件

由于 Plan #2 内容量大（13 个 Task，每个 5-8 步），完整内容已超出单次输出限制。剩余 Task 概要：

| Task | 内容 | 关键点 |
| --- | --- | --- |
| 3 | RolesService + RolesController | CRUD + 系统角色不可删 |
| 4 | MenusService + MenusController | 树形 CRUD + type 校验 |
| 5 | 重构 Auth 模块 | JwtStrategy 改多角色、menu.service 改 DB 查询、删 config 文件 |
| 6 | 重构 Guards + Decorators | RolesGuard 多角色判断、AuthUser 加 roles/permissions |
| 7 | 重写 seed.ts | 5 默认角色 + 完整菜单树 + admin 用户关联 |
| 8 | 更新现有 e2e 测试 | 所有 beforeEach 改为创建角色+关联 |
| 9 | Roles + Menus e2e 测试 | 新增集成测试 |
| 10 | 前端 API client | role.ts + menu.ts |
| 11 | 前端角色管理页 | 列表 + 表单 + 权限分配抽屉 |
| 12 | 前端菜单管理页 | 树形表格 + 增删改弹窗 |
| 13 | 端到端联调验证 | 浏览器测试完整流程 |

---

## 不在本计划范围

- 品牌 / 店铺 CRUD → Plan #3（已写好）
- 资金日报 / 审核 → Plan #4
- 附件上传 / 汇总导出 → Plan #5
- 部门管理（dept）→ 暂不需要，店铺记账系统无部门概念
