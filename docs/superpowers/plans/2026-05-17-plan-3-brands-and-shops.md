# 计划 #2：品牌 + 店铺管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现品牌（brands）和店铺（shops）两个基础数据模块的全栈 CRUD：后端 NestJS REST 接口 + Prisma 数据库迁移 + 前端 Naive UI 列表/表单页面。完成后管理员能在网页上添加/编辑/删除品牌和店铺，为后续的资金日报模块（Plan #3）准备好基础数据。

**Architecture:** 后端按 vben-admin 的响应格式（`{code, data, message}`）暴露 RESTful 端点，Prisma 处理 schema 迁移和查询。前端用 Naive UI 的 `NDataTable` + `NForm` 组件组合实现列表 + 弹窗表单，复用 vben 现有的 `Page` 容器组件。前端 accessMode 保持 `'frontend'`，新菜单/路由直接写在前端代码里，用 `meta.authority` 限制只 admin 可见。

**Tech Stack:** NestJS 11 + Prisma 6 + PostgreSQL（已有），Vue 3 + Naive UI 2.44 + Pinia（已有），class-validator DTO 校验，Vitest e2e 测试。

---

## File Structure Overview

### 新建文件

```
apps/backend/
├── prisma/
│   └── migrations/<ts>_add_brands_and_shops/   ← Task 1 生成
└── src/modules/
    ├── brands/
    │   ├── brands.module.ts
    │   ├── brands.service.ts
    │   ├── brands.controller.ts
    │   └── dto/
    │       ├── create-brand.dto.ts
    │       └── update-brand.dto.ts
    └── shops/
        ├── shops.module.ts
        ├── shops.service.ts
        ├── shops.controller.ts
        └── dto/
            ├── create-shop.dto.ts
            └── update-shop.dto.ts

apps/backend/test/integration/
├── brands.e2e-spec.ts
└── shops.e2e-spec.ts

apps/web-naive/src/
├── api/
│   ├── system/
│   │   ├── brand.ts                  ← brand API client
│   │   └── shop.ts                   ← shop API client
│   └── system/index.ts               ← barrel export
├── views/system/
│   ├── brand/
│   │   ├── index.vue                 ← 列表页
│   │   └── components/
│   │       └── brand-form-modal.vue  ← 录入弹窗
│   └── shop/
│       ├── index.vue
│       └── components/
│           └── shop-form-modal.vue
└── router/routes/modules/
    └── system.vue.ts                 ← 系统管理路由
```

### 修改文件

```
apps/backend/prisma/schema.prisma     ← 加 Brand + Shop 模型, UserShopAccess.shopId 加 FK
apps/backend/src/app.module.ts         ← imports 加 BrandsModule + ShopsModule
packages/types/src/                    ← 新增 brand/shop 接口
packages/types/src/index.ts            ← export 新接口
```

---

## Task 1: Prisma schema 加 Brand + Shop + 修复 UserShopAccess FK

**Files:**

- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/<ts>_add_brands_and_shops/migration.sql`

- [ ] **Step 1: 修改 schema.prisma**

打开 `apps/backend/prisma/schema.prisma`，在文件末尾追加 Brand 和 Shop 模型，并修复 UserShopAccess 的 shopId 关联（之前没加 FK，因为 shops 表不存在）。

新增/修改部分：

```prisma
enum BrandStatus {
  active
  inactive
}

enum ShopStatus {
  active
  inactive
}

model Brand {
  id        String      @id @default(uuid()) @db.Uuid
  code      String      @unique @db.VarChar(20)
  name      String      @db.VarChar(100)
  logoUrl   String?     @map("logo_url") @db.VarChar(500)
  status    BrandStatus @default(active)
  createdAt DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime    @updatedAt @map("updated_at") @db.Timestamptz

  shops Shop[]

  @@map("brands")
}

model Shop {
  id              String     @id @default(uuid()) @db.Uuid
  code            String     @unique @db.VarChar(20)
  name            String     @db.VarChar(100)
  brandId         String     @map("brand_id") @db.Uuid
  initialBalance  Decimal    @default(0) @map("initial_balance") @db.Decimal(14, 2)
  address         String?    @db.VarChar(500)
  contactName     String?    @map("contact_name") @db.VarChar(100)
  contactPhone    String?    @map("contact_phone") @db.VarChar(50)
  status          ShopStatus @default(active)
  createdAt       DateTime   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime   @updatedAt @map("updated_at") @db.Timestamptz

  brand      Brand            @relation(fields: [brandId], references: [id], onDelete: Restrict)
  userAccess UserShopAccess[]

  @@index([brandId])
  @@map("shops")
}
```

修改现有的 `UserShopAccess` 模型，给 `shopId` 加上 FK 关系：

```prisma
model UserShopAccess {
  userId String @map("user_id") @db.Uuid
  shopId String @map("shop_id") @db.Uuid

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  shop Shop @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@id([userId, shopId])
  @@map("user_shop_access")
}
```

- [ ] **Step 2: 跑 prisma migrate dev 生成迁移**

Run: `cd apps/backend && pnpm prisma:migrate:dev --name add_brands_and_shops`

Expected: 控制台输出 `Applying migration ...`，并在 `prisma/migrations/<timestamp>_add_brands_and_shops/migration.sql` 生成 SQL。生成的 Prisma Client 也会自动更新（含 `Brand`、`Shop` 类型）。

- [ ] **Step 3: 同步测试数据库**

Run: `DATABASE_URL=postgresql://vben:vben_dev_pwd@localhost:5432/shop_bookkeeping_test pnpm prisma migrate deploy`

Expected: 测试库也应用了同样的迁移。

- [ ] **Step 4: 验证表结构**

Run: `docker exec vben_pg_dev psql -U vben -d shop_bookkeeping -c "\dt"`

Expected: 输出列表包含 `brands` 和 `shops` 两张表。

Run: `docker exec vben_pg_dev psql -U vben -d shop_bookkeeping -c "\d shops"`

Expected: 看到 `brand_id` FK 指向 `brands.id`，`initial_balance` 类型为 `numeric(14,2)`。

- [ ] **Step 5: 提交**

```bash
cd /Users/xiaose/.superconductor/worktrees/vben-admin-spec/sc-levitated-perovskite-4cf1
git add apps/backend/prisma
git commit -m "feat(@vben/backend): add Brand and Shop Prisma models with FK to UserShopAccess"
```

---

## Task 2: 共享类型 — 在 @vben/types 加 brand/shop 接口

**Files:**

- Create: `packages/types/src/dto/brand.dto.ts`
- Create: `packages/types/src/dto/shop.dto.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: 创建 packages/types/src/dto/brand.dto.ts**

```ts
export type BrandStatus = 'active' | 'inactive';

