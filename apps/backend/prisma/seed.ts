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

  // 2. Create menu tree
  // --- Dashboard catalog ---
  const dashboardCatalog = await prisma.menu.create({
    data: {
      type: MenuType.catalog,
      name: 'Dashboard',
      path: '/dashboard',
      component: 'BasicLayout',
      meta: { title: 'Dashboard', icon: 'lucide:layout-dashboard', order: 1 },
      sortOrder: 1,
    },
  });

  const workspaceMenu = await prisma.menu.create({
    data: {
      parentId: dashboardCatalog.id,
      type: MenuType.menu,
      name: 'Workspace',
      path: '/dashboard/workspace',
      component: '/dashboard/workspace/index',
      authCode: 'dashboard:workspace',
      meta: { title: 'Workspace' },
      sortOrder: 1,
    },
  });

  // --- Reports catalog ---
  const reportsCatalog = await prisma.menu.create({
    data: {
      type: MenuType.catalog,
      name: 'Reports',
      path: '/reports',
      component: 'BasicLayout',
      meta: { title: 'Reports', icon: 'lucide:file-text', order: 2 },
      sortOrder: 2,
    },
  });

  const reportListMenu = await prisma.menu.create({
    data: {
      parentId: reportsCatalog.id,
      type: MenuType.menu,
      name: 'ReportList',
      path: '/reports/list',
      component: '/reports/list/index',
      authCode: 'report:list',
      meta: { title: 'ReportList' },
      sortOrder: 1,
    },
  });

  const reportSubmitMenu = await prisma.menu.create({
    data: {
      parentId: reportsCatalog.id,
      type: MenuType.menu,
      name: 'ReportSubmit',
      path: '/reports/submit',
      component: '/reports/submit/index',
      authCode: 'report:submit',
      meta: { title: 'ReportSubmit' },
      sortOrder: 2,
    },
  });

  // Report button permissions
  const reportButtons = [
    { name: 'report:create', authCode: 'report:create', sortOrder: 3 },
    { name: 'report:view-own', authCode: 'report:view-own', sortOrder: 4 },
    { name: 'report:view-shop', authCode: 'report:view-shop', sortOrder: 5 },
    { name: 'report:view-all', authCode: 'report:view-all', sortOrder: 6 },
    { name: 'report:approve', authCode: 'report:approve', sortOrder: 7 },
    { name: 'report:export', authCode: 'report:export', sortOrder: 8 },
    { name: 'report:dashboard', authCode: 'report:dashboard', sortOrder: 9 },
  ];

  const reportButtonMenus: Record<string, { id: string }> = {};
  for (const btn of reportButtons) {
    reportButtonMenus[btn.authCode] = await prisma.menu.create({
      data: {
        parentId: reportsCatalog.id,
        type: MenuType.button,
        name: btn.name,
        authCode: btn.authCode,
        meta: { title: btn.name },
        sortOrder: btn.sortOrder,
      },
    });
  }

  // --- System catalog ---
  const systemCatalog = await prisma.menu.create({
    data: {
      type: MenuType.catalog,
      name: 'System',
      path: '/system',
      component: 'BasicLayout',
      meta: { title: 'System', icon: 'lucide:settings', order: 3 },
      sortOrder: 3,
    },
  });

  const systemMenus = [
    {
      name: 'UserList',
      path: '/system/users',
      component: '/system/users/index',
      authCode: 'system:user:list',
      sortOrder: 1,
    },
    {
      name: 'ShopList',
      path: '/system/shops',
      component: '/system/shops/index',
      authCode: 'system:shop:list',
      sortOrder: 2,
    },
    {
      name: 'BrandList',
      path: '/system/brands',
      component: '/system/brands/index',
      authCode: 'system:brand:list',
      sortOrder: 3,
    },
    {
      name: 'RoleList',
      path: '/system/roles',
      component: '/system/roles/index',
      authCode: 'system:role:list',
      sortOrder: 4,
    },
    {
      name: 'MenuList',
      path: '/system/menus',
      component: '/system/menus/index',
      authCode: 'system:menu:list',
      sortOrder: 5,
    },
  ];

  const systemMenuRecords: Record<string, { id: string }> = {};
  for (const m of systemMenus) {
    systemMenuRecords[m.authCode] = await prisma.menu.create({
      data: {
        parentId: systemCatalog.id,
        type: MenuType.menu,
        name: m.name,
        path: m.path,
        component: m.component,
        authCode: m.authCode,
        meta: { title: m.name },
        sortOrder: m.sortOrder,
      },
    });
  }

  // System button permissions
  const systemButtons = [
    { name: 'user:manage', authCode: 'user:manage', sortOrder: 6 },
    { name: 'shop:manage', authCode: 'shop:manage', sortOrder: 7 },
    { name: 'brand:manage', authCode: 'brand:manage', sortOrder: 8 },
    { name: 'role:manage', authCode: 'role:manage', sortOrder: 9 },
    { name: 'menu:manage', authCode: 'menu:manage', sortOrder: 10 },
  ];

  const systemButtonMenus: Record<string, { id: string }> = {};
  for (const btn of systemButtons) {
    systemButtonMenus[btn.authCode] = await prisma.menu.create({
      data: {
        parentId: systemCatalog.id,
        type: MenuType.button,
        name: btn.name,
        authCode: btn.authCode,
        meta: { title: btn.name },
        sortOrder: btn.sortOrder,
      },
    });
  }

  // 3. Create role-menu associations
  // Collect all menu IDs for admin (gets everything)
  const allMenuIds = [
    dashboardCatalog.id,
    workspaceMenu.id,
    reportsCatalog.id,
    reportListMenu.id,
    reportSubmitMenu.id,
    ...Object.values(reportButtonMenus).map((m) => m.id),
    systemCatalog.id,
    ...Object.values(systemMenuRecords).map((m) => m.id),
    ...Object.values(systemButtonMenus).map((m) => m.id),
  ];

  // Admin gets ALL
  await prisma.roleMenu.createMany({
    data: allMenuIds.map((menuId) => ({
      roleId: id(roles, 'admin'),
      menuId,
    })),
  });

  // Boss: Dashboard, Reports (all buttons except report:approve), System read-only
  const bossMenuIds = [
    dashboardCatalog.id,
    workspaceMenu.id,
    reportsCatalog.id,
    reportListMenu.id,
    reportSubmitMenu.id,
    id(reportButtonMenus, 'report:create'),
    id(reportButtonMenus, 'report:view-own'),
    id(reportButtonMenus, 'report:view-shop'),
    id(reportButtonMenus, 'report:view-all'),
    id(reportButtonMenus, 'report:export'),
    id(reportButtonMenus, 'report:dashboard'),
    systemCatalog.id,
    id(systemMenuRecords, 'system:user:list'),
    id(systemMenuRecords, 'system:shop:list'),
    id(systemMenuRecords, 'system:brand:list'),
  ];

  await prisma.roleMenu.createMany({
    data: bossMenuIds.map((menuId) => ({
      roleId: id(roles, 'boss'),
      menuId,
    })),
  });

  // Finance: Dashboard, Reports (report:view-all, report:export)
  const financeMenuIds = [
    dashboardCatalog.id,
    workspaceMenu.id,
    reportsCatalog.id,
    reportListMenu.id,
    reportSubmitMenu.id,
    id(reportButtonMenus, 'report:view-all'),
    id(reportButtonMenus, 'report:export'),
  ];

  await prisma.roleMenu.createMany({
    data: financeMenuIds.map((menuId) => ({
      roleId: id(roles, 'finance'),
      menuId,
    })),
  });

  // Manager: Dashboard, Reports (report:create, report:view-shop, report:approve)
  const managerMenuIds = [
    dashboardCatalog.id,
    workspaceMenu.id,
    reportsCatalog.id,
    reportListMenu.id,
    reportSubmitMenu.id,
    id(reportButtonMenus, 'report:create'),
    id(reportButtonMenus, 'report:view-shop'),
    id(reportButtonMenus, 'report:approve'),
  ];

  await prisma.roleMenu.createMany({
    data: managerMenuIds.map((menuId) => ({
      roleId: id(roles, 'manager'),
      menuId,
    })),
  });

  // Staff: Dashboard, Reports (report:create, report:view-own)
  const staffMenuIds = [
    dashboardCatalog.id,
    workspaceMenu.id,
    reportsCatalog.id,
    reportListMenu.id,
    reportSubmitMenu.id,
    id(reportButtonMenus, 'report:create'),
    id(reportButtonMenus, 'report:view-own'),
  ];

  await prisma.roleMenu.createMany({
    data: staffMenuIds.map((menuId) => ({
      roleId: id(roles, 'staff'),
      menuId,
    })),
  });

  // 4. Create admin user and link to admin role
  const passwordHash = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash,
      displayName: '系统管理员',
      status: UserStatus.active,
    },
  });

  await prisma.userRoleRelation.create({
    data: {
      userId: adminUser.id,
      roleId: id(roles, 'admin'),
    },
  });

  console.warn('Seed completed successfully:');
  console.warn('  - 5 system roles created');
  console.warn('  - Menu tree created (3 catalogs, 8 menus, 12 buttons)');
  console.warn('  - Role-menu associations created');
  console.warn('  - Admin user created (username=admin, password=admin123)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
