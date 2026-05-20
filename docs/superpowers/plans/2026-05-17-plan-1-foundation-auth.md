# 计划 #1：基础设施 + 认证 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 vben-admin monorepo 中新建 `apps/backend` (NestJS) 和 `packages/types`，搭建 Prisma + PostgreSQL，实现完整认证基础设施（登录 / 刷新 / 登出 / 权限码 / 菜单 / 用户信息），并把 `apps/web-naive` 的请求层从 mock 切到真实 NestJS 后端。完成后能跑通 "前端启动 → 登录 → 进入首页" 的完整链路。

**Architecture:** Monorepo 内 `apps/web-naive` 通过 axios 调用 `apps/backend` 提供的 NestJS REST API，后端用 Prisma 操作 PostgreSQL。共享类型放在 `packages/types`。开发用 docker-compose 起 PostgreSQL，生产环境前后端均打 Docker 镜像。

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL 16, JWT (access 15min + refresh 7d), bcrypt, class-validator, Vitest, supertest, Docker Compose.

---

## File Structure Overview

### 新建文件

```
apps/backend/
├── package.json
├── tsconfig.json
├── nest-cli.json
├── .env.example
├── Dockerfile
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── prisma/prisma.service.ts
│   ├── common/
│   │   ├── filters/http-exception.filter.ts
│   │   ├── interceptors/response.interceptor.ts
│   │   ├── guards/{jwt-auth,roles}.guard.ts
│   │   └── decorators/{roles,current-user,public}.decorator.ts
│   └── modules/
│       ├── auth/
│       │   ├── auth.{module,controller,service}.ts
│       │   ├── menu.{controller,service}.ts
│       │   ├── menu-permissions.config.ts
│       │   └── strategies/jwt.strategy.ts
│       └── users/
│           ├── users.{module,controller,service}.ts
└── test/
    ├── setup.ts
    └── integration/{auth,users}.e2e-spec.ts

packages/types/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts
    ├── enums/user-role.enum.ts
    ├── dto/auth.dto.ts
    └── api/response.ts

# 仓库根
docker-compose.dev.yml
docker-compose.prod.yml
.env.example
```

### 修改文件

```
pnpm-workspace.yaml      加入 catalog 依赖
package.json             加 dev:backend / build:backend
apps/web-naive/.env.development     VITE_GLOB_API_URL → http://localhost:3100/api
apps/web-naive/vite.config.mts      代理 /api 到 3100
CLAUDE.md                追加后端命令
```

---

---

## Task 1: 添加 packages/types 共享类型包

**Files:**

- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/tsup.config.ts`
- Create: `packages/types/src/index.ts`
- Create: `packages/types/src/enums/user-role.enum.ts`
- Create: `packages/types/src/dto/auth.dto.ts`
- Create: `packages/types/src/api/response.ts`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: 创建 packages/types/package.json**

```json
{
  "name": "@vben/types",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "stub": "tsup --watch",
    "build": "tsup"
  },
  "dependencies": {
    "class-validator": "catalog:",
    "class-transformer": "catalog:"
  },
  "devDependencies": {
    "tsup": "catalog:",
    "@vben/tsconfig": "workspace:*"
  }
}
```

- [ ] **Step 2: 在 pnpm-workspace.yaml catalog 添加新依赖**

打开 `pnpm-workspace.yaml`，在 catalog 中确认或追加：

```yaml
catalog:
  class-validator: ^0.14.2
  class-transformer: ^0.5.1
  tsup: ^8.6.4
```

- [ ] **Step 3: 创建 packages/types/tsconfig.json**

```json
{
  "extends": "@vben/tsconfig/library.json",
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: 创建 packages/types/tsup.config.ts**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
});
```

- [ ] **Step 5: 创建 packages/types/src/enums/user-role.enum.ts**

```ts
export enum UserRole {
  Staff = 'staff',
  Manager = 'manager',
  Finance = 'finance',
  Boss = 'boss',
  Admin = 'admin',
}

export const ALL_USER_ROLES: UserRole[] = [
  UserRole.Staff,
  UserRole.Manager,
  UserRole.Finance,
  UserRole.Boss,
  UserRole.Admin,
];
```

- [ ] **Step 6: 创建 packages/types/src/dto/auth.dto.ts**

```ts
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(100)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

export interface UserInfoResult {
  id: string;
  username: string;
  displayName: string;
  role: string;
  shopIds: string[];
}
```

- [ ] **Step 7: 创建 packages/types/src/api/response.ts**

```ts
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}
```

- [ ] **Step 8: 创建 packages/types/src/index.ts**

```ts
export * from './enums/user-role.enum';
export * from './dto/auth.dto';
export * from './api/response';
```

- [ ] **Step 9: 安装并验证**

Run: `pnpm install` Run: `cd packages/types && pnpm run build` Expected: `packages/types/dist/` 包含 `.js` `.cjs` `.d.ts`

- [ ] **Step 10: 提交**

```bash
git add packages/types pnpm-workspace.yaml
git commit -m "feat(types): scaffold @vben/types shared DTO/enum package"
```

---

## Task 2: docker-compose.dev.yml（PostgreSQL + MinIO）

**Files:**

- Create: `docker-compose.dev.yml`
- Create: `.env.example`

- [ ] **Step 1: 创建 .env.example**

```bash
POSTGRES_USER=vben
POSTGRES_PASSWORD=vben_dev_pwd
POSTGRES_DB=shop_bookkeeping
POSTGRES_PORT=5432

BACKEND_PORT=3100
JWT_ACCESS_SECRET=change-me-in-production-32chars-min
JWT_REFRESH_SECRET=change-me-too-in-production-32chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=minio_dev_pwd
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001

CORS_ORIGIN=http://localhost:5666
```

- [ ] **Step 2: 创建 docker-compose.dev.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: vben_pg_dev
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-vben}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-vben_dev_pwd}
      POSTGRES_DB: ${POSTGRES_DB:-shop_bookkeeping}
    ports:
      - '${POSTGRES_PORT:-5432}:5432'
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-vben}']
      interval: 5s
      timeout: 3s
      retries: 5

  minio:
    image: minio/minio:RELEASE.2024-12-18T13-15-44Z
    container_name: vben_minio_dev
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minio}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minio_dev_pwd}
    ports:
      - '${MINIO_PORT:-9000}:9000'
      - '${MINIO_CONSOLE_PORT:-9001}:9001'
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

volumes:
  pg_data:
  minio_data:
```