export interface Brand {
  id: string;
  code: string;
  name: string;
  logoUrl?: null | string;
  status: BrandStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandRequest {
  code: string;
  name: string;
  logoUrl?: null | string;
  status?: BrandStatus;
}

export interface UpdateBrandRequest {
  code?: string;
  name?: string;
  logoUrl?: null | string;
  status?: BrandStatus;
}

export interface BrandListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: BrandStatus;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

- [ ] **Step 2: 创建 packages/types/src/dto/shop.dto.ts**

```ts
export type ShopStatus = 'active' | 'inactive';

export interface Shop {
  id: string;
  code: string;
  name: string;
  brandId: string;
  brandName?: string;
  initialBalance: string;
  address?: null | string;
  contactName?: null | string;
  contactPhone?: null | string;
  status: ShopStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShopRequest {
  code: string;
  name: string;
  brandId: string;
  initialBalance?: number | string;
  address?: null | string;
  contactName?: null | string;
  contactPhone?: null | string;
  status?: ShopStatus;
}

export interface UpdateShopRequest {
  code?: string;
  name?: string;
  brandId?: string;
  initialBalance?: number | string;
  address?: null | string;
  contactName?: null | string;
  contactPhone?: null | string;
  status?: ShopStatus;
}

export interface ShopListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  brandId?: string;
  status?: ShopStatus;
}
```

注：`initialBalance` 用 `string` 因为 Prisma 的 `Decimal` 在 JSON 中序列化为字符串，避免 JS 浮点精度问题。

- [ ] **Step 3: 修改 packages/types/src/index.ts，加新 export**

打开 `packages/types/src/index.ts`，在现有 export 之后追加：

```ts
export * from './dto/brand.dto';
export * from './dto/shop.dto';
```

完整文件应该长这样：

```ts
export * from './api/response';
export * from './dto/auth.dto';
export * from './dto/brand.dto';
export * from './dto/shop.dto';
export * from './enums/user-role.enum';
export type * from './user';
export type * from '@vben-core/typings';
```

- [ ] **Step 4: 验证 TypeScript 编译通过**

Run: `cd packages/types && pnpm exec tsc --noEmit`

Expected: 无错误（如果有 prettier/oxfmt 提示可忽略）。

- [ ] **Step 5: 提交**

```bash
git add packages/types/src
git commit -m "feat(@vben/types): add Brand and Shop interfaces and DTOs"
```

---

## Task 3: Backend BrandsService（CRUD 单元测试 + 实现）

**Files:**

- Create: `apps/backend/src/modules/brands/brands.service.ts`
- Create: `apps/backend/src/modules/brands/brands.service.spec.ts`
- Create: `apps/backend/src/modules/brands/dto/create-brand.dto.ts`
- Create: `apps/backend/src/modules/brands/dto/update-brand.dto.ts`
- Create: `apps/backend/src/modules/brands/brands.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: 创建 apps/backend/src/modules/brands/dto/create-brand.dto.ts**

```ts
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const BRAND_STATUSES = ['active', 'inactive'] as const;

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'code must contain only letters, digits, hyphens, and underscores',
  })
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: null | string;

  @IsOptional()
  @IsEnum(BRAND_STATUSES)
  status?: (typeof BRAND_STATUSES)[number];
}
```

- [ ] **Step 2: 创建 apps/backend/src/modules/brands/dto/update-brand.dto.ts**

```ts
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const BRAND_STATUSES = ['active', 'inactive'] as const;

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  @MinLength(1)
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: null | string;

  @IsOptional()
  @IsEnum(BRAND_STATUSES)
  status?: (typeof BRAND_STATUSES)[number];
}
```

- [ ] **Step 3: 写失败的测试 apps/backend/src/modules/brands/brands.service.spec.ts**

```ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { BrandsService } from './brands.service';

