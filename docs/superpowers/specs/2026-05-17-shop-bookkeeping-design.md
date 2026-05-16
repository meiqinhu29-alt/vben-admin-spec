# 可可衣连锁女装店铺记账管理系统 — 设计文档

**版本**：v1.0  
**日期**：2026-05-17  
**状态**：设计确认中

---

## 1. 项目概述

可可衣连锁女装店铺记账管理系统是一个面向连锁女装门店的 **多店铺财务记账与审核工具**。系统支持员工每日资金流水录入、自动余额计算、多级审核流程、凭证图片管理、数据汇总与导出。

### 1.1 核心价值

- 简化店内员工日常财务录入
- 实现总部与门店之间的资金流转透明化
- 通过多级审核确保账务准确性
- 历史数据可追溯，便于审计

### 1.2 目标用户

| 角色 | 数据范围 | 主要操作 |
|------|---------|---------|
| 员工 (staff) | 所属店铺 | 录入资金日报 |
| 店长 (manager) | 所辖店铺（员工超集） | 录入 + 查看本店汇总 + 管理店内员工 |
| 财务 (finance) | 全部 | 审 1 / 反审 1 |
| 老板 (boss) | 全部 | 查看 + 审 2（锁定） |
| 管理员 (admin) | 全部 | 系统管理（品牌、店铺、用户、角色） + 反审 2（解锁） |

### 1.3 MVP 范围

| 模块 | 优先级 |
|------|--------|
| 资金日报（录入 + 列表 + 编辑） | 高 |
| 资金汇总表（多店多期查询） | 高 |
| 审核管理（审 1 / 审 2 / 反审） | 高 |
| 店铺管理 | 高 |
| 品牌管理 | 高 |
| 用户账号管理（含角色、数据范围） | 高 |
| 凭证图片上传（按字段） | 中 |
| 数据导出（Excel） | 中 |

---

## 2. 技术架构

### 2.1 整体形态

```
shop-bookkeeping-monorepo/
├── apps/
│   ├── web-naive/          前端：Vue 3 + Naive UI（基于 vben-admin）
│   ├── backend/            新增：NestJS REST API
│   └── backend-mock/       保留：开发期 Nitro mock，逐步替换
│
├── packages/
│   ├── types/              新增：前后端共享 DTO/类型/枚举
│   └── @core, effects, stores, locales, utils, icons   沿用 vben
```

### 2.2 数据流

```
[apps/web-naive]  ──HTTP+JWT──>  [apps/backend]  ──Prisma──>  [PostgreSQL]
       ↑                                ↑
       └────── packages/types ──────────┘
```

### 2.3 技术选型

| 维度 | 选型 | 理由 |
|------|------|------|
| 前端 | Vue 3 + Naive UI + Pinia | 沿用 vben-admin web-naive 变体 |
| HTTP 客户端 | vben-admin 的 `requestClient` (axios 封装) | 沿用现有拦截器、token 刷新机制 |
| 后端框架 | NestJS | 模块化、装饰器、生态完善 |
| ORM | Prisma | 类型自动生成、迁移友好、与 packages/types 整合 |
| 认证 | JWT + Refresh Token | 沿用 vben-admin 认证模式 |
| 文件存储 | 阿里云 OSS（生产）/ MinIO（开发） | 凭证图片需 CDN 加速 |
| 权限 | RBAC + 数据范围 | NestJS Guard 拦截 |
| 数据库 | PostgreSQL | 支持 decimal 精确金额、事务、复杂查询 |

### 2.4 部署形态

- **开发期**：`pnpm dev:naive` + `pnpm dev:backend` + `docker-compose up`（PostgreSQL + MinIO）
- **生产期**：前端 Nginx 静态 + 后端独立服务 + RDS PostgreSQL + OSS

---

## 3. 数据模型

### 3.1 实体关系图（简化）

```
brands (品牌)
   │ 1:N
   ▼
shops (店铺)
   │ 1:N
   ▼
daily_funds_reports (资金日报)
   │ 1:N
   ▼
report_attachments (凭证，按字段)

users (用户) ─────< user_shop_access >───── shops   (数据范围 M:N)

daily_funds_reports ─────< audit_logs >──── users
```