- [ ] **Step 3: 启动并验证**

Run: `cp .env.example .env` Run: `docker compose -f docker-compose.dev.yml up -d` Run: `docker compose -f docker-compose.dev.yml ps` Expected: postgres + minio 状态为 `Up` 或 `Up (healthy)`

- [ ] **Step 4: 提交**

```bash
git add docker-compose.dev.yml .env.example
git commit -m "chore(docker): add dev compose for postgres + minio"
```

---

## Task 3: NestJS 后端骨架

**Files:**

- Create: `apps/backend/package.json`
- Create: `apps/backend/tsconfig.json`
- Create: `apps/backend/nest-cli.json`
- Create: `apps/backend/.env.example`
- Create: `apps/backend/src/main.ts`
- Create: `apps/backend/src/app.module.ts`
- Modify: `package.json` (root)
- Modify: `pnpm-workspace.yaml` (catalog)

- [ ] **Step 1: 在 pnpm-workspace.yaml catalog 添加 NestJS 依赖**

```yaml
catalog:
  '@nestjs/common': ^11.0.0
  '@nestjs/core': ^11.0.0
  '@nestjs/platform-express': ^11.0.0
  '@nestjs/config': ^4.0.0
  '@nestjs/jwt': ^11.0.0
  '@nestjs/passport': ^11.0.0
  '@nestjs/testing': ^11.0.0
  '@nestjs/cli': ^11.0.0
  '@nestjs/schematics': ^11.0.0
  passport: ^0.7.0
  passport-jwt: ^4.0.1
  '@types/passport-jwt': ^4.0.1
  bcrypt: ^5.1.1
  '@types/bcrypt': ^5.0.2
  reflect-metadata: ^0.2.2
  rxjs: ^7.8.1
  ts-loader: ^9.5.1
  ts-node: ^10.9.2
  prisma: ^6.0.0
  '@prisma/client': ^6.0.0
  supertest: ^7.0.0
  '@types/supertest': ^6.0.2
  tsx: ^4.19.2
```

如果某些条目已存在，则保持原值。

- [ ] **Step 2: 创建 apps/backend/package.json**

```json
{
  "name": "@vben/backend",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main",
    "typecheck": "tsc --noEmit",
    "test:unit": "vitest run",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@nestjs/common": "catalog:",
    "@nestjs/config": "catalog:",
    "@nestjs/core": "catalog:",
    "@nestjs/jwt": "catalog:",
    "@nestjs/passport": "catalog:",
    "@nestjs/platform-express": "catalog:",
    "@prisma/client": "catalog:",
    "@vben/types": "workspace:*",
    "bcrypt": "catalog:",
    "class-transformer": "catalog:",
    "class-validator": "catalog:",
    "passport": "catalog:",
    "passport-jwt": "catalog:",
    "reflect-metadata": "catalog:",
    "rxjs": "catalog:"
  },
  "devDependencies": {
    "@nestjs/cli": "catalog:",
    "@nestjs/schematics": "catalog:",
    "@nestjs/testing": "catalog:",
    "@types/bcrypt": "catalog:",
    "@types/node": "catalog:",
    "@types/passport-jwt": "catalog:",
    "@types/supertest": "catalog:",
    "@vben/tsconfig": "workspace:*",
    "prisma": "catalog:",
    "supertest": "catalog:",
    "ts-loader": "catalog:",
    "ts-node": "catalog:",
    "tsx": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 3: 创建 apps/backend/tsconfig.json**

```json
{
  "extends": "@vben/tsconfig/library.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "target": "ES2022",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strictPropertyInitialization": false,
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": {
      "#/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "test/**/*", "prisma/seed.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: 创建 apps/backend/nest-cli.json**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 5: 创建 apps/backend/.env.example**

```bash
DATABASE_URL=postgresql://vben:vben_dev_pwd@localhost:5432/shop_bookkeeping?schema=public
PORT=3100
JWT_ACCESS_SECRET=dev-access-secret-please-change-32chars
JWT_REFRESH_SECRET=dev-refresh-secret-please-change-32ch
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5666
```

- [ ] **Step 6: 创建 apps/backend/src/main.ts**

```ts
import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });

  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5666').split(','),
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3100);
  await app.listen(port);
  console.log(`Backend listening on http://localhost:${port}/api`);
}

bootstrap();
```

- [ ] **Step 7: 创建 apps/backend/src/app.module.ts（最简版本，后续 Task 持续扩充）**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
})
export class AppModule {}
```

- [ ] **Step 8: 在仓库根 package.json scripts 添加**

```json
"dev:backend": "pnpm -F @vben/backend run dev",
"build:backend": "pnpm -F @vben/backend run build"
```

- [ ] **Step 9: 启动验证**

Run: `pnpm install` Run: `cp apps/backend/.env.example apps/backend/.env` Run: `pnpm dev:backend` Expected: 控制台打印 `Backend listening on http://localhost:3100/api`，按 Ctrl+C 停止。

- [ ] **Step 10: 提交**

```bash
git add apps/backend pnpm-workspace.yaml package.json
git commit -m "feat(backend): scaffold NestJS app with health bootstrap"
```

---

## Task 4: Prisma + 初始 schema

**Files:**

- Create: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/seed.ts`
- Create: `apps/backend/src/prisma/prisma.service.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: 创建 apps/backend/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  staff
  manager
  finance
  boss
  admin
}

enum UserStatus {
  active
  disabled
}

model User {
  id            String     @id @default(uuid()) @db.Uuid
  username      String     @unique @db.VarChar(50)
  passwordHash  String     @map("password_hash") @db.VarChar(120)
  displayName   String     @map("display_name") @db.VarChar(100)
  role          UserRole
  status        UserStatus @default(active)
  createdAt     DateTime   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime   @updatedAt @map("updated_at") @db.Timestamptz

  refreshTokens RefreshToken[]
  shopAccess    UserShopAccess[]

  @@map("users")
}