describe('brandsService', () => {
  let service: BrandsService;
  let prismaMock: {
    brand: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    shop: { count: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    prismaMock = {
      brand: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      shop: { count: vi.fn() },
    };
    service = new BrandsService(prismaMock as never);
  });

  it('list returns paginated result', async () => {
    prismaMock.brand.findMany.mockResolvedValue([
      { id: '1', code: 'A', name: 'Brand A' },
    ]);
    prismaMock.brand.count.mockResolvedValue(1);

    const result = await service.list({ page: 1, pageSize: 10 });
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it('create throws ConflictException when code duplicated', async () => {
    prismaMock.brand.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.create({ code: 'DUP', name: 'X' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('create succeeds when code unique', async () => {
    prismaMock.brand.findUnique.mockResolvedValue(null);
    prismaMock.brand.create.mockResolvedValue({
      id: 'new',
      code: 'NEW',
      name: 'New',
    });
    const result = await service.create({ code: 'NEW', name: 'New' });
    expect(result.id).toBe('new');
  });

  it('update throws NotFoundException when id missing', async () => {
    prismaMock.brand.findUnique.mockResolvedValue(null);
    await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remove throws ConflictException when shops still reference brand', async () => {
    prismaMock.brand.findUnique.mockResolvedValue({ id: 'b1' });
    prismaMock.shop.count.mockResolvedValue(2);
    await expect(service.remove('b1')).rejects.toThrow(ConflictException);
  });

  it('remove deletes when no shops reference brand', async () => {
    prismaMock.brand.findUnique.mockResolvedValue({ id: 'b1' });
    prismaMock.shop.count.mockResolvedValue(0);
    prismaMock.brand.delete.mockResolvedValue({ id: 'b1' });
    await expect(service.remove('b1')).resolves.toBeUndefined();
    expect(prismaMock.brand.delete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: 跑测试确认失败**

Run: `cd apps/backend && pnpm test:unit src/modules/brands/brands.service.spec.ts`

Expected: FAIL（BrandsService 不存在）。

- [ ] **Step 5: 创建 apps/backend/src/modules/brands/brands.service.ts**

```ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

interface ListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: 'active' | 'inactive';
}

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where = {
      ...(query.keyword
        ? {
            OR: [
              {
                code: { contains: query.keyword, mode: 'insensitive' as const },
              },
              {
                name: { contains: query.keyword, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.brand.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getById(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException(`Brand ${id} not found`);
    return brand;
  }

  async create(dto: CreateBrandDto) {
    const existing = await this.prisma.brand.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Brand code ${dto.code} already exists`);
    }
    return this.prisma.brand.create({
      data: {
        code: dto.code,
        name: dto.name,
        logoUrl: dto.logoUrl ?? null,
        status: dto.status ?? 'active',
      },
    });
  }

  async update(id: string, dto: UpdateBrandDto) {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Brand ${id} not found`);

    if (dto.code && dto.code !== existing.code) {
      const dup = await this.prisma.brand.findUnique({
        where: { code: dto.code },
      });
      if (dup) {
        throw new ConflictException(`Brand code ${dto.code} already exists`);
      }
    }

    return this.prisma.brand.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Brand ${id} not found`);

    const shopCount = await this.prisma.shop.count({
      where: { brandId: id },
    });
    if (shopCount > 0) {
      throw new ConflictException(
        `Cannot delete brand with ${shopCount} shop(s); reassign or delete shops first`,
      );
    }

    await this.prisma.brand.delete({ where: { id } });
  }
}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `cd apps/backend && pnpm test:unit src/modules/brands/brands.service.spec.ts`

Expected: 6 个测试全过。

- [ ] **Step 7: 创建 apps/backend/src/modules/brands/brands.module.ts**

```ts
import { Module } from '@nestjs/common';

import { BrandsService } from './brands.service';

@Module({
  providers: [BrandsService],
  exports: [BrandsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BrandsModule {}
```

- [ ] **Step 8: 提交**

```bash
git add apps/backend/src/modules/brands
git commit -m "feat(@vben/backend): add BrandsService with CRUD and uniqueness/FK guards"
```

---

## Task 4: Backend BrandsController + 全局注册

**Files:**

- Create: `apps/backend/src/modules/brands/brands.controller.ts`
- Modify: `apps/backend/src/modules/brands/brands.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: 创建 apps/backend/src/modules/brands/brands.controller.ts**

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: 'active' | 'inactive',
  ) {
    return this.brands.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      keyword,
      status,
    });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.brands.getById(id);
  }

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateBrandDto) {
    return this.brands.create(dto);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return this.brands.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.brands.remove(id);
  }
}
```

- [ ] **Step 2: 修改 brands.module.ts，加入 controllers**

```ts
import { Module } from '@nestjs/common';

import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

@Module({
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BrandsModule {}
```

- [ ] **Step 3: 在 app.module.ts 注册 BrandsModule**

打开 `apps/backend/src/app.module.ts`，imports 数组里加入 `BrandsModule`：

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { BrandsModule } from './modules/brands/brands.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaService } from './prisma/prisma.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    AuthModule,
    BrandsModule,
  ],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [PrismaService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
```

- [ ] **Step 4: 提交**

```bash
git add apps/backend/src/modules/brands apps/backend/src/app.module.ts
git commit -m "feat(@vben/backend): expose Brand REST endpoints with admin-only write"
```

---

## Task 5: Brands e2e 集成测试

**Files:**

- Create: `apps/backend/test/integration/brands.e2e-spec.ts`
- Modify: `apps/backend/test/integration/test-helpers.ts`

- [ ] **Step 1: 修改 test-helpers.ts，扩展 truncateAll 把 brands/shops 也清掉**

打开 `apps/backend/test/integration/test-helpers.ts`，把 truncateAll 改成：

```ts
export async function truncateAll(prisma: PrismaService) {
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({}),
    prisma.userShopAccess.deleteMany({}),
    prisma.shop.deleteMany({}),
    prisma.brand.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);
}
```

注意删除顺序：refresh_tokens、userShopAccess（依赖 user 和 shop）→ shops（依赖 brand）→ brands → users。

- [ ] **Step 2: 创建 apps/backend/test/integration/brands.e2e-spec.ts**

```ts
import type { INestApplication } from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, truncateAll } from './test-helpers';

describe('brands (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let staffToken: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    const passwordHash = await bcrypt.hash('test123456', 10);
    await prisma.user.createMany({
      data: [
        {
          username: 'admin1',
          passwordHash,
          displayName: 'Admin',
          role: 'admin',
          status: 'active',
        },
        {
          username: 'staff1',
          passwordHash,
          displayName: 'Staff',
          role: 'staff',
          status: 'active',
        },
      ],
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin1', password: 'test123456' });
    adminToken = adminLogin.body.data.accessToken;

    const staffLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'staff1', password: 'test123456' });
    staffToken = staffLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await app.close();
  });

  it('rejects unauthenticated list', async () => {
    const res = await request(app.getHttpServer()).get('/api/brands');
    expect(res.status).toBe(401);
  });

  it('staff can read but not write', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/brands')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.items).toEqual([]);

    const create = await request(app.getHttpServer())
      .post('/api/brands')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ code: 'KKY', name: '可可衣' });
    expect(create.status).toBe(403);
  });

  it('admin creates brand and lists it', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'KKY', name: '可可衣' });
    expect(create.status).toBe(201);
    expect(create.body.data.code).toBe('KKY');

    const list = await request(app.getHttpServer())
      .get('/api/brands')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.data.total).toBe(1);
    expect(list.body.data.items[0].name).toBe('可可衣');
  });

  it('rejects duplicated brand code', async () => {
    await prisma.brand.create({
      data: { code: 'KKY', name: '可可衣' },
    });
    const dup = await request(app.getHttpServer())
      .post('/api/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'KKY', name: 'Different' });
    expect(dup.status).toBe(409);
  });

  it('updates an existing brand', async () => {
    const created = await prisma.brand.create({
      data: { code: 'OLD', name: 'Old Name' },
    });
    const res = await request(app.getHttpServer())
      .patch(`/api/brands/${created.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
  });

  it('returns 404 when updating nonexistent brand', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/brands/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('refuses to delete brand with shops', async () => {
    const brand = await prisma.brand.create({
      data: { code: 'WS', name: 'WithShop' },
    });
    await prisma.shop.create({
      data: {
        code: 'S1',
        name: 'Shop1',
        brandId: brand.id,
      },
    });
    const res = await request(app.getHttpServer())
      .delete(`/api/brands/${brand.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });

  it('deletes brand without shops', async () => {
    const brand = await prisma.brand.create({
      data: { code: 'EMPTY', name: 'Empty' },
    });
    const res = await request(app.getHttpServer())
      .delete(`/api/brands/${brand.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);

    const check = await prisma.brand.findUnique({ where: { id: brand.id } });
    expect(check).toBeNull();
  });
});
```

- [ ] **Step 2: 跑集成测试**

Run: `cd apps/backend && pnpm test:integration test/integration/brands.e2e-spec.ts`

Expected: 8 个测试全过。

如果失败：

- 401/403 不对 → 检查 RolesGuard 是否注册（Task 4 Step 3）
- "shop_bookkeeping_test" 不存在 → 重跑 prisma migrate（Task 1 Step 3）
- prismaclient enum mismatch → `pnpm prisma:generate` 重新生成 client

- [ ] **Step 3: 提交**

```bash
git add apps/backend/test/integration/brands.e2e-spec.ts apps/backend/test/integration/test-helpers.ts
git commit -m "test(@vben/backend): add brands e2e covering RBAC, conflicts, and FK guard"
```

---

## Task 6: Backend ShopsService（CRUD + 关联校验）

**Files:**

- Create: `apps/backend/src/modules/shops/shops.service.ts`
- Create: `apps/backend/src/modules/shops/shops.service.spec.ts`
- Create: `apps/backend/src/modules/shops/dto/create-shop.dto.ts`
- Create: `apps/backend/src/modules/shops/dto/update-shop.dto.ts`
- Create: `apps/backend/src/modules/shops/shops.module.ts`

- [ ] **Step 1: 创建 apps/backend/src/modules/shops/dto/create-shop.dto.ts**

```ts
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const SHOP_STATUSES = ['active', 'inactive'] as const;

export class CreateShopDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]+$/)
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsUUID()
  brandId!: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value),
  )
  @IsNumberString({ no_symbols: false })
  initialBalance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactName?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: null | string;

  @IsOptional()
  @IsEnum(SHOP_STATUSES)
  status?: (typeof SHOP_STATUSES)[number];
}
```

- [ ] **Step 2: 创建 apps/backend/src/modules/shops/dto/update-shop.dto.ts**

```ts
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const SHOP_STATUSES = ['active', 'inactive'] as const;

export class UpdateShopDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  @MinLength(1)
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value),
  )
  @IsNumberString({ no_symbols: false })
  initialBalance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactName?: null | string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: null | string;

  @IsOptional()
  @IsEnum(SHOP_STATUSES)
  status?: (typeof SHOP_STATUSES)[number];
}
```

- [ ] **Step 3: 写失败的测试 apps/backend/src/modules/shops/shops.service.spec.ts**

```ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { ShopsService } from './shops.service';

describe('shopsService', () => {
  let service: ShopsService;
  let prismaMock: {
    shop: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    brand: { findUnique: ReturnType<typeof vi.fn> };
    dailyFundsReport?: { count: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    prismaMock = {
      shop: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      brand: { findUnique: vi.fn() },
    };
    service = new ShopsService(prismaMock as never);
  });

  it('list returns paginated result with brand included', async () => {
    prismaMock.shop.findMany.mockResolvedValue([
      { id: 's1', code: 'S1', name: 'Shop1', brand: { name: 'B1' } },
    ]);
    prismaMock.shop.count.mockResolvedValue(1);

    const result = await service.list({ page: 1, pageSize: 10 });
    expect(result.total).toBe(1);
    expect(result.items[0].brand.name).toBe('B1');
  });

  it('create throws NotFoundException when brand not found', async () => {
    prismaMock.brand.findUnique.mockResolvedValue(null);
    prismaMock.shop.findUnique.mockResolvedValue(null);
    await expect(
      service.create({
        code: 'S1',
        name: 'Shop1',
        brandId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('create throws ConflictException on duplicated code', async () => {
    prismaMock.brand.findUnique.mockResolvedValue({ id: 'b1' });
    prismaMock.shop.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create({ code: 'DUP', name: 'X', brandId: 'b1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('create succeeds', async () => {
    prismaMock.brand.findUnique.mockResolvedValue({ id: 'b1' });
    prismaMock.shop.findUnique.mockResolvedValue(null);
    prismaMock.shop.create.mockResolvedValue({
      id: 's1',
      code: 'S1',
      name: 'Shop1',
      brandId: 'b1',
    });
    const result = await service.create({
      code: 'S1',
      name: 'Shop1',
      brandId: 'b1',
    });
    expect(result.id).toBe('s1');
  });

  it('update throws NotFoundException when id missing', async () => {
    prismaMock.shop.findUnique.mockResolvedValue(null);
    await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remove deletes when nothing references shop', async () => {
    prismaMock.shop.findUnique.mockResolvedValue({ id: 's1' });
    prismaMock.shop.delete.mockResolvedValue({ id: 's1' });
    await expect(service.remove('s1')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 4: 跑测试确认失败**

Run: `cd apps/backend && pnpm test:unit src/modules/shops/shops.service.spec.ts`

Expected: FAIL（ShopsService 不存在）。

- [ ] **Step 5: 创建 apps/backend/src/modules/shops/shops.service.ts**

```ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';

interface ListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  brandId?: string;
  status?: 'active' | 'inactive';
}

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where = {
      ...(query.keyword
        ? {
            OR: [
              {
                code: { contains: query.keyword, mode: 'insensitive' as const },
              },
              {
                name: { contains: query.keyword, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.shop.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { brand: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.shop.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getById(id: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: { brand: { select: { id: true, code: true, name: true } } },
    });
    if (!shop) throw new NotFoundException(`Shop ${id} not found`);
    return shop;
  }

  async create(dto: CreateShopDto) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: dto.brandId },
    });
    if (!brand) throw new NotFoundException(`Brand ${dto.brandId} not found`);

    const dup = await this.prisma.shop.findUnique({
      where: { code: dto.code },
    });
    if (dup) {
      throw new ConflictException(`Shop code ${dto.code} already exists`);
    }

    return this.prisma.shop.create({
      data: {
        code: dto.code,
        name: dto.name,
        brandId: dto.brandId,
        initialBalance: dto.initialBalance ?? '0',
        address: dto.address ?? null,
        contactName: dto.contactName ?? null,
        contactPhone: dto.contactPhone ?? null,
        status: dto.status ?? 'active',
      },
      include: { brand: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateShopDto) {
    const existing = await this.prisma.shop.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Shop ${id} not found`);

    if (dto.code && dto.code !== existing.code) {
      const dup = await this.prisma.shop.findUnique({
        where: { code: dto.code },
      });
      if (dup) {
        throw new ConflictException(`Shop code ${dto.code} already exists`);
      }
    }

    if (dto.brandId && dto.brandId !== existing.brandId) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: dto.brandId },
      });
      if (!brand) throw new NotFoundException(`Brand ${dto.brandId} not found`);
    }

    return this.prisma.shop.update({
      where: { id },
      data: dto,
      include: { brand: { select: { id: true, code: true, name: true } } },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.shop.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Shop ${id} not found`);
    // 注：daily_funds_reports 表还没建（Plan #3），暂时不检查它。
    // Plan #3 创建该表后，这里要加一段：如果 shop 有日报记录则 ConflictException 拒绝删除。
    await this.prisma.shop.delete({ where: { id } });
  }
}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `cd apps/backend && pnpm test:unit src/modules/shops/shops.service.spec.ts`

Expected: 6 个测试全过。

- [ ] **Step 7: 创建 apps/backend/src/modules/shops/shops.module.ts**

```ts
import { Module } from '@nestjs/common';

import { ShopsService } from './shops.service';

@Module({
  providers: [ShopsService],
  exports: [ShopsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ShopsModule {}
```

- [ ] **Step 8: 提交**

```bash
git add apps/backend/src/modules/shops
git commit -m "feat(@vben/backend): add ShopsService with brand FK validation and CRUD"
```

---

## Task 7: Backend ShopsController + 注册 + e2e

**Files:**

- Create: `apps/backend/src/modules/shops/shops.controller.ts`
- Create: `apps/backend/test/integration/shops.e2e-spec.ts`
- Modify: `apps/backend/src/modules/shops/shops.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: 创建 apps/backend/src/modules/shops/shops.controller.ts**

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { ShopsService } from './shops.service';

@Controller('shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('brandId') brandId?: string,
    @Query('status') status?: 'active' | 'inactive',
  ) {
    return this.shops.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      keyword,
      brandId,
      status,
    });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.shops.getById(id);
  }

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateShopDto) {
    return this.shops.create(dto);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateShopDto) {
    return this.shops.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.shops.remove(id);
  }
}
```

- [ ] **Step 2: 修改 shops.module.ts，加入 controllers**

```ts
import { Module } from '@nestjs/common';

import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';

@Module({
  controllers: [ShopsController],
  providers: [ShopsService],
  exports: [ShopsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ShopsModule {}
```

- [ ] **Step 3: 在 app.module.ts 注册 ShopsModule**

打开 `apps/backend/src/app.module.ts`，imports 数组里加 `ShopsModule`：

```ts
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  UsersModule,
  AuthModule,
  BrandsModule,
  ShopsModule,
],
```

记得 import：

```ts
import { ShopsModule } from './modules/shops/shops.module';
```

- [ ] **Step 4: 创建 apps/backend/test/integration/shops.e2e-spec.ts**

```ts
import type { INestApplication } from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, truncateAll } from './test-helpers';

describe('shops (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let staffToken: string;
  let brandId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    const passwordHash = await bcrypt.hash('test123456', 10);
    await prisma.user.createMany({
      data: [
        {
          username: 'admin1',
          passwordHash,
          displayName: 'Admin',
          role: 'admin',
          status: 'active',
        },
        {
          username: 'staff1',
          passwordHash,
          displayName: 'Staff',
          role: 'staff',
          status: 'active',
        },
      ],
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin1', password: 'test123456' });
    adminToken = adminLogin.body.data.accessToken;

    const staffLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'staff1', password: 'test123456' });
    staffToken = staffLogin.body.data.accessToken;

    const brand = await prisma.brand.create({
      data: { code: 'KKY', name: '可可衣' },
    });
    brandId = brand.id;
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await app.close();
  });

  it('rejects unauthenticated list', async () => {
    const res = await request(app.getHttpServer()).get('/api/shops');
    expect(res.status).toBe(401);
  });

  it('staff can read but not create', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/shops')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(list.status).toBe(200);

    const create = await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ code: 'S1', name: 'Shop1', brandId });
    expect(create.status).toBe(403);
  });

  it('admin creates shop with brand association', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'SH-001',
        name: '林达步行街店',
        brandId,
        initialBalance: '1000.00',
        address: '上海市',
        contactName: '张三',
        contactPhone: '13800000000',
      });
    expect(create.status).toBe(201);
    expect(create.body.data.code).toBe('SH-001');
    expect(create.body.data.brand.name).toBe('可可衣');
    expect(create.body.data.initialBalance).toBe('1000');

    const list = await request(app.getHttpServer())
      .get('/api/shops')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.data.total).toBe(1);
  });

  it('rejects shop with nonexistent brand', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'X',
        name: 'X',
        brandId: '00000000-0000-0000-0000-000000000000',
      });
    expect(res.status).toBe(404);
  });

  it('updates shop', async () => {
    const created = await prisma.shop.create({
      data: { code: 'S1', name: 'Shop1', brandId },
    });
    const res = await request(app.getHttpServer())
      .patch(`/api/shops/${created.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Shop1 Updated' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Shop1 Updated');
  });

  it('deletes shop', async () => {
    const created = await prisma.shop.create({
      data: { code: 'S1', name: 'Shop1', brandId },
    });
    const res = await request(app.getHttpServer())
      .delete(`/api/shops/${created.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });

  it('filters shops by brandId', async () => {
    const otherBrand = await prisma.brand.create({
      data: { code: 'OTHER', name: 'Other' },
    });
    await prisma.shop.createMany({
      data: [
        { code: 'A', name: 'A', brandId },
        { code: 'B', name: 'B', brandId: otherBrand.id },
      ],
    });

    const filtered = await request(app.getHttpServer())
      .get(`/api/shops?brandId=${brandId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(filtered.body.data.total).toBe(1);
    expect(filtered.body.data.items[0].code).toBe('A');
  });
});
```

- [ ] **Step 5: 跑全部集成测试**

Run: `cd apps/backend && pnpm test:integration`

Expected: 之前 13 + 新加 7 = 20 个测试全过。如果 brands 测试也跑（Task 5 加的），总数是 28。

- [ ] **Step 6: 提交**

```bash
git add apps/backend/src/modules/shops apps/backend/test/integration/shops.e2e-spec.ts apps/backend/src/app.module.ts
git commit -m "feat(@vben/backend): expose Shop REST endpoints with FK validation and e2e"
```

---

## Task 8: 前端 API client（brand + shop）

**Files:**

- Create: `apps/web-naive/src/api/system/brand.ts`
- Create: `apps/web-naive/src/api/system/shop.ts`
- Create: `apps/web-naive/src/api/system/index.ts`

- [ ] **Step 1: 探查现有 API 客户端样式**

Run: `ls apps/web-naive/src/api/core/ && cat apps/web-naive/src/api/core/auth.ts | head -30`

记下 requestClient 的导入路径和惯例（通常是 `import { requestClient } from '#/api/request'`）。

- [ ] **Step 2: 创建 apps/web-naive/src/api/system/brand.ts**

```ts
import type {
  Brand,
  BrandListQuery,
  CreateBrandRequest,
  PageResult,
  UpdateBrandRequest,
} from '@vben/types';

import { requestClient } from '#/api/request';

export function listBrandsApi(params?: BrandListQuery) {
  return requestClient.get<PageResult<Brand>>('/brands', { params });
}

export function getBrandApi(id: string) {
  return requestClient.get<Brand>(`/brands/${id}`);
}

export function createBrandApi(data: CreateBrandRequest) {
  return requestClient.post<Brand>('/brands', data);
}

export function updateBrandApi(id: string, data: UpdateBrandRequest) {
  return requestClient.patch<Brand>(`/brands/${id}`, data);
}

export function deleteBrandApi(id: string) {
  return requestClient.delete<void>(`/brands/${id}`);
}
```

- [ ] **Step 3: 创建 apps/web-naive/src/api/system/shop.ts**

```ts
import type {
  CreateShopRequest,
  PageResult,
  Shop,
  ShopListQuery,
  UpdateShopRequest,
} from '@vben/types';

import { requestClient } from '#/api/request';

export function listShopsApi(params?: ShopListQuery) {
  return requestClient.get<PageResult<Shop>>('/shops', { params });
}

export function getShopApi(id: string) {
  return requestClient.get<Shop>(`/shops/${id}`);
}

export function createShopApi(data: CreateShopRequest) {
  return requestClient.post<Shop>('/shops', data);
}

export function updateShopApi(id: string, data: UpdateShopRequest) {
  return requestClient.patch<Shop>(`/shops/${id}`, data);
}

export function deleteShopApi(id: string) {
  return requestClient.delete<void>(`/shops/${id}`);
}
```

- [ ] **Step 4: 创建 apps/web-naive/src/api/system/index.ts**

```ts
export * from './brand';
export * from './shop';
```

- [ ] **Step 5: 验证 TypeScript 编译**

Run: `cd apps/web-naive && pnpm exec vue-tsc --noEmit --skipLibCheck`

Expected: 无错误。

- [ ] **Step 6: 提交**

```bash
git add apps/web-naive/src/api/system
git commit -m "feat(@vben/web-naive): add brand and shop API clients"
```

---

## Task 9: 前端 — 品牌管理页面

**Files:**

- Create: `apps/web-naive/src/views/system/brand/index.vue`
- Create: `apps/web-naive/src/views/system/brand/components/brand-form-modal.vue`

- [ ] **Step 1: 创建 apps/web-naive/src/views/system/brand/components/brand-form-modal.vue**

```vue
<script lang="ts" setup>
import type {
  Brand,
  CreateBrandRequest,
  UpdateBrandRequest,
} from '@vben/types';

import { computed, ref, watch } from 'vue';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  useMessage,
} from 'naive-ui';

import { createBrandApi, updateBrandApi } from '#/api/system';

defineOptions({ name: 'BrandFormModal' });

const props = defineProps<{
  brand?: Brand | null;
  show: boolean;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  saved: [];
}>();

const message = useMessage();
const formRef = ref();
const submitting = ref(false);

const formModel = ref<{
  code: string;
  name: string;
  logoUrl: string;
  status: 'active' | 'inactive';
}>({
  code: '',
  name: '',
  logoUrl: '',
  status: 'active',
});

const isEdit = computed(() => Boolean(props.brand?.id));
const title = computed(() => (isEdit.value ? '编辑品牌' : '新建品牌'));

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

const rules = {
  code: {
    required: true,
    trigger: ['blur', 'input'],
    message: '请输入品牌代码（字母数字_-）',
    pattern: /^[A-Za-z0-9_-]+$/,
  },
  name: {
    required: true,
    trigger: ['blur', 'input'],
    message: '请输入品牌名称',
  },
};

watch(
  () => props.show,
  (val) => {
    if (val) {
      formModel.value = {
        code: props.brand?.code ?? '',
        name: props.brand?.name ?? '',
        logoUrl: props.brand?.logoUrl ?? '',
        status: props.brand?.status ?? 'active',
      };
    }
  },
  { immediate: true },
);

async function handleSubmit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    const payload = {
      code: formModel.value.code,
      name: formModel.value.name,
      logoUrl: formModel.value.logoUrl || null,
      status: formModel.value.status,
    };
    if (isEdit.value && props.brand) {
      await updateBrandApi(props.brand.id, payload as UpdateBrandRequest);
      message.success('品牌已更新');
    } else {
      await createBrandApi(payload as CreateBrandRequest);
      message.success('品牌已创建');
    }
    emit('saved');
    emit('update:show', false);
  } finally {
    submitting.value = false;
  }
}

function handleClose() {
  if (submitting.value) return;
  emit('update:show', false);
}
</script>

<template>
  <NModal
    :show="show"
    :title="title"
    preset="card"
    style="width: 480px"
    :mask-closable="false"
    @update:show="handleClose"
  >
    <NForm
      ref="formRef"
      :model="formModel"
      :rules="rules"
      label-placement="left"
      label-width="100"
    >
      <NFormItem label="品牌代码" path="code">
        <NInput
          v-model:value="formModel.code"
          placeholder="如 KKY（不可重复）"
          :disabled="isEdit"
          maxlength="20"
        />
      </NFormItem>
      <NFormItem label="品牌名称" path="name">
        <NInput
          v-model:value="formModel.name"
          placeholder="如 可可衣"
          maxlength="100"
        />
      </NFormItem>
      <NFormItem label="LOGO 地址">
        <NInput
          v-model:value="formModel.logoUrl"
          placeholder="可选"
          maxlength="500"
        />
      </NFormItem>
      <NFormItem label="状态">
        <NSelect v-model:value="formModel.status" :options="statusOptions" />
      </NFormItem>
    </NForm>
    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 8px">
        <NButton :disabled="submitting" @click="handleClose">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="handleSubmit"
          >保存</NButton
        >
      </div>
    </template>
  </NModal>
</template>
```

- [ ] **Step 2: 创建 apps/web-naive/src/views/system/brand/index.vue**

```vue
<script lang="ts" setup>
import type { Brand } from '@vben/types';
import type { DataTableColumns } from 'naive-ui';

import { h, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  NButton,
  NDataTable,
  NInput,
  NPopconfirm,
  NSelect,
  NSpace,
  NTag,
  useMessage,
} from 'naive-ui';

import { deleteBrandApi, listBrandsApi } from '#/api/system';

import BrandFormModal from './components/brand-form-modal.vue';

defineOptions({ name: 'BrandManagement' });

const message = useMessage();
const loading = ref(false);
const data = ref<Brand[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');
const statusFilter = ref<'active' | 'inactive' | undefined>(undefined);
const showFormModal = ref(false);
const editingBrand = ref<Brand | null>(null);

const statusOptions = [
  { label: '全部', value: undefined as any },
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

const columns: DataTableColumns<Brand> = [
  { title: '品牌代码', key: 'code', width: 120 },
  { title: '品牌名称', key: 'name' },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row) =>
      h(
        NTag,
        {
          type: row.status === 'active' ? 'success' : 'default',
          size: 'small',
        },
        { default: () => (row.status === 'active' ? '启用' : '停用') },
      ),
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 180,
    render: (row) => new Date(row.createdAt).toLocaleString(),
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    render: (row) =>
      h(NSpace, { size: 'small' }, () => [
        h(
          NButton,
          { size: 'small', onClick: () => openEdit(row) },
          { default: () => '编辑' },
        ),
        h(
          NPopconfirm,
          {
            onPositiveClick: () => handleDelete(row),
          },
          {
            default: () => `确定删除品牌 "${row.name}"？`,
            trigger: () =>
              h(
                NButton,
                { size: 'small', type: 'error', tertiary: true },
                { default: () => '删除' },
              ),
          },
        ),
      ]),
  },
];

async function loadData() {
  loading.value = true;
  try {
    const res = await listBrandsApi({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      status: statusFilter.value,
    });
    data.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingBrand.value = null;
  showFormModal.value = true;
}

function openEdit(brand: Brand) {
  editingBrand.value = brand;
  showFormModal.value = true;
}

async function handleDelete(brand: Brand) {
  try {
    await deleteBrandApi(brand.id);
    message.success('已删除');
    if (data.value.length === 1 && page.value > 1) {
      page.value -= 1;
    }
    await loadData();
  } catch (err: any) {
    const msg = err?.response?.data?.message || '删除失败';
    message.error(msg);
  }
}

function handleSearch() {
  page.value = 1;
  loadData();
}

onMounted(loadData);
</script>

<template>
  <Page title="品牌管理" description="管理所有连锁门店所属的品牌">
    <NSpace vertical :size="16">
      <NSpace>
        <NInput
          v-model:value="keyword"
          placeholder="搜索品牌代码或名称"
          style="width: 240px"
          clearable
          @keyup.enter="handleSearch"
        />
        <NSelect
          v-model:value="statusFilter"
          :options="statusOptions"
          placeholder="状态"
          style="width: 120px"
          clearable
        />
        <NButton type="primary" @click="handleSearch">查询</NButton>
        <NButton type="primary" @click="openCreate">新建品牌</NButton>
      </NSpace>

      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="{
          page,
          pageSize,
          itemCount: total,
          showSizePicker: true,
          pageSizes: [10, 20, 50],
          onChange: (p: number) => {
            page = p;
            loadData();
          },
          onUpdatePageSize: (s: number) => {
            pageSize = s;
            page = 1;
            loadData();
          },
        }"
        remote
      />
    </NSpace>

    <BrandFormModal
      v-model:show="showFormModal"
      :brand="editingBrand"
      @saved="loadData"
    />
  </Page>
</template>
```

- [ ] **Step 3: 提交**

```bash
git add apps/web-naive/src/views/system/brand
git commit -m "feat(@vben/web-naive): add brand management page with list and modal form"
```

---

## Task 10: 前端 — 店铺管理页面

**Files:**

- Create: `apps/web-naive/src/views/system/shop/index.vue`
- Create: `apps/web-naive/src/views/system/shop/components/shop-form-modal.vue`

- [ ] **Step 1: 创建 apps/web-naive/src/views/system/shop/components/shop-form-modal.vue**

```vue
<script lang="ts" setup>
import type {
  Brand,
  CreateShopRequest,
  Shop,
  UpdateShopRequest,
} from '@vben/types';

import { computed, onMounted, ref, watch } from 'vue';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  useMessage,
} from 'naive-ui';

import { createShopApi, listBrandsApi, updateShopApi } from '#/api/system';

defineOptions({ name: 'ShopFormModal' });

const props = defineProps<{
  show: boolean;
  shop?: null | Shop;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  saved: [];
}>();

const message = useMessage();
const formRef = ref();
const submitting = ref(false);
const brandOptions = ref<{ label: string; value: string }[]>([]);

const formModel = ref<{
  code: string;
  name: string;
  brandId: string;
  initialBalance: number;
  address: string;
  contactName: string;
  contactPhone: string;
  status: 'active' | 'inactive';
}>({
  code: '',
  name: '',
  brandId: '',
  initialBalance: 0,
  address: '',
  contactName: '',
  contactPhone: '',
  status: 'active',
});

const isEdit = computed(() => Boolean(props.shop?.id));
const title = computed(() => (isEdit.value ? '编辑店铺' : '新建店铺'));

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

const rules = {
  code: {
    required: true,
    trigger: ['blur', 'input'],
    message: '请输入店铺代码（字母数字_-）',
    pattern: /^[A-Za-z0-9_-]+$/,
  },
  name: {
    required: true,
    trigger: ['blur', 'input'],
    message: '请输入店铺名称',
  },
  brandId: {
    required: true,
    trigger: ['blur', 'change'],
    message: '请选择品牌',
  },
};

async function loadBrands() {
  const res = await listBrandsApi({ page: 1, pageSize: 100, status: 'active' });
  brandOptions.value = res.items.map((b: Brand) => ({
    label: `${b.name}（${b.code}）`,
    value: b.id,
  }));
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      formModel.value = {
        code: props.shop?.code ?? '',
        name: props.shop?.name ?? '',
        brandId: props.shop?.brandId ?? '',
        initialBalance: Number(props.shop?.initialBalance ?? 0),
        address: props.shop?.address ?? '',
        contactName: props.shop?.contactName ?? '',
        contactPhone: props.shop?.contactPhone ?? '',
        status: props.shop?.status ?? 'active',
      };
    }
  },
  { immediate: true },
);

