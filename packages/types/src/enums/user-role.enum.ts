/**
 * 用户角色定义。
 *
 * - 前端通过 `import type { UserRole } from '@vben/types'` 获取联合类型用于类型约束。
 * - 后端通过 `import { UserRole } from '@prisma/client'` 获取 Prisma 自动从 schema.prisma
 *   生成的等价 enum 用于运行时值（避免跨包加载源码 TS）。
 *
 * 两侧值必须一致：修改时同步更新 prisma/schema.prisma 的 `enum UserRole`。
 */
export type UserRole = 'admin' | 'boss' | 'finance' | 'manager' | 'staff';

export const ALL_USER_ROLES: readonly UserRole[] = [
  'staff',
  'manager',
  'finance',
  'boss',
  'admin',
] as const;