### 3.2 表结构

#### `brands` — 品牌

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | PK |
| code | string | 品牌代码，unique，如 'KKY' |
| name | string | 品牌名 |
| logo_url | string? | 可选 |
| status | enum | 'active' / 'inactive' |
| created_at, updated_at | timestamp | |

#### `shops` — 店铺

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | PK |
| code | string | 店铺代码，unique，业务可见 |
| name | string | 店铺名 |
| brand_id | uuid | FK → brands |
| initial_balance | decimal(14,2) | 新店初始余额（解决"第一天没有期初"问题） |
| address, contact_name, contact_phone | string? | |
| status | enum | 'active' / 'inactive' |
| created_at, updated_at | timestamp | |

#### `users` — 用户账号

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | PK |
| username | string | unique |
| password_hash | string | bcrypt |
| display_name | string | |
| role | enum | 'staff' / 'manager' / 'finance' / 'boss' / 'admin' |
| status | enum | 'active' / 'disabled' |
| created_at, updated_at | timestamp | |

#### `user_shop_access` — 用户数据范围

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | uuid | FK, PK part 1 |
| shop_id | uuid | FK, PK part 2 |

- staff、manager：必须有绑定记录
- finance、boss、admin：可不绑定，业务层放行所有店

#### `daily_funds_reports` — 资金日报（核心表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | PK |
| shop_id | uuid | FK → shops |
| report_date | date | 报表日期 |
| **公式参与字段** | | |
| opening_balance | decimal(14,2) | 期初余额（自动带入或手填） |
| revenue | decimal(14,2) | 营业额 |
| card_fee | decimal(14,2) | 卡扣 |
| actual_revenue | decimal(14,2) | 实际业绩 = revenue − card_fee |
| transfer_to_company | decimal(14,2) | 刷给公司 |
| deposit_to_company | decimal(14,2) | 转/存给公司 |
| pay_to_owner | decimal(14,2) | 交给店老板款 |
| shop_expense | decimal(14,2) | 店铺费用 |
| closing_balance | decimal(14,2) | 期末余额（按公式计算） |
| **扩展字段（默认不入余额公式，待业务方确认）** | | |
| topup_income | decimal(14,2) | 充值收入 |
| mall_settlement | decimal(14,2) | 商场收款 |
| other_company_income | decimal(14,2) | 公司其它收入 |
| company_to_owner | decimal(14,2) | 公司转店老板 |
| card_payment | decimal(14,2) | 刷卡收款 |
| company_bonus | decimal(14,2) | 公司奖励 |
| **元数据** | | |
| remark | string? | 备注 |
| status | enum | 'pending' / 'audited' / 'locked' |
| created_by | uuid | FK → users |
| audited_by | uuid? | 审 1 操作人 |
| audited_at | timestamp? | |
| locked_by | uuid? | 审 2 操作人 |
| locked_at | timestamp? | |
| created_at, updated_at | timestamp | |

**唯一约束**：`(shop_id, report_date)` — 同店同日不可重复

#### `report_attachments` — 凭证图片

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | PK |
| report_id | uuid | FK → daily_funds_reports |
| field_name | string | 'revenue' / 'transfer_to_company' / ... |
| url | string | 完整 URL 或对象存储 key |
| file_name | string | |
| file_size | integer | bytes |
| uploaded_by | uuid | FK → users |
| uploaded_at | timestamp | |
| deleted_at | timestamp? | 软删除 |

#### `audit_logs` — 审核与操作日志

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | PK |
| report_id | uuid | FK |
| operator_id | uuid | FK |
| action | enum | 'submit' / 'edit' / 'audit' / 'reject' / 'lock' / 'unlock' / 'delete' |
| from_status | string? | |
| to_status | string? | |
| diff | jsonb? | 字段修改的 before/after |
| comment | string? | |
| created_at | timestamp | |

**保留期**：永久。