async function handleSubmit() {
  await formRef.value?.validate();
  submitting.value = true;
  try {
    const payload = {
      code: formModel.value.code,
      name: formModel.value.name,
      brandId: formModel.value.brandId,
      initialBalance: String(formModel.value.initialBalance),
      address: formModel.value.address || null,
      contactName: formModel.value.contactName || null,
      contactPhone: formModel.value.contactPhone || null,
      status: formModel.value.status,
    };
    if (isEdit.value && props.shop) {
      await updateShopApi(props.shop.id, payload as UpdateShopRequest);
      message.success('店铺已更新');
    } else {
      await createShopApi(payload as CreateShopRequest);
      message.success('店铺已创建');
    }
    emit('saved');
    emit('update:show', false);
  } finally {
    submitting.value = false;
  }
}

function handleClose() {
  if (submitting.value) return;
  emit('update:show', false);
}

onMounted(loadBrands);
</script>

<template>
  <NModal
    :show="show"
    :title="title"
    preset="card"
    style="width: 560px"
    :mask-closable="false"
    @update:show="handleClose"
  >
    <NForm
      ref="formRef"
      :model="formModel"
      :rules="rules"
      label-placement="left"
      label-width="100"
    >
      <NFormItem label="店铺代码" path="code">
        <NInput
          v-model:value="formModel.code"
          placeholder="如 SH-001"
          :disabled="isEdit"
          maxlength="20"
        />
      </NFormItem>
      <NFormItem label="店铺名称" path="name">
        <NInput
          v-model:value="formModel.name"
          placeholder="如 林达步行街店"
          maxlength="100"
        />
      </NFormItem>
      <NFormItem label="所属品牌" path="brandId">
        <NSelect
          v-model:value="formModel.brandId"
          :options="brandOptions"
          placeholder="选择品牌"
          filterable
        />
      </NFormItem>
      <NFormItem label="初始余额">
        <NInputNumber
          v-model:value="formModel.initialBalance"
          :precision="2"
          :step="100"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="地址">
        <NInput v-model:value="formModel.address" maxlength="500" />
      </NFormItem>
      <NFormItem label="联系人">
        <NInput v-model:value="formModel.contactName" maxlength="100" />
      </NFormItem>
      <NFormItem label="联系电话">
        <NInput v-model:value="formModel.contactPhone" maxlength="50" />
      </NFormItem>
      <NFormItem label="状态">
        <NSelect v-model:value="formModel.status" :options="statusOptions" />
      </NFormItem>
    </NForm>
    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 8px">
        <NButton :disabled="submitting" @click="handleClose">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="handleSubmit"
          >保存</NButton
        >
      </div>
    </template>
  </NModal>