model RefreshToken {
  id         String    @id @default(uuid()) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  tokenHash  String    @map("token_hash") @db.VarChar(120)
  expiresAt  DateTime  @map("expires_at") @db.Timestamptz
  revokedAt  DateTime? @map("revoked_at") @db.Timestamptz
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz
  userAgent  String?   @map("user_agent") @db.VarChar(500)
  ip         String?   @db.VarChar(64)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
  @@map("refresh_tokens")
}

model UserShopAccess {
  userId String @map("user_id") @db.Uuid
  shopId String @map("shop_id") @db.Uuid

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, shopId])
  @@map("user_shop_access")
}
```

注：`shopId` 暂不加 FK（`shops` 表在计划 #2 创建）。计划 #2 时再补 FK 关联。

- [ ] **Step 2: 生成 Prisma Client 并运行迁移**

Run: `cd apps/backend && pnpm prisma:generate` Expected: 生成 `node_modules/@prisma/client`

Run: `pnpm prisma:migrate:dev --name init` Expected: 数据库出现 3 张表，并在 `prisma/migrations/<ts>_init/migration.sql` 记录

- [ ] **Step 3: 创建 apps/backend/src/prisma/prisma.service.ts**

```ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 4: 修改 apps/backend/src/app.module.ts，注册 PrismaService 为全局**

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaService } from './prisma/prisma.service';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
```

- [ ] **Step 5: 创建 apps/backend/prisma/seed.ts**

```ts
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      displayName: '系统管理员',
      role: UserRole.admin,
      status: UserStatus.active,
    },
  });

  console.log('Seeded admin user (username=admin, password=admin123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 6: 跑种子并验证**

Run: `cd apps/backend && pnpm prisma:seed` Expected: 控制台打印 `Seeded admin user`

Run: `docker exec -it vben_pg_dev psql -U vben -d shop_bookkeeping -c "SELECT username, role FROM users;"` Expected: 返回 `admin | admin` 一行

- [ ] **Step 7: 提交**

```bash
git add apps/backend/prisma apps/backend/src/prisma apps/backend/src/app.module.ts
git commit -m "feat(backend): add Prisma schema for users/refresh_tokens/user_shop_access"
```

---

## Task 5: UsersService（密码校验）+ 单元测试

**Files:**

- Create: `apps/backend/src/modules/users/users.module.ts`
- Create: `apps/backend/src/modules/users/users.service.ts`
- Create: `apps/backend/src/modules/users/users.service.spec.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: 写失败的测试 apps/backend/src/modules/users/users.service.spec.ts**

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
import * as bcrypt from 'bcrypt';

import { UsersService } from './users.service';

describe('UsersService.verifyPasswordByUsername', () => {
  let service: UsersService;
  let prismaMock: { user: { findUnique: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    prismaMock = { user: { findUnique: vi.fn() } };
    service = new UsersService(prismaMock as any);
  });

  it('returns null when user not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    expect(await service.verifyPasswordByUsername('nope', 'pwd')).toBeNull();
  });

  it('returns null when password mismatch', async () => {
    const passwordHash = await bcrypt.hash('correct', 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      username: 'alice',
      passwordHash,
      status: 'active',
    });
    expect(await service.verifyPasswordByUsername('alice', 'wrong')).toBeNull();
  });

  it('returns user when password matches and status active', async () => {
    const passwordHash = await bcrypt.hash('correct', 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      username: 'alice',
      passwordHash,
      status: 'active',
      role: 'staff',
      displayName: 'Alice',
    });
    const user = await service.verifyPasswordByUsername('alice', 'correct');
    expect(user?.id).toBe('u-1');
  });

  it('returns null when status disabled even if password correct', async () => {
    const passwordHash = await bcrypt.hash('correct', 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      username: 'alice',
      passwordHash,
      status: 'disabled',
    });
    expect(
      await service.verifyPasswordByUsername('alice', 'correct'),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/backend && pnpm test:unit src/modules/users/users.service.spec.ts` Expected: FAIL（找不到 UsersService）

- [ ] **Step 3: 创建 apps/backend/src/modules/users/users.service.ts**

```ts
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { shopAccess: { select: { shopId: true } } },
    });
  }

  async verifyPasswordByUsername(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.status !== 'active') return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return user;
  }
}
```

- [ ] **Step 4: 创建 apps/backend/src/modules/users/users.module.ts**

```ts
import { Module } from '@nestjs/common';

import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd apps/backend && pnpm test:unit src/modules/users/users.service.spec.ts` Expected: 4 个测试 PASS

- [ ] **Step 6: 在 AppModule 注册 UsersModule**

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { UsersModule } from './modules/users/users.module';
import { PrismaService } from './prisma/prisma.service';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), UsersModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
```

- [ ] **Step 7: 提交**

```bash
git add apps/backend/src/modules/users apps/backend/src/app.module.ts
git commit -m "feat(backend): add UsersService with password verification"
```

---

## Task 6: AuthService（颁发 + 刷新 + 撤销 token）

**Files:**

- Create: `apps/backend/src/modules/auth/auth.service.ts`
- Create: `apps/backend/src/modules/auth/auth.service.spec.ts`
- Create: `apps/backend/src/modules/auth/auth.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: 写 apps/backend/src/modules/auth/auth.service.spec.ts**