#### `refresh_tokens` — 刷新令牌（认证基础设施）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| token_hash | string | bcrypt(refresh_token)，防泄漏 |
| expires_at | timestamp | |
| revoked_at | timestamp? | logout 时标记 |
| created_at | timestamp | |
| user_agent, ip | string? | 审计用 |

### 3.3 期初余额处理策略

| 场景 | 策略 |
|------|------|
| 新店第一条 | 取 `shops.initial_balance` |
| 正常情况 | 取该店「上一个有记录日期」的 `closing_balance` |
| 漏报一天 | 取最近一次记录的期末余额（不强制连续） |
| 反审改值 | 修改时级联重算后续所有**未锁定**记录（pending + audited），locked 不动 |

**实现要点**：`opening_balance` 冗余存储，由 service 在创建/修改/级联重算时统一写入。

### 3.4 6 个扩展字段的默认假设（待业务方确认）

MVP 阶段：6 个扩展字段**不参与**期末余额公式，仅作信息记录。

公式：
```
actual_revenue  = revenue − card_fee
closing_balance = opening_balance + actual_revenue − transfer_to_company − deposit_to_company − pay_to_owner − shop_expense
```

业务方答复后，**仅修改** `balance-calculator.service.ts` 一个文件即可调整公式。

---

## 4. 模块边界

### 4.1 前端模块（`apps/web-naive/src/`）

```
views/
├── dashboard/                    首页（待办、统计卡片）
├── finance/
│   ├── daily/                    资金日报
│   │   ├── index.vue
│   │   └── components/
│   │       ├── ReportFormModal.vue
│   │       ├── ReportTable.vue
│   │       ├── FieldAttachmentUpload.vue
│   │       └── BalanceCalculator.ts          公式纯函数
│   ├── summary/                  资金汇总表
│   └── audit/                    审核管理（按状态分 tab）
└── system/
    ├── shops/                    店铺管理
    ├── brands/                   品牌管理
    └── users/                    用户账号管理（角色 + 数据范围）

api/
├── finance/
│   ├── daily-reports.ts
│   └── summary.ts
├── system/
│   ├── shops.ts, brands.ts, users.ts
└── auth.ts

store/
├── auth.ts                       沿用 vben-admin
└── shop-context.ts               当前选中店铺
```

### 4.2 后端模块（`apps/backend/src/`）

```
modules/
├── auth/                         登录、JWT、刷新
├── users/                        用户 CRUD + 角色 + 数据范围
├── brands/
├── shops/
├── finance/
│   ├── daily-reports/
│   │   ├── controller, service
│   │   ├── balance-calculator.service.ts    ★ 公式唯一源
│   │   └── audit.service.ts                 ★ 状态机唯一源
│   └── summary/
└── attachments/                  文件上传

common/
├── guards/
│   ├── jwt-auth.guard.ts
│   ├── roles.guard.ts
│   └── data-scope.guard.ts                  ★ 数据范围强制
├── decorators/                   @Roles, @CurrentUser, @ScopeShop
├── interceptors/                 response.interceptor
└── filters/                      exception.filter

prisma/
├── schema.prisma
└── migrations/
```

### 4.3 共享类型（`packages/types/`）

```
src/
├── entities/                     Prisma 自动生成
├── dto/                          手写 DTO + class-validator 装饰器
├── enums/                        ReportStatus, UserRole, AuditAction
└── api/                          API 路径常量
```

### 4.4 集中原则

| 集中处 | 内容 |
|--------|------|
| `balance-calculator.service.ts` | 余额计算公式（**唯一**） |
| `audit.service.ts` | 状态机（**唯一**变更 status 的入口） |
| `data-scope.guard.ts` | 数据范围过滤（业务 service 不需要关心） |

### 4.5 基础设施模块（从 mock 后端迁移）

vben-admin 现有的 `apps/backend-mock/` 实现了一套基础设施 API，前端依赖这些 API 才能正常运行（登录、菜单、权限码等）。NestJS 后端必须**完整迁移**这部分能力，否则前端连登录页都过不去。

#### 必须迁移的端点

**auth 模块**：