</template>
```

- [ ] **Step 2: 创建 apps/web-naive/src/views/system/shop/index.vue**

```vue
<script lang="ts" setup>
import type { Brand, Shop } from '@vben/types';
import type { DataTableColumns } from 'naive-ui';

import { h, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  NButton,
  NDataTable,
  NInput,
  NPopconfirm,
  NSelect,
  NSpace,
  NTag,
  useMessage,
} from 'naive-ui';

import { deleteShopApi, listBrandsApi, listShopsApi } from '#/api/system';

import ShopFormModal from './components/shop-form-modal.vue';

defineOptions({ name: 'ShopManagement' });

const message = useMessage();
const loading = ref(false);
const data = ref<Shop[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');
const brandFilter = ref<string | undefined>(undefined);
const statusFilter = ref<'active' | 'inactive' | undefined>(undefined);
const showFormModal = ref(false);
const editingShop = ref<null | Shop>(null);
const brandOptions = ref<{ label: string; value: string | undefined }[]>([
  { label: '全部品牌', value: undefined },
]);

const statusOptions = [
  { label: '全部', value: undefined as any },
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

const columns: DataTableColumns<Shop> = [
  { title: '店铺代码', key: 'code', width: 120 },
  { title: '店铺名称', key: 'name' },
  {
    title: '所属品牌',
    key: 'brandName',
    width: 140,
    render: (row: any) => row.brand?.name ?? '-',
  },
  {
    title: '初始余额',
    key: 'initialBalance',
    width: 120,
    render: (row) => Number(row.initialBalance).toFixed(2),
  },
  { title: '地址', key: 'address', ellipsis: { tooltip: true } },
  { title: '联系人', key: 'contactName', width: 100 },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row) =>
      h(
        NTag,
        {
          type: row.status === 'active' ? 'success' : 'default',
          size: 'small',
        },
        { default: () => (row.status === 'active' ? '启用' : '停用') },
      ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    render: (row) =>
      h(NSpace, { size: 'small' }, () => [
        h(
          NButton,
          { size: 'small', onClick: () => openEdit(row) },
          { default: () => '编辑' },
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row) },
          {
            default: () => `确定删除店铺 "${row.name}"？`,
            trigger: () =>
              h(
                NButton,
                { size: 'small', type: 'error', tertiary: true },
                { default: () => '删除' },
              ),
          },
        ),
      ]),
  },
];