```ts
import { UnauthorizedException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuthService } from './auth.service';

const usersServiceMock = {
  verifyPasswordByUsername: vi.fn(),
};

const jwtServiceMock = {
  signAsync: vi.fn(),
  verifyAsync: vi.fn(),
};

const prismaMock = {
  refreshToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

const configServiceMock = {
  get: vi.fn((key: string) => {
    const map: Record<string, string> = {
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      JWT_ACCESS_SECRET: 'access-secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
    };
    return map[key];
  }),
};

describe('AuthService.login', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      usersServiceMock as any,
      jwtServiceMock as any,
      prismaMock as any,
      configServiceMock as any,
    );
  });

  it('throws UnauthorizedException when password incorrect', async () => {
    usersServiceMock.verifyPasswordByUsername.mockResolvedValue(null);
    await expect(service.login('alice', 'bad')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('returns tokens when login succeeds', async () => {
    usersServiceMock.verifyPasswordByUsername.mockResolvedValue({
      id: 'u-1',
      username: 'alice',
      role: 'staff',
    });
    jwtServiceMock.signAsync
      .mockResolvedValueOnce('access-jwt')
      .mockResolvedValueOnce('refresh-jwt');
    prismaMock.refreshToken.create.mockResolvedValue({});

    const result = await service.login('alice', 'good');
    expect(result.accessToken).toBe('access-jwt');
    expect(result.refreshToken).toBe('refresh-jwt');
    expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/backend && pnpm test:unit src/modules/auth/auth.service.spec.ts` Expected: FAIL（AuthService 未定义）

- [ ] **Step 3: 创建 apps/backend/src/modules/auth/auth.service.ts**

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.users.verifyPasswordByUsername(username, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!stored) throw new UnauthorizedException('Refresh token revoked');

    const ok = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!ok) throw new UnauthorizedException('Refresh token mismatch');

    const user = await this.users.findById(payload.sub);
    if (!user || user.status !== 'active')
      throw new UnauthorizedException('User inactive');

    // 旋转：撤销旧 token，颁发新的
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(user);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(user: {
    id: string;
    username: string;
    role: string;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN'),
    });

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN'),
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/backend && pnpm test:unit src/modules/auth/auth.service.spec.ts` Expected: 2 个测试 PASS

- [ ] **Step 5: 创建 apps/backend/src/modules/auth/auth.module.ts**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => ({}),
    }),
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 6: 在 AppModule 注册 AuthModule**

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaService } from './prisma/prisma.service';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), UsersModule, AuthModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
```

- [ ] **Step 7: 提交**

```bash
git add apps/backend/src/modules/auth apps/backend/src/app.module.ts
git commit -m "feat(backend): implement AuthService with login/refresh/logout token rotation"
```

---

## Task 7: JwtStrategy + JwtAuthGuard + 装饰器

**Files:**

- Create: `apps/backend/src/common/decorators/public.decorator.ts`
- Create: `apps/backend/src/common/decorators/current-user.decorator.ts`
- Create: `apps/backend/src/common/guards/jwt-auth.guard.ts`
- Create: `apps/backend/src/modules/auth/strategies/jwt.strategy.ts`
- Modify: `apps/backend/src/modules/auth/auth.module.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: 创建 apps/backend/src/common/decorators/public.decorator.ts**

```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 2: 创建 apps/backend/src/common/decorators/current-user.decorator.ts**

```ts
import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  shopIds: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
```

- [ ] **Step 3: 创建 apps/backend/src/modules/auth/strategies/jwt.strategy.ts**

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { UsersService } from '../../users/users.service';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findById(payload.sub);
    if (!user || user.status !== 'active') throw new UnauthorizedException();
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      shopIds: user.shopAccess.map((s) => s.shopId),
    };
  }
}
```

- [ ] **Step 4: 创建 apps/backend/src/common/guards/jwt-auth.guard.ts**

```ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(ctx);
  }
}
```

- [ ] **Step 5: 修改 apps/backend/src/modules/auth/auth.module.ts，注册 PassportModule + JwtStrategy**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => ({}),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 6: 修改 apps/backend/src/app.module.ts，注册 JwtAuthGuard 为全局**

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaService } from './prisma/prisma.service';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), UsersModule, AuthModule],
  providers: [PrismaService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [PrismaService],
})
export class AppModule {}
```

- [ ] **Step 7: 提交**

```bash
git add apps/backend/src/common apps/backend/src/modules/auth/strategies apps/backend/src/modules/auth/auth.module.ts apps/backend/src/app.module.ts
git commit -m "feat(backend): add global JwtAuthGuard with @Public escape hatch"
```

---

## Task 8: AuthController + 集成测试

**Files:**

- Create: `apps/backend/src/modules/auth/auth.controller.ts`
- Create: `apps/backend/vitest.integration.config.ts`
- Create: `apps/backend/test/setup.ts`
- Create: `apps/backend/test/integration/test-helpers.ts`
- Create: `apps/backend/test/integration/auth.e2e-spec.ts`
- Modify: `apps/backend/src/modules/auth/auth.module.ts`

- [ ] **Step 1: 创建 apps/backend/src/modules/auth/auth.controller.ts**

```ts
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { LoginDto, RefreshDto } from '@vben/types';

import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthUser) {
    await this.auth.logout(user.id);
  }
}
```

- [ ] **Step 2: 修改 apps/backend/src/modules/auth/auth.module.ts，注册 Controller**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => ({}),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 3: 创建测试库（手动执行一次）**

Run: `docker exec -i vben_pg_dev psql -U vben -c "CREATE DATABASE shop_bookkeeping_test;"`

如果已存在会报错 "already exists"，可忽略。

Run: `DATABASE_URL=postgresql://vben:vben_dev_pwd@localhost:5432/shop_bookkeeping_test pnpm prisma migrate deploy`

把测试库的 schema 同步到与开发库一致。

- [ ] **Step 4: 创建 apps/backend/vitest.integration.config.ts**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.e2e-spec.ts'],
    testTimeout: 30000,
    setupFiles: ['./test/setup.ts'],
    sequence: { concurrent: false },
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
```

- [ ] **Step 5: 创建 apps/backend/test/setup.ts（不再使用 child_process，改为 env 注入）**

```ts
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://vben:vben_dev_pwd@localhost:5432/shop_bookkeeping_test?schema=public';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.CORS_ORIGIN = 'http://localhost';
```

- [ ] **Step 6: 创建 apps/backend/test/integration/test-helpers.ts（最小版本，Task 11 会扩充）**

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  await app.init();

  const prisma = moduleRef.get(PrismaService);
  return { app, prisma };
}

export async function truncateAll(prisma: PrismaService) {
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({}),
    prisma.userShopAccess.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);
}
```