| 端点 | 方法 | 用途 | 依赖表 |
|------|------|------|--------|
| `/api/auth/login` | POST | 用户登录，返回 access token + refresh token | users |
| `/api/auth/logout` | POST | 注销当前会话 | refresh_tokens |
| `/api/auth/refresh` | POST | 用 refresh token 换新的 access token | refresh_tokens |
| `/api/auth/codes` | GET | 返回当前用户的权限码列表 | 硬编码（按角色） |

**users 模块**：

| 端点 | 方法 | 用途 | 依赖表 |
|------|------|------|--------|
| `/api/user/info` | GET | 获取当前登录用户的信息（含 role、shopIds） | users + user_shop_access |
| `/api/users` | GET/POST | 用户列表 + 创建（admin） | users |
| `/api/users/:id` | GET/PUT/DELETE | 用户详情 + 修改 + 软删除 | users |
| `/api/users/:id/shop-access` | PUT | 配置用户的数据范围（绑定店铺） | user_shop_access |
| `/api/users/:id/password` | PUT | 修改密码 | users |

**menu 模块**：

| 端点 | 方法 | 用途 | 依赖 |
|------|------|------|------|
| `/api/menu/all` | GET | 返回当前用户可访问的菜单树 | 硬编码（按角色） |

**attachments 模块**：

| 端点 | 方法 | 用途 | 依赖表 |
|------|------|------|--------|
| `/api/upload` | POST | 通用文件上传，返回 fileId + url | report_attachments + OSS/MinIO |
| `/api/attachments/:id` | DELETE | 软删除附件 | report_attachments |

#### 简化策略（不实现的动态能力）

vben-admin mock 支持运营人员通过 UI 维护菜单和角色，我们**不做**这部分：

| 能力 | 决策 | 理由 |
|------|------|------|
| 动态菜单管理（菜单 CRUD UI） | ❌ 不做 | 商城后台菜单固定（约 5-7 个一级菜单），硬编码 + 按角色映射即可 |
| 动态角色管理（角色 CRUD UI） | ❌ 不做 | 5 个角色固定，写死在 enum |
| 动态权限码管理 | ❌ 不做 | 权限码硬编码在代码里，按角色返回不同集合 |
| 部门管理 | ❌ 不做 | 业务不需要部门概念 |
| 演示数据（demo table 等） | ❌ 不做 | 与业务无关 |

#### 硬编码的菜单与权限码（示例）

```ts
// apps/backend/src/modules/auth/menu-permissions.config.ts

export const MENU_BY_ROLE: Record<UserRole, string[]> = {
  staff:   ['dashboard', 'finance.daily'],
  manager: ['dashboard', 'finance.daily', 'finance.summary'],
  finance: ['dashboard', 'finance.daily', 'finance.summary', 'finance.audit'],
  boss:    ['dashboard', 'finance.daily', 'finance.summary', 'finance.audit'],
  admin:   ['dashboard', 'finance.daily', 'finance.summary', 'finance.audit',
            'system.shops', 'system.brands', 'system.users'],
};

export const CODES_BY_ROLE: Record<UserRole, string[]> = {
  staff:   ['report:create', 'report:edit:own_pending'],
  manager: [...CODES_BY_ROLE.staff, 'staff:manage', 'shop:read:own'],
  finance: ['report:read:all', 'report:audit_1', 'report:reject_1'],
  boss:    ['report:read:all', 'report:audit_2'],
  admin:   ['*'],
};
```

后期如果业务需要动态化，只需把这两个常量改成数据库查询即可（无需重写架构）。

---

## 5. 核心业务流程

### 5.1 录入资金日报（员工/店长）

```
1. 选择日期 + 店铺
2. GET /api/daily-reports/opening-balance?shopId=X&date=Y
   后端：取上一条记录的 closing_balance，或 shops.initial_balance
3. 前端填入期初余额（只读）
4. 用户输入营业额、卡扣、刷给公司、转/存给公司、店铺费用、交给店老板款 等字段
5. 实时预览 closing_balance（前端 BalanceCalculator.preview）
6. 上传字段级凭证（多字段可分别上传）
7. POST /api/daily-reports
   - Guard 校验数据范围（user_shop_access）
   - Service 用 balance-calculator 重算 closing_balance（不信任前端）
   - 创建 report (status='pending')
   - 关联 attachments
   - 写入 audit_log (action='submit')
```