async function loadBrands() {
  const res = await listBrandsApi({ page: 1, pageSize: 100, status: 'active' });
  brandOptions.value = [
    { label: '全部品牌', value: undefined },
    ...res.items.map((b: Brand) => ({
      label: `${b.name}（${b.code}）`,
      value: b.id,
    })),
  ];
}

async function loadData() {
  loading.value = true;
  try {
    const res = await listShopsApi({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      brandId: brandFilter.value,
      status: statusFilter.value,
    });
    data.value = res.items;
    total.value = res.total;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingShop.value = null;
  showFormModal.value = true;
}

function openEdit(shop: Shop) {
  editingShop.value = shop;
  showFormModal.value = true;
}

async function handleDelete(shop: Shop) {
  try {
    await deleteShopApi(shop.id);
    message.success('已删除');
    if (data.value.length === 1 && page.value > 1) {
      page.value -= 1;
    }
    await loadData();
  } catch (err: any) {
    const msg = err?.response?.data?.message || '删除失败';
    message.error(msg);
  }
}

function handleSearch() {
  page.value = 1;
  loadData();
}

onMounted(async () => {
  await loadBrands();
  await loadData();
});
</script>

<template>
  <Page title="店铺管理" description="管理连锁门店">
    <NSpace vertical :size="16">
      <NSpace>
        <NInput
          v-model:value="keyword"
          placeholder="搜索店铺代码或名称"
          style="width: 220px"
          clearable
          @keyup.enter="handleSearch"
        />
        <NSelect
          v-model:value="brandFilter"
          :options="brandOptions"
          placeholder="品牌筛选"
          style="width: 200px"
          clearable
        />
        <NSelect
          v-model:value="statusFilter"
          :options="statusOptions"
          placeholder="状态"
          style="width: 120px"
          clearable
        />
        <NButton type="primary" @click="handleSearch">查询</NButton>
        <NButton type="primary" @click="openCreate">新建店铺</NButton>
      </NSpace>

      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :scroll-x="1200"
        :pagination="{
          page,
          pageSize,
          itemCount: total,
          showSizePicker: true,
          pageSizes: [10, 20, 50],
          onChange: (p: number) => {
            page = p;
            loadData();
          },
          onUpdatePageSize: (s: number) => {
            pageSize = s;
            page = 1;
            loadData();
          },
        }"
        remote
      />
    </NSpace>

    <ShopFormModal
      v-model:show="showFormModal"
      :shop="editingShop"
      @saved="loadData"
    />
  </Page>