> 注意：本 Task 还没有 ResponseInterceptor / HttpExceptionFilter（Task 11 创建）。Task 11 会回来补充这两行 useGlobal 调用。

- [ ] **Step 7: 创建 apps/backend/test/integration/auth.e2e-spec.ts**

```ts
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, truncateAll } from './test-helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await prisma.user.create({
      data: {
        username: 'testuser',
        passwordHash: await bcrypt.hash('test123', 10),
        displayName: 'Test User',
        role: 'staff',
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await app.close();
  });

  it('rejects login with bad credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('issues tokens on successful login', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'test123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken ?? res.body.data?.accessToken).toBeDefined();
    expect(res.body.refreshToken ?? res.body.data?.refreshToken).toBeDefined();
  });

  it('rejects logout without auth', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('logs out successfully with valid token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'test123' });
    const token = login.body.accessToken ?? login.body.data?.accessToken;

    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it('refreshes tokens with valid refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'test123' });
    const refreshToken =
      login.body.refreshToken ?? login.body.data?.refreshToken;

    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(res.status).toBe(200);
    const newRefresh = res.body.refreshToken ?? res.body.data?.refreshToken;
    expect(newRefresh).toBeDefined();
    expect(newRefresh).not.toBe(refreshToken); // 旋转
  });
});
```

注：测试断言中同时支持 `body.x` 和 `body.data.x`，因为本 Task 还没注册 ResponseInterceptor。Task 11 注册后只剩 `body.data.x` 路径有效，可以再清理。

- [ ] **Step 8: 跑集成测试**

Run: `cd apps/backend && pnpm test:integration` Expected: 5 个测试 PASS

如果连接失败，确认开发库已起且测试库已建好。如果断言失败，看错误信息确认响应结构（此时还没 ResponseInterceptor）。

- [ ] **Step 9: 提交**

```bash
git add apps/backend/src/modules/auth/auth.controller.ts apps/backend/test apps/backend/vitest.integration.config.ts apps/backend/src/modules/auth/auth.module.ts
git commit -m "feat(backend): add /auth login/refresh/logout endpoints with e2e tests"
```

---

## Task 9: 菜单 + 权限码端点

**Files:**

- Create: `apps/backend/src/modules/auth/menu-permissions.config.ts`
- Create: `apps/backend/src/modules/auth/menu.service.ts`
- Create: `apps/backend/src/modules/auth/menu.controller.ts`
- Create: `apps/backend/src/modules/auth/menu.service.spec.ts`
- Modify: `apps/backend/src/modules/auth/auth.module.ts`

- [ ] **Step 1: 创建 apps/backend/src/modules/auth/menu-permissions.config.ts**

```ts
import { UserRole } from '@vben/types';

export interface MenuItem {
  key: string;
  name: string;
  path: string;
  icon?: string;
  children?: MenuItem[];
}

const ALL_MENUS: Record<string, MenuItem> = {
  dashboard: {
    key: 'dashboard',
    name: '首页',
    path: '/dashboard',
    icon: 'lucide:home',
  },
  'finance.daily': {
    key: 'finance.daily',
    name: '资金日报',
    path: '/finance/daily',
    icon: 'lucide:notebook-pen',
  },
  'finance.summary': {
    key: 'finance.summary',
    name: '资金汇总表',
    path: '/finance/summary',
    icon: 'lucide:layout-grid',
  },
  'finance.audit': {
    key: 'finance.audit',
    name: '审核管理',
    path: '/finance/audit',
    icon: 'lucide:check-circle',
  },
  'system.shops': {
    key: 'system.shops',
    name: '店铺管理',
    path: '/system/shops',
    icon: 'lucide:store',
  },
  'system.brands': {
    key: 'system.brands',
    name: '品牌管理',
    path: '/system/brands',
    icon: 'lucide:tag',
  },
  'system.users': {
    key: 'system.users',
    name: '用户账号',
    path: '/system/users',
    icon: 'lucide:users',
  },
};

export const MENU_KEYS_BY_ROLE: Record<UserRole, string[]> = {
  [UserRole.Staff]: ['dashboard', 'finance.daily'],
  [UserRole.Manager]: ['dashboard', 'finance.daily', 'finance.summary'],
  [UserRole.Finance]: [
    'dashboard',
    'finance.daily',
    'finance.summary',
    'finance.audit',
  ],
  [UserRole.Boss]: [
    'dashboard',
    'finance.daily',
    'finance.summary',
    'finance.audit',
  ],
  [UserRole.Admin]: [
    'dashboard',
    'finance.daily',
    'finance.summary',
    'finance.audit',
    'system.shops',
    'system.brands',
    'system.users',
  ],
};

export const CODES_BY_ROLE: Record<UserRole, string[]> = {
  [UserRole.Staff]: ['report:create', 'report:edit:own_pending'],
  [UserRole.Manager]: [
    'report:create',
    'report:edit:own_pending',
    'staff:manage',
    'shop:read:own',
  ],
  [UserRole.Finance]: ['report:read:all', 'report:audit_1', 'report:reject_1'],
  [UserRole.Boss]: ['report:read:all', 'report:audit_2'],
  [UserRole.Admin]: ['*'],
};

export function getMenusForRole(role: UserRole): MenuItem[] {
  return MENU_KEYS_BY_ROLE[role].map((k) => ALL_MENUS[k]);
}

export function getCodesForRole(role: UserRole): string[] {
  return CODES_BY_ROLE[role];
}
```

- [ ] **Step 2: 写 apps/backend/src/modules/auth/menu.service.spec.ts**