### 5.2 审 1（财务）

```
1. 财务进入审核管理 → 未审 tab
2. 选中查看详情和凭证
3. POST /api/daily-reports/:id/audit { action: 'approve' }
   - 校验 status == 'pending'（SQL 乐观锁）
   - 校验 operator.role in ['finance', 'admin']
   - 状态：pending → audited
   - 写入 audited_by, audited_at
   - 写入 audit_log
```

### 5.3 反审 1

```
1. 财务在已审 tab 找到记录
2. POST /api/daily-reports/:id/audit { action: 'reject', comment }
   - 校验 status == 'audited'
   - 状态：audited → pending
   - 不重算余额（数值未变）
   - 写入 audit_log (action='reject')
```

### 5.4 编辑已审记录

```
- 已审记录在前端"编辑"按钮 disabled
- 需先让财务执行反审 1
- 反审后状态变为 pending，员工可编辑
- 编辑提交后：
  - 校验 status == 'pending'
  - 重算 closing_balance
  - 级联重算：该店此日期之后的所有 pending/audited 记录的
    opening_balance 和 closing_balance（locked 不动）
  - 写入 audit_log (action='edit', diff=...)
```

### 5.5 审 2 / 终审锁定（老板）

```
1. 老板进入审核管理 → 已审 tab
2. POST /api/daily-reports/:id/audit { action: 'lock' }
   - 校验 status == 'audited'
   - 校验 operator.role in ['boss', 'admin']
   - 状态：audited → locked
   - 写入 locked_by, locked_at
   - 写入 audit_log
```

### 5.6 反审 2（解锁）

```
- 仅 admin 可执行
- 校验 status == 'locked' → 转回 'audited'
- 不重算余额
```

---

## 6. 错误处理与边界场景

### 6.1 并发安全

每个状态变更都用 SQL 乐观锁：

```sql
UPDATE daily_funds_reports
SET status = 'audited', audited_by = ?, audited_at = NOW()
WHERE id = ? AND status = 'pending'   -- ← 防并发
```

affected rows = 0 → 返回 409 Conflict + 提示重新拉取。

### 6.2 错误码

```ts
export enum ErrorCode {
  // 通用 1xxxx
  VALIDATION_FAILED = 10001,
  // 权限 2xxxx
  UNAUTHORIZED = 20001,
  FORBIDDEN_ROLE = 20002,
  FORBIDDEN_SHOP = 20003,
  // 报表 3xxxx
  REPORT_NOT_FOUND = 30001,
  REPORT_DUPLICATE = 30002,
  REPORT_STATUS_INVALID = 30003,
  REPORT_LOCKED = 30004,
  OPENING_BALANCE_NOT_AVAILABLE = 30005,
  // 文件 4xxxx
  FILE_TOO_LARGE = 40001,
  FILE_TYPE_INVALID = 40002,
}
```

### 6.3 关键边界

| 场景 | 处理 |
|------|------|
| 同店同日重复创建 | DB unique + service 抛 `REPORT_DUPLICATE` |
| 期初余额取不到 | 抛 `OPENING_BALANCE_NOT_AVAILABLE`，提示先填上一日 |
| 删除已审/锁定 | 拒绝；需先反审 |
| 删除有日报的店铺 | 软删除（`status='inactive'`），保留历史 |
| 凭证上传中断 | 落 OSS 临时桶，24h 未关联清理 |
| 级联重算 | 单店单月最多 31 条；事务批量 update |
| 跨年汇总 | 索引 `(shop_id, report_date)`；最多 1 年范围 |
| 大量导出 | 异步任务，WebSocket 通知下载 |

### 6.4 校验策略（双层）

