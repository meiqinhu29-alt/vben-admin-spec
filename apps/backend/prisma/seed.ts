import process from 'node:process';

import { MenuType, PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Clean existing data (order matters for FK constraints)
  await prisma.userPermission.deleteMany({});
  await prisma.roleMenu.deleteMany({});
  await prisma.userRoleRelation.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.userShopAccess.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.reportAttachment.deleteMany({});
  await prisma.dailyFundsReport.deleteMany({});
  await prisma.shop.deleteMany({});
  await prisma.brand.deleteMany({});
  await prisma.menu.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Create system roles
  const roleData = [
    { code: 'admin', name: '系统管理员', dataScope: 'all' as const },
    { code: 'boss', name: '老板', dataScope: 'shop' as const },
    { code: 'finance', name: '财务', dataScope: 'shop' as const },
    { code: 'manager', name: '店长', dataScope: 'shop' as const },
    { code: 'staff', name: '员工', dataScope: 'self' as const },
  ];

  const roles = {} as Record<string, { id: string }>;
  for (const r of roleData) {
    roles[r.code] = await prisma.role.create({
      data: { ...r, isSystem: true },
    });
  }

  function id(map: Record<string, { id: string }>, key: string): string {
    const entry = map[key];
    if (!entry) throw new Error(`Missing seed entry: ${key}`);
    return entry.id;
  }

  // 2. Create menu tree - 只保留实际业务菜单
  // --- 资金管理 catalog ---
  const financeCatalog = await prisma.menu.create({
    data: {
      type: MenuType.catalog,
      name: 'Finance',
      path: '/finance',
      component: 'BasicLayout',
      meta: { title: '资金管理', icon: 'lucide:wallet', order: 1 },
      sortOrder: 1,
    },
  });

  const dailyReportMenu = await prisma.menu.create({
    data: {
      parentId: financeCatalog.id,
      type: MenuType.menu,
      name: 'DailyReport',
      path: '/finance/daily',
      component: '/finance/daily/index',
      authCode: 'finance:daily',
      meta: { title: '资金日报' },
      sortOrder: 1,
    },
  });

  const summaryMenu = await prisma.menu.create({
    data: {
      parentId: financeCatalog.id,
      type: MenuType.menu,
      name: 'Summary',
      path: '/finance/summary',
      component: '/finance/summary/index',
      authCode: 'finance:summary',
      meta: { title: '资金汇总' },
      sortOrder: 2,
    },
  });

  // --- 系统管理 catalog ---
  const systemCatalog = await prisma.menu.create({
    data: {
      type: MenuType.catalog,
      name: 'System',
      path: '/system',
      component: 'BasicLayout',
      meta: { title: '系统管理', icon: 'lucide:settings', order: 2 },
      sortOrder: 2,
    },
  });

  const userMenu = await prisma.menu.create({
    data: {
      parentId: systemCatalog.id,
      type: MenuType.menu,
      name: 'UserManagement',
      path: '/system/user',
      component: '/system/user/index',
      authCode: 'system:user',
      meta: { title: '用户管理' },
      sortOrder: 1,
    },
  });

  const roleMenu = await prisma.menu.create({
    data: {
      parentId: systemCatalog.id,
      type: MenuType.menu,
      name: 'RoleManagement',
      path: '/system/role',
      component: '/system/role/index',
      authCode: 'system:role',
      meta: { title: '角色管理' },
      sortOrder: 2,
    },
  });

  const shopMenu = await prisma.menu.create({
    data: {
      parentId: systemCatalog.id,
      type: MenuType.menu,
      name: 'ShopManagement',
      path: '/system/shop',
      component: '/system/shop/index',
      authCode: 'system:shop',
      meta: { title: '店铺管理' },
      sortOrder: 3,
    },
  });

  const brandMenu = await prisma.menu.create({
    data: {
      parentId: systemCatalog.id,
      type: MenuType.menu,
      name: 'BrandManagement',
      path: '/system/brand',
      component: '/system/brand/index',
      authCode: 'system:brand',
      meta: { title: '品牌管理' },
      sortOrder: 4,
    },
  });

  const menuMenu = await prisma.menu.create({
    data: {
      parentId: systemCatalog.id,
      type: MenuType.menu,
      name: 'MenuManagement',
      path: '/system/menu',
      component: '/system/menu/index',
      authCode: 'system:menu',
      meta: { title: '菜单管理' },
      sortOrder: 5,
    },
  });

  // 2.5 按钮型权限点（authCode）— 供前端 hasAccessByCodes 检查
  // 资金日报操作按钮
  const dailyReportButtons = [
    { authCode: 'report:create', name: '创建日报' },
    { authCode: 'report:edit', name: '编辑日报' },
    { authCode: 'report:delete', name: '删除日报' },
    { authCode: 'report:audit', name: '审核日报' },
    { authCode: 'report:reject', name: '反审日报' },
    { authCode: 'report:lock', name: '锁定日报' },
    { authCode: 'report:unlock', name: '解锁日报' },
  ];
  const reportButtonMenus: Record<string, { id: string }> = {};
  for (const [i, btn] of dailyReportButtons.entries()) {
    reportButtonMenus[btn.authCode] = await prisma.menu.create({
      data: {
        parentId: dailyReportMenu.id,
        type: MenuType.button,
        name: btn.name,
        authCode: btn.authCode,
        meta: { title: btn.name },
        sortOrder: i + 1,
      },
    });
  }

  // 资金汇总按钮
  const summaryExportBtn = await prisma.menu.create({
    data: {
      parentId: summaryMenu.id,
      type: MenuType.button,
      name: '导出汇总',
      authCode: 'summary:export',
      meta: { title: '导出汇总' },
      sortOrder: 1,
    },
  });

  // 系统管理操作按钮（admin 专属）
  const sysButtons = [
    { authCode: 'system:user:manage', parent: userMenu, name: '管理用户' },
    { authCode: 'system:role:manage', parent: roleMenu, name: '管理角色' },
    { authCode: 'system:shop:manage', parent: shopMenu, name: '管理店铺' },
    { authCode: 'system:brand:manage', parent: brandMenu, name: '管理品牌' },
    { authCode: 'system:menu:manage', parent: menuMenu, name: '管理菜单' },
  ];
  const sysButtonMenus: Record<string, { id: string }> = {};
  for (const [i, btn] of sysButtons.entries()) {
    sysButtonMenus[btn.authCode] = await prisma.menu.create({
      data: {
        parentId: btn.parent.id,
        type: MenuType.button,
        name: btn.name,
        authCode: btn.authCode,
        meta: { title: btn.name },
        sortOrder: i + 1,
      },
    });
  }

  // 3. 分配角色权限
  // Admin 拥有所有菜单和按钮
  const allMenuIds = [
    financeCatalog.id,
    dailyReportMenu.id,
    summaryMenu.id,
    systemCatalog.id,
    userMenu.id,
    roleMenu.id,
    shopMenu.id,
    brandMenu.id,
    menuMenu.id,
    ...Object.values(reportButtonMenus).map((m) => m.id),
    summaryExportBtn.id,
    ...Object.values(sysButtonMenus).map((m) => m.id),
  ];
  await prisma.roleMenu.createMany({
    data: allMenuIds.map((menuId) => ({
      roleId: id(roles, 'admin'),
      menuId,
    })),
  });

  // Boss 老板：看资金管理，锁定日报、导出汇总
  const bossMenuIds = [
    financeCatalog.id,
    dailyReportMenu.id,
    summaryMenu.id,
    reportButtonMenus['report:lock']!.id,
    reportButtonMenus['report:unlock']!.id,
    summaryExportBtn.id,
  ];
  await prisma.roleMenu.createMany({
    data: bossMenuIds.map((menuId) => ({
      roleId: id(roles, 'boss'),
      menuId,
    })),
  });

  // Finance 财务：录入/编辑日报、审核反审、导出汇总
  const financeMenuIds = [
    financeCatalog.id,
    dailyReportMenu.id,
    summaryMenu.id,
    reportButtonMenus['report:create']!.id,
    reportButtonMenus['report:edit']!.id,
    reportButtonMenus['report:delete']!.id,
    reportButtonMenus['report:audit']!.id,
    reportButtonMenus['report:reject']!.id,
    summaryExportBtn.id,
  ];
  await prisma.roleMenu.createMany({
    data: financeMenuIds.map((menuId) => ({
      roleId: id(roles, 'finance'),
      menuId,
    })),
  });

  // Manager 店长：录入/编辑/删除日报
  const managerMenuIds = [
    financeCatalog.id,
    dailyReportMenu.id,
    reportButtonMenus['report:create']!.id,
    reportButtonMenus['report:edit']!.id,
    reportButtonMenus['report:delete']!.id,
  ];
  await prisma.roleMenu.createMany({
    data: managerMenuIds.map((menuId) => ({
      roleId: id(roles, 'manager'),
      menuId,
    })),
  });

  // Staff 员工：录入/编辑日报
  const staffMenuIds = [
    financeCatalog.id,
    dailyReportMenu.id,
    reportButtonMenus['report:create']!.id,
    reportButtonMenus['report:edit']!.id,
  ];
  await prisma.roleMenu.createMany({
    data: staffMenuIds.map((menuId) => ({
      roleId: id(roles, 'staff'),
      menuId,
    })),
  });

  // 4. 创建默认用户（每种角色一个）
  const passwordHash = await bcrypt.hash('admin123', 10);

  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash,
      displayName: '系统管理员',
      status: UserStatus.active,
    },
  });

  const bossUser = await prisma.user.create({
    data: {
      username: 'boss',
      passwordHash,
      displayName: '老板',
      status: UserStatus.active,
    },
  });

  const financeUser = await prisma.user.create({
    data: {
      username: 'finance',
      passwordHash,
      displayName: '财务',
      status: UserStatus.active,
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      username: 'manager',
      passwordHash,
      displayName: '店长',
      status: UserStatus.active,
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      username: 'staff',
      passwordHash,
      displayName: '员工',
      status: UserStatus.active,
    },
  });

  // 5. 分配用户角色
  await prisma.userRoleRelation.createMany({
    data: [
      { userId: adminUser.id, roleId: id(roles, 'admin') },
      { userId: bossUser.id, roleId: id(roles, 'boss') },
      { userId: financeUser.id, roleId: id(roles, 'finance') },
      { userId: managerUser.id, roleId: id(roles, 'manager') },
      { userId: staffUser.id, roleId: id(roles, 'staff') },
    ],
  });

  console.log('✅ Seed data created successfully');
  console.log('📝 Default accounts:');
  console.log('   - admin / admin123 (系统管理员)');
  console.log('   - boss / admin123 (老板)');
  console.log('   - finance / admin123 (财务)');
  console.log('   - manager / admin123 (店长)');
  console.log('   - staff / admin123 (员工)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
