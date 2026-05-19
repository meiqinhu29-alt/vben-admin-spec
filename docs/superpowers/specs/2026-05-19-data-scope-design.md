# 数据权限（Data Scope）设计方案

## 背景

当前系统已有 RBAC 功能权限（菜单/按钮），但缺少数据权限。需求：店主只能管理自己店铺的相关信息（店铺、用户、品牌、资金数据）。

## 设计原则

1. **不另起炉灶** — 复用现有 `Role` + `UserShopAccess`
2. **数据库驱动** — 配置存到 DB，不写死代码
3. **与功能权限正交** — 功能权限决定"能看到哪个页面"，数据权限决定"看到哪些数据"
4. **分期实现** — 先读后写

## 核心概念

```
功能权限（已有）：用户能进哪些页面 / 能点哪些按钮
   ↓ 由 Role.menus (RoleMenu) 决定

数据权限（新增）：在能进的页面中，能看到/操作哪些数据记录
   ↓ 由 Role.dataScope 决定
```

## 数据模型

### 1. Role 表加字段（已加）

```prisma
model Role {
  ...
  dataScope DataScope @default(all)
}

enum DataScope {
  all   // 所有数据（admin）
  shop  // 仅自己被分配的店铺数据（boss/finance/manager/staff）
  self  // 仅自己创建/相关的数据（保留扩展）
}
```

### 2. 复用 UserShopAccess（已有）

记录用户被分配的店铺。原本就用于权限控制，现在作为 `dataScope='shop'` 的数据源。

### 3. 多角色合并规则

用户有多个角色时，取**最宽松**的 scope：
- 任一角色为 `all` → 用户视为 `all`
- 否则任一角色为 `shop` → 用户视为 `shop`
- 全部 `self` → 用户视为 `self`

## 各实体的数据过滤规则

假设用户的 effective scope = `shop`，绑定店铺 S = {s1, s2}：

| 实体 | 过滤条件 |
|------|---------|
| 资金日报 | `shopId IN S` |
| 资金汇总 | 仅聚合 `shopId IN S` 的日报 |
| 店铺 | `id IN S` |
| 用户 | 用户的 `UserShopAccess` 与 S 有交集 |
| 品牌 | 品牌下有店铺 ∈ S |
| 角色 | 不过滤（可见所有角色，但不能改 admin 等系统角色） |
| 菜单 | 不过滤（菜单元数据不涉及业务数据） |

`scope='all'` → 不加任何过滤
`scope='self'` → 仅 `createdBy = userId`（需要资源有 createdBy 字段）

## 默认配置

| 角色 | functionScope（菜单） | dataScope |
|------|---------------------|-----------|
| admin | 全部菜单 | all |
| boss | 资金管理 | shop |
| finance | 资金管理 | shop |
| manager | 资金日报 | shop |
| staff | 资金日报 | shop |

## 实施分期

### Phase 1：读过滤（本次）

**后端**：
1. 创建 `DataScopeService.resolveUserScope(userId)` → `{ scope, shopIds }`
2. 在 List 接口里应用过滤：
   - `GET /api/daily-reports` ✓
   - `GET /api/summary` ✓
   - `GET /api/shops` ✓
   - `GET /api/users` ✓
   - `GET /api/brands` ✓
3. `getById` 接口检查访问权限：访问无权限资源返回 404

**前端**：
- 几乎不动 — 数据已在后端过滤
- 可选：店铺下拉框只展示用户能访问的店铺

**E2E 测试**：
- admin 看到全部 ✓
- boss/finance/manager/staff 仅看到分配店铺的数据 ✓
- 跨店铺访问其他店铺资源 → 404

### Phase 2：写校验（后续）

在 Update/Delete/Create 接口加校验：
- 修改/删除资源前先校验是否在 user 的 scope 内
- 创建资源时若指定 shopId，校验是否在 user 的 scope 内
- 给老板的"创建店铺"提供受控通道：boss 可创建，但创建后自动绑到自己

### Phase 3（可选）：管理界面

在"角色管理"页面增加：
- 编辑角色时可选 `dataScope`：all/shop/self
- 对应 UI：单选框 "全部数据 / 自己店铺 / 仅自己创建"

## 实现细节

### DataScopeService

```ts
@Injectable()
export class DataScopeService {
  constructor(private prisma: PrismaService) {}

  // 返回用户最宽松的数据范围
  async resolveUserScope(userId: string): Promise<{
    scope: 'all' | 'shop' | 'self';
    shopIds: string[]; // 仅 scope='shop' 时有值
  }> {
    const userRoles = await this.prisma.userRoleRelation.findMany({
      where: { userId, role: { status: 'active' } },
      include: { role: { select: { dataScope: true } } },
    });
    const scopes = userRoles.map(ur => ur.role.dataScope);

    let scope: 'all' | 'shop' | 'self' = 'self';
    if (scopes.includes('all')) scope = 'all';
    else if (scopes.includes('shop')) scope = 'shop';

    let shopIds: string[] = [];
    if (scope === 'shop') {
      const access = await this.prisma.userShopAccess.findMany({
        where: { userId },
        select: { shopId: true },
      });
      shopIds = access.map(a => a.shopId);
    }
    return { scope, shopIds };
  }
}
```

### 在 service 中应用

```ts
async listReports(userId: string, query: ListQuery) {
  const { scope, shopIds } = await this.dataScope.resolveUserScope(userId);

  const where: any = {};
  if (scope === 'shop') where.shopId = { in: shopIds };
  if (scope === 'self') where.createdBy = userId;
  // scope === 'all' 不加条件

  // 合并业务过滤条件
  ...

  return this.prisma.dailyFundsReport.findMany({ where });
}
```

## 风险与注意事项

1. **空 shopIds 处理**：`scope='shop'` 但用户未分配店铺 → `shopIds=[]`，查询应返回空数组（避免误返回所有数据）
2. **admin 创建数据时不绑定 shop**：若 admin 创建日报但本身没有 UserShopAccess，shop scope 用户也能看到（取决于业务）
3. **分配店铺界面**：boss 创建用户时需要能选店铺，但只能选自己有权限的店铺
4. **审计日志**：`auditLog` 记录的是操作历史，目前不做数据隔离（业务上需要）

## 测试场景

| 场景 | 预期 |
|------|------|
| admin 列表查询 | 看到所有 |
| boss 绑了店铺 A，查日报 | 仅看店铺 A 的日报 |
| boss 未绑店铺，查日报 | 空列表 |
| boss 直接访问别店日报 ID | 404 |
| admin 把店铺 B 也分配给 boss | boss 立即可见 B |
| 删除 UserShopAccess | 用户立即看不见对应店铺数据 |

---

## 需要你确认的几点

1. **多角色用户的策略**：取最宽松还是按用户主角色？（默认：最宽松）
2. **scope='self' 是否本次实现**？（我倾向于本次只做 all 和 shop，self 留 Phase 3）
3. **空 shopIds 行为**：scope='shop' 但用户未分配店铺 → 返回空 vs 报错？（默认：空列表）
4. **是否在前端店铺下拉里也过滤**？还是保留可选所有店铺由后端校验？（默认：前端也过滤）