```ts
import { describe, expect, it } from 'vitest';
import { UserRole } from '@vben/types';

import { getCodesForRole, getMenusForRole } from './menu-permissions.config';

describe('Menu permission config', () => {
  it('admin gets all 7 menu keys', () => {
    const menus = getMenusForRole(UserRole.Admin);
    expect(menus.map((m) => m.key)).toEqual([
      'dashboard',
      'finance.daily',
      'finance.summary',
      'finance.audit',
      'system.shops',
      'system.brands',
      'system.users',
    ]);
  });

  it('staff only gets dashboard + daily', () => {
    const menus = getMenusForRole(UserRole.Staff);
    expect(menus.map((m) => m.key)).toEqual(['dashboard', 'finance.daily']);
  });

  it('admin codes is wildcard', () => {
    expect(getCodesForRole(UserRole.Admin)).toEqual(['*']);
  });

  it('manager codes is superset of staff codes', () => {
    const staff = new Set(getCodesForRole(UserRole.Staff));
    const manager = new Set(getCodesForRole(UserRole.Manager));
    for (const code of staff) expect(manager.has(code)).toBe(true);
  });
});
```

- [ ] **Step 3: 跑测试**

Run: `cd apps/backend && pnpm test:unit src/modules/auth/menu.service.spec.ts` Expected: 4 个测试 PASS

- [ ] **Step 4: 创建 apps/backend/src/modules/auth/menu.service.ts**

```ts
import { Injectable } from '@nestjs/common';
import { UserRole } from '@vben/types';

import {
  getCodesForRole,
  getMenusForRole,
  type MenuItem,
} from './menu-permissions.config';

@Injectable()
export class MenuService {
  getMenus(role: string): MenuItem[] {
    return getMenusForRole(role as UserRole);
  }

  getCodes(role: string): string[] {
    return getCodesForRole(role as UserRole);
  }
}
```

- [ ] **Step 5: 创建 apps/backend/src/modules/auth/menu.controller.ts**

```ts
import { Controller, Get } from '@nestjs/common';

import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { MenuService } from './menu.service';

@Controller()
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get('menu/all')
  getMenus(@CurrentUser() user: AuthUser) {
    return this.menu.getMenus(user.role);
  }

  @Get('auth/codes')
  getCodes(@CurrentUser() user: AuthUser) {
    return this.menu.getCodes(user.role);
  }
}
```

- [ ] **Step 6: 修改 apps/backend/src/modules/auth/auth.module.ts**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => ({}),
    }),
  ],
  controllers: [AuthController, MenuController],
  providers: [AuthService, JwtStrategy, MenuService],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 7: 提交**

```bash
git add apps/backend/src/modules/auth
git commit -m "feat(backend): add /menu/all and /auth/codes endpoints with role-based hardcode"
```

---

## Task 10: UsersController（/user/info）+ 集成测试

**Files:**

- Create: `apps/backend/src/modules/users/users.controller.ts`
- Create: `apps/backend/test/integration/users.e2e-spec.ts`
- Modify: `apps/backend/src/modules/users/users.module.ts`

- [ ] **Step 1: 创建 apps/backend/src/modules/users/users.controller.ts**

```ts
import { Controller, Get, NotFoundException } from '@nestjs/common';

import {
  CurrentUser,
  type AuthUser,
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
```

- [ ] **Step 2: 修改 apps/backend/src/modules/users/users.module.ts**

```ts
import { Module } from '@nestjs/common';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 3: 创建 apps/backend/test/integration/users.e2e-spec.ts**

```ts
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, truncateAll } from './test-helpers';

describe('User info / menu / codes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await prisma.user.create({
      data: {
        username: 'infouser',
        passwordHash: await bcrypt.hash('pwd123456', 10),
        displayName: '信息用户',
        role: 'finance',
        status: 'active',
      },
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'infouser', password: 'pwd123456' });
    token = login.body.accessToken ?? login.body.data?.accessToken;
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await app.close();
  });

  it('returns user info for authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/user/info')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body.username).toBe('infouser');
    expect(body.role).toBe('finance');
    expect(body.shopIds).toEqual([]);
  });

  it('rejects without token', async () => {
    const res = await request(app.getHttpServer()).get('/api/user/info');
    expect(res.status).toBe(401);
  });

  it('returns 4 menus for finance role', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/menu/all')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body.length).toBe(4);
  });

  it('returns finance codes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/codes')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = res.body.data ?? res.body;
    expect(body).toContain('report:audit_1');
  });
});
```

- [ ] **Step 4: 跑全部集成测试**

Run: `cd apps/backend && pnpm test:integration` Expected: 5 (auth) + 4 (users) = 9 个测试 PASS

- [ ] **Step 5: 提交**

```bash
git add apps/backend/src/modules/users apps/backend/test/integration/users.e2e-spec.ts
git commit -m "feat(backend): add /user/info endpoint and e2e tests for user/menu/codes"
```

---

## Task 11: 统一响应格式 + 全局异常过滤器

**Files:**

- Create: `apps/backend/src/common/interceptors/response.interceptor.ts`
- Create: `apps/backend/src/common/filters/http-exception.filter.ts`
- Modify: `apps/backend/src/main.ts`
- Modify: `apps/backend/test/integration/test-helpers.ts`（取消之前的注释）
- Modify: 两个 e2e 文件（清理 fallback 断言）

- [ ] **Step 1: 创建 apps/backend/src/common/interceptors/response.interceptor.ts**

```ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((data) => ({
        code: 0,
        data,
        message: 'ok',
      })),
    );
  }
}
```

- [ ] **Step 2: 创建 apps/backend/src/common/filters/http-exception.filter.ts**

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = -1;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string) ?? exception.message;
        code = (b.code as number) ?? status;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.stack);
      message = exception.message;
    }

    res.status(status).json({
      code: code === -1 ? status : code,
      data: null,
      message,
    });
  }
}
```

- [ ] **Step 3: 修改 apps/backend/src/main.ts**

```ts
import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });

  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5666').split(','),
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = Number(process.env.PORT ?? 3100);
  await app.listen(port);
  console.log(`Backend listening on http://localhost:${port}/api`);
}

bootstrap();
```

- [ ] **Step 4: 修改 apps/backend/test/integration/test-helpers.ts，加入 useGlobalInterceptors / useGlobalFilters**

把现有 test-helpers.ts 替换为完整版本：

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { PrismaService } from '../../src/prisma/prisma.service';

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  const prisma = moduleRef.get(PrismaService);
  return { app, prisma };
}

export async function truncateAll(prisma: PrismaService) {
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({}),
    prisma.userShopAccess.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);
}
```