</template>
```

- [ ] **Step 3: 提交**

```bash
git add apps/web-naive/src/views/system/shop
git commit -m "feat(@vben/web-naive): add shop management page with brand-aware form"
```

---

## Task 11: 前端 — 路由 + 菜单注册

**Files:**

- Create: `apps/web-naive/src/router/routes/modules/system.ts`

- [ ] **Step 1: 探查现有路由结构**

Run: `ls apps/web-naive/src/router/routes/modules/ && cat apps/web-naive/src/router/routes/modules/dashboard.ts 2>/dev/null | head -40`

记下路由文件的格式（layout 组件、meta 字段约定等）。

- [ ] **Step 2: 创建 apps/web-naive/src/router/routes/modules/system.ts**

```ts
import type { RouteRecordRaw } from 'vue-router';

import { BasicLayout } from '#/layouts';

const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      icon: 'lucide:settings',
      order: 90,
      title: '系统管理',
      authority: ['admin'],
    },
    name: 'System',
    path: '/system',
    redirect: '/system/brand',
    children: [
      {
        meta: {
          icon: 'lucide:tag',
          title: '品牌管理',
          authority: ['admin'],
        },
        name: 'BrandManagement',
        path: '/system/brand',
        component: () => import('#/views/system/brand/index.vue'),
      },
      {
        meta: {
          icon: 'lucide:store',
          title: '店铺管理',
          authority: ['admin'],
        },
        name: 'ShopManagement',
        path: '/system/shop',
        component: () => import('#/views/system/shop/index.vue'),
      },
    ],
  },
];