| 校验项 | 前端 | 后端 |
|-------|------|------|
| 必填、数值非负、日期不未来 | ✅ form 实时 | ✅ class-validator |
| 期末余额公式 | 预览 | ✅ 唯一计算源 |
| 数据范围 | 隐藏不可选 | ✅ Guard 强制（最终防线） |
| 状态合法 | 隐藏按钮 | ✅ 状态机校验 |

---

## 7. 测试策略

### 7.1 金字塔

```
       E2E (Playwright)       少 — 5-10 个核心旅程
       Integration (Vitest)   中 — 真 PostgreSQL container
       Unit (Vitest)          多 — 公式、状态机、纯函数
```

### 7.2 重点覆盖

**单元测试（必须 100%）**：
- `balance-calculator.service` — 各种输入组合，含 6 扩展字段两种假设
- `audit.service` — 状态机所有合法/非法转换
- 数据范围 Guard（mock 用户）

**集成测试（真 DB）**：
- 同店同日唯一约束
- 级联重算事务一致性
- 软删除策略
- 审计日志写入完整性
- 角色 + 数据范围的 SQL 实际过滤效果

**E2E 核心旅程**：
1. 员工录入 → 上传凭证 → 提交
2. 财务审 1
3. 老板审 2 锁定
4. 反审流程 → 编辑 → 重新审
5. 店长查看本店汇总
6. 越权尝试（员工看其他店）被拒绝

### 7.3 CI 流水线

```yaml
jobs:
  - check:type
  - lint
  - test:unit
  - test:integration  # 起 PostgreSQL container
  - test:e2e          # 起前后端 + DB
  - build
```

### 7.4 测试数据

- **fixtures**：`apps/backend/test/fixtures/` 固定 SQL（多品牌、多店、多角色）
- **factories**：`@faker-js/faker` 随机数据
- **隔离**：每个测试 transaction 包裹回滚

### 7.5 覆盖率目标

| 范围 | 目标 |
|------|------|
| 余额计算、状态机 | 100% |
| Service 层 | 80%+ |
| Controller 层 | 70%+ |
| 前端关键组件 | 60%+ |

---

## 8. 待业务方确认的问题

以下问题在设计阶段以"合理默认"处理，待业务方答复后调整：

1. **6 个扩展字段是否进入余额公式**
   - 默认假设：不进入
   - 调整点：`balance-calculator.service.ts` 一个文件

2. **凭证图片的字段级关联是否每个金额字段都要支持上传**
   - 默认假设：所有金额字段（revenue、transfer_to_company 等）都支持上传，备注字段不支持
   - 调整点：前端 `FieldAttachmentUpload.vue` 的允许字段配置

3. **谁能反审 2（解锁）**
   - 默认假设：仅 admin（老板"审 2"是终审承诺，反审 2 作为系统恢复操作只给管理员）
   - 候选方案：老板也可以反审 2
   - 调整点：`audit.service.ts` 的 `unlock` 方法角色校验

---

## 9. 实施路线图（高层）

| 阶段 | 内容 | 估计周期 |
|------|------|----------|
| **P0** 基础设施 | monorepo 配置、NestJS 初始化、Prisma + DB、packages/types | 1 周 |
| **P1** 认证 + 用户 | 登录、JWT、用户 CRUD、RBAC Guard、数据范围 Guard | 1 周 |
| **P2** 基础数据 | 品牌、店铺管理 + 前端页面 | 1 周 |
| **P3** 核心记账 | 资金日报录入、列表、编辑、级联重算 | 2 周 |
| **P4** 审核流程 | 状态机、审 1 / 审 2 / 反审、审核管理页面 | 1 周 |
| **P5** 凭证上传 | 字段级附件、OSS/MinIO 集成 | 0.5 周 |
| **P6** 汇总与导出 | 资金汇总表 + Excel 导出 | 0.5 周 |
| **P7** 联调测试 | E2E、性能、上线准备 | 1 周 |
| **总计** | | ~8 周 |

---

## 10. 不在 MVP 范围

- 多语言（系统已配置 i18n，但只用中文）
- 暗黑模式
- 移动端原生 App（响应式 Web 即可）
- 数据看板高级图表（仅基础统计）
- 通知中心、消息推送
- 第三方系统对接（ERP、支付）