- [ ] **Step 5: 简化 e2e 测试断言（去掉 fallback）**

修改 `apps/backend/test/integration/auth.e2e-spec.ts`，把：

```ts
expect(res.body.accessToken ?? res.body.data?.accessToken).toBeDefined();
```

改为：

```ts
expect(res.body.data.accessToken).toBeDefined();
```

对所有相关断言做相同处理。同样修改 `users.e2e-spec.ts`。

- [ ] **Step 6: 跑全部集成测试**

Run: `cd apps/backend && pnpm test:integration` Expected: 9 个测试 PASS（响应都带 `data` 包装）

- [ ] **Step 7: 提交**

```bash
git add apps/backend/src/common/interceptors apps/backend/src/common/filters apps/backend/src/main.ts apps/backend/test
git commit -m "feat(backend): wire global response interceptor + exception filter"
```

---

## Task 12: RolesGuard + @Roles 装饰器

**Files:**

- Create: `apps/backend/src/common/decorators/roles.decorator.ts`
- Create: `apps/backend/src/common/guards/roles.guard.ts`
- Create: `apps/backend/src/common/guards/roles.guard.spec.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: 创建 apps/backend/src/common/decorators/roles.decorator.ts**

```ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@vben/types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 2: 写失败的测试 apps/backend/src/common/guards/roles.guard.spec.ts**

```ts
import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@vben/types';
import { describe, expect, it, vi } from 'vitest';

import { RolesGuard } from './roles.guard';

function makeCtx(user: { role: string } | null): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => null,
    getClass: () => null,
  } as any;
}

describe('RolesGuard', () => {
  it('allows when no roles required', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as any;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeCtx({ role: 'staff' }))).toBe(true);
  });

  it('allows when user role matches', () => {
    const reflector = {
      getAllAndOverride: vi
        .fn()
        .mockReturnValue([UserRole.Finance, UserRole.Admin]),
    } as any;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeCtx({ role: 'finance' }))).toBe(true);
  });

  it('denies when user role missing', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.Admin]),
    } as any;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeCtx({ role: 'staff' }))).toBe(false);
  });

  it('denies when no user in context', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.Admin]),
    } as any;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeCtx(null))).toBe(false);
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd apps/backend && pnpm test:unit src/common/guards/roles.guard.spec.ts` Expected: FAIL（RolesGuard 未定义）

- [ ] **Step 4: 创建 apps/backend/src/common/guards/roles.guard.ts**

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@vben/types';

import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<{ user?: { role?: string } }>();
    const role = req.user?.role;
    if (!role) return false;
    return required.includes(role as UserRole);
  }
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd apps/backend && pnpm test:unit src/common/guards/roles.guard.spec.ts` Expected: 4 个测试 PASS

- [ ] **Step 6: 修改 apps/backend/src/app.module.ts，注册 RolesGuard 为全局**

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaService } from './prisma/prisma.service';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), UsersModule, AuthModule],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [PrismaService],
})
export class AppModule {}
```

- [ ] **Step 7: 提交**

```bash
git add apps/backend/src/common/decorators/roles.decorator.ts apps/backend/src/common/guards/roles.guard.ts apps/backend/src/common/guards/roles.guard.spec.ts apps/backend/src/app.module.ts
git commit -m "feat(backend): add RolesGuard + @Roles decorator for RBAC"
```

---

## Task 13: 前端切换到真实 NestJS 后端

**Files:**

- Modify: `apps/web-naive/.env.development`
- Modify: `apps/web-naive/vite.config.mts`（如果使用 proxy）

- [ ] **Step 1: 探查现有请求层入口**

Run: `find apps/web-naive/src -type f -name 'request.ts' -o -name 'index.ts' | xargs grep -l createRequestClient 2>/dev/null | head -5`

记下找到的路径（通常是 `apps/web-naive/src/api/request.ts`）。

Run: `cat apps/web-naive/.env.development`

确认现有的 API 配置项（通常是 `VITE_GLOB_API_URL`）。

- [ ] **Step 2: 修改 apps/web-naive/.env.development**

把 API 基础 URL 指向 NestJS 后端：

```bash
VITE_GLOB_API_URL=http://localhost:3100/api
```

如果原项目用的 vite proxy（`/api` 由 vite 代理），保留 `VITE_GLOB_API_URL=/api`，跳到 Step 3。

- [ ] **Step 3: 配置 vite proxy（如果走代理模式）**

打开 `apps/web-naive/vite.config.mts`，在 server.proxy 部分确保：

```ts
server: {
  host: true,
  port: 5666,
  proxy: {
    '/api': {
      target: 'http://localhost:3100',
      changeOrigin: true,
    },
  },
},
```

- [ ] **Step 4: 启动前后端联调**

终端 A: `pnpm dev:backend` 终端 B: `pnpm dev:naive`

打开浏览器到前端地址（终端打印的端口，通常 5666）。

- [ ] **Step 5: 浏览器验证完整流程**

打开浏览器开发者工具 Network 面板，用 `admin` / `admin123` 登录，验证：

- `POST /api/auth/login` → 200，response.data 包含 accessToken / refreshToken
- `GET /api/user/info` → 200，response.data.username = 'admin'，response.data.role = 'admin'
- `GET /api/menu/all` → 200，返回 7 个菜单
- `GET /api/auth/codes` → 200，返回 `['*']`

如果失败：

- 401：检查 Authorization 头是否带了 `Bearer <token>`
- CORS：确认后端 `.env` 的 `CORS_ORIGIN` 包含前端实际地址
- 404：确认 `setGlobalPrefix('api')` 在后端生效，前端 baseURL 也包含 `/api`

- [ ] **Step 6: 提交**

```bash
git add apps/web-naive/.env.development apps/web-naive/vite.config.mts
git commit -m "chore(web-naive): switch API base URL to NestJS backend"
```

实际只 stage 修改过的文件。

---

## Task 14: 生产 Dockerfile + docker-compose.prod.yml

**Files:**