export default routes;
```

注：如果 `dashboard.ts` 用的是不同 import（比如 `import BasicLayout from '#/layouts/...'`），按现有约定调整即可。

- [ ] **Step 3: 验证 vite-config 自动 glob 拾取**

vben-admin 通常用 `import.meta.glob` 自动拾取 `modules/*.ts`。检查 `apps/web-naive/src/router/routes/index.ts`：

Run: `cat apps/web-naive/src/router/routes/index.ts | head -30`

如果看到类似 `Object.values(import.meta.glob('./modules/*.ts', { eager: true }))`，则不需要额外注册——直接重启 dev server 就生效。

如果没有自动 glob（手动 import），则在 `routes/index.ts` 加上：

```ts
import system from './modules/system';
// 然后在导出的数组里 push
```

- [ ] **Step 4: 重启前端 dev server 并验证**

终端里 Ctrl+C 停掉 `pnpm dev:naive`，重新跑：

```bash
pnpm dev:naive
```

打开 http://localhost:5888，admin 登录后左侧菜单应出现 "系统管理" → "品牌管理" / "店铺管理"。

- [ ] **Step 5: 提交**

```bash
git add apps/web-naive/src/router/routes/modules/system.ts
git commit -m "feat(@vben/web-naive): register system management routes for brand and shop"
```

---

## Task 12: 端到端联调验证

**Files:**

- 无新文件，纯手动 + 自动验证

- [ ] **Step 1: 启动后端（如未启动）**

终端 A:

```bash
cd apps/backend && pnpm dev
```

确认日志含 `Backend listening on http://localhost:3100/api`。

- [ ] **Step 2: 启动前端（如未启动）**

终端 B:

```bash
pnpm dev:naive
```

- [ ] **Step 3: 浏览器测试 — 创建品牌**

打开 http://localhost:5888，admin/admin123 登录，进入"品牌管理"，点击"新建品牌"：

- 代码：KKY
- 名称：可可衣

保存。预期：列表出现一行"可可衣"。

- [ ] **Step 4: 浏览器测试 — 创建店铺**

进入"店铺管理"，点击"新建店铺"：

- 代码：SH-001
- 名称：林达步行街店
- 所属品牌：可可衣（KKY）
- 初始余额：1000

保存。预期：列表出现，"所属品牌"列显示"可可衣"。

- [ ] **Step 5: 浏览器测试 — 错误场景**

尝试新建品牌代码 "KKY"（已存在）：预期收到错误提示，类似"Brand code KKY already exists"。

尝试删除有店铺的品牌 KKY：预期错误提示阻止删除。

先删店铺，再删品牌：成功。

- [ ] **Step 6: 跑完整后端测试**

```bash
cd apps/backend && pnpm test:integration
```

Expected: 之前 13 + brands 8 + shops 7 = 28 个测试全过。

- [ ] **Step 7: 提交（如有微调）**

如果联调过程中发现需要修补任何东西，直接提交。如果一切顺利，本任务无新提交。

---

## Self-Review

完成所有 Task 后做最终自检：

- [ ] **Spec 覆盖检查**
  - 设计 3.2 节列出的 brands 和 shops 表字段全部实现 ✓
  - shops.brandId 有 FK 关联 ✓
  - shops.initialBalance 用 Decimal(14,2) ✓
  - UserShopAccess.shopId 现在有 FK 到 shops ✓
  - admin 写权限 / 其他角色只读 ✓
  - 删除约束（brand 有 shop 时拒绝、shop 关联 daily_funds_reports 留待 Plan #3）✓
  - 前端列表页 + 弹窗表单 + 筛选 ✓

- [ ] **占位符扫描**
  - 没有 TBD/TODO/"按需实现"
  - 每个 Step 有完整代码或确切命令

- [ ] **类型一致性**
  - `BrandStatus` / `ShopStatus` 在前端类型、后端 DTO、Prisma enum 三处一致
  - `initialBalance` 在前端是 number/string、传输用 string、DB 存 Decimal — 文档清楚
  - API 路径在前端 client、后端 controller、e2e 测试三处对齐（`/brands` `/shops`）

- [ ] **测试覆盖**
  - BrandsService 单元（6 例）
  - ShopsService 单元（6 例）
  - Brands e2e（8 例）
  - Shops e2e（7 例）
  - 浏览器手动验证完整 CRUD 流程

- [ ] **可运行验证**
  - 后端 `pnpm dev:backend` 启动无错
  - 前端 `pnpm dev:naive` 启动无错
  - 浏览器登录 → 进系统管理 → 创建/编辑/删除 品牌 + 店铺 全流程通

---

## 不在本计划范围（留给后续计划）

- 用户账号管理 + 数据范围（user_shop_access）配置 UI → Plan #3 或后续
- 数据范围 Guard 实际过滤逻辑（店长只看自己店）→ 等业务模块（资金日报）出来再实现
- 资金日报 / 审核 / 凭证 / 汇总 → Plan #3+
- 品牌 logo 文件上传（目前只存 URL）→ 等附件模块（Plan #5）
