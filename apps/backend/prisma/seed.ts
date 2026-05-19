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
    { code: 'admin', name: '系统管理员' },
    { code: 'boss', name: '老板' },
    { code: 'finance', name: '财务' },
    { code: 'manager', name: '店长' },
    { code: 'staff', name: '员工' },
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

  // 3. 分配角色权限
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
  ];

  // Admin 拥有所有权限
  await prisma.roleMenu.createMany({
    data: allMenuIds.map((menuId) => ({
      roleId: id(roles, 'admin'),
      menuId,
    })),
  });

  // Boss 拥有资金管理的所有权限
  await prisma.roleMenu.createMany({
    data: [financeCatalog.id, dailyReportMenu.id, summaryMenu.id].map(
      (menuId) => ({
        roleId: id(roles, 'boss'),
        menuId,
      }),
    ),
  });

  // Finance 拥有资金管理的所有权限
  await prisma.roleMenu.createMany({
    data: [financeCatalog.id, dailyReportMenu.id, summaryMenu.id].map(
      (menuId) => ({
        roleId: id(roles, 'finance'),
        menuId,
      }),
    ),
  });

  // Manager 拥有资金日报权限
  await prisma.roleMenu.createMany({
    data: [financeCatalog.id, dailyReportMenu.id].map((menuId) => ({
      roleId: id(roles, 'manager'),
      menuId,
    })),
  });

  // Staff 拥有资金日报权限
  await prisma.roleMenu.createMany({
    data: [financeCatalog.id, dailyReportMenu.id].map((menuId) => ({
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