- Create: `apps/backend/Dockerfile`
- Create: `apps/web-naive/Dockerfile`
- Create: `apps/web-naive/nginx.conf`
- Create: `docker-compose.prod.yml`

- [ ] **Step 1: 创建 apps/backend/Dockerfile**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/types/package.json ./packages/types/
COPY internal/tsconfig/package.json ./internal/tsconfig/

RUN pnpm install --frozen-lockfile

COPY apps/backend ./apps/backend
COPY packages/types ./packages/types
COPY internal/tsconfig ./internal/tsconfig

WORKDIR /app/apps/backend
RUN pnpm prisma generate
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app

RUN corepack enable
ENV NODE_ENV=production
ENV PORT=3100

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/package.json ./apps/backend/

WORKDIR /app/apps/backend
EXPOSE 3100
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main"]
```

- [ ] **Step 2: 创建 apps/web-naive/nginx.conf**

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://backend:3100;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

- [ ] **Step 3: 创建 apps/web-naive/Dockerfile**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build:naive

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/apps/web-naive/dist /usr/share/nginx/html
COPY apps/web-naive/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 4: 创建 docker-compose.prod.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER}']
      interval: 10s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
      PORT: 3100
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_ACCESS_EXPIRES_IN: ${JWT_ACCESS_EXPIRES_IN:-15m}
      JWT_REFRESH_EXPIRES_IN: ${JWT_REFRESH_EXPIRES_IN:-7d}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost}
    expose:
      - '3100'

  frontend:
    build:
      context: .
      dockerfile: apps/web-naive/Dockerfile
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - '${FRONTEND_PORT:-80}:80'

volumes:
  pg_data:
```

- [ ] **Step 5: 构建并启动验证**

Run: `docker compose -f docker-compose.prod.yml --env-file .env build` Expected: 两个镜像构建成功

Run: `docker compose -f docker-compose.prod.yml --env-file .env up -d` Run: `docker compose -f docker-compose.prod.yml ps` Expected: 三个服务都 `Up`

- [ ] **Step 6: 浏览器验证生产模式**

打开 `http://localhost`，验证：

- 前端能加载
- 用 admin / admin123 登录（首次启动需要 backend 容器内执行 `pnpm prisma:seed` 创建 admin）
- 进入首页显示菜单

容器内 seed 命令：

Run: `docker compose -f docker-compose.prod.yml exec backend pnpm prisma:seed`

- [ ] **Step 7: 关闭并清理**

Run: `docker compose -f docker-compose.prod.yml down`

- [ ] **Step 8: 提交**

```bash
git add apps/backend/Dockerfile apps/web-naive/Dockerfile apps/web-naive/nginx.conf docker-compose.prod.yml
git commit -m "chore(docker): add prod Dockerfiles + compose for frontend/backend/postgres"
```

---

## Task 15: 文档与收尾

**Files:**

- Create: `apps/backend/README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 创建 apps/backend/README.md**

````markdown
# @vben/backend

NestJS REST API for the shop bookkeeping system.

## Local development

1. Start dev databases:

   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

2. Set env:

   ```bash
   cp apps/backend/.env.example apps/backend/.env
   ```

3. Apply migrations and seed admin:

   ```bash
   cd apps/backend
   pnpm prisma:migrate:dev
   pnpm prisma:seed
   ```

4. Start backend:

   ```bash
   pnpm dev:backend
   ```

Default admin: `admin` / `admin123`.

## Tests

```bash
pnpm test:unit
pnpm test:integration   # requires postgres + shop_bookkeeping_test DB
```

## Production

Build via root `docker-compose.prod.yml`. See repo CLAUDE.md.
````

- [ ] **Step 2: 在 CLAUDE.md 的 Commands 段追加**

```markdown
# Backend (NestJS)

pnpm dev:backend # Start NestJS in watch mode pnpm build:backend # Build NestJS for prod cd apps/backend && pnpm prisma:migrate:dev # Apply DB migrations (dev) cd apps/backend && pnpm prisma:seed # Seed admin user cd apps/backend && pnpm test:integration # Run integration tests

# Docker

docker compose -f docker-compose.dev.yml up -d # Dev DB + MinIO docker compose -f docker-compose.prod.yml up -d # Full prod stack
```

- [ ] **Step 3: 提交**

```bash
git add apps/backend/README.md CLAUDE.md
git commit -m "docs: add backend README and update CLAUDE.md commands"
```

---

## Self-Review

完成所有 Task 后做最终自检：

- [ ] **Spec 覆盖检查**
  - 设计 4.5 节列出的端点全部实现：`/auth/login`、`/auth/refresh`、`/auth/logout`、`/auth/codes`、`/user/info`、`/menu/all`
  - JWT + refresh token 旋转
  - 全局 JwtAuthGuard + RolesGuard
  - 数据范围 Guard 留到计划 #2（占位）

- [ ] **占位符扫描**
  - 没有 TBD/TODO/"按需实现"等模糊描述
  - 每个 Step 都给了完整代码或确切命令

- [ ] **类型一致性**
  - LoginDto / RefreshDto 在前后端共用 `@vben/types`
  - UserRole 单一枚举源（PostgreSQL enum + TypeScript enum 字面值匹配）

- [ ] **测试覆盖**
  - UsersService.verifyPasswordByUsername 单元（4 例）
  - AuthService.login 单元（2 例）
  - menu-permissions 单元（4 例）
  - RolesGuard 单元（4 例）
  - auth e2e（5 例：bad creds、login、logout 401、logout、refresh）
  - users + menu + codes e2e（4 例）

- [ ] **可运行验证**
  - 本地：docker compose dev → migrate → seed → dev:backend + dev:naive → 浏览器登录通过 ✓
  - 生产：docker compose prod up → 浏览器登录通过 ✓

---

## 不在本计划范围（留给后续计划）

- 用户 CRUD（增删改、密码修改、shop access 分配）→ 计划 #2
- 数据范围 Guard 实际过滤逻辑 → 计划 #2
- 品牌 / 店铺 模块 → 计划 #2
- 资金日报 / 审核 / 凭证 / 汇总 → 计划 #3-#5
- E2E 用户旅程测试 → 计划 #6
