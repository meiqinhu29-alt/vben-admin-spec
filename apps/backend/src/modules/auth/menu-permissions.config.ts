import { UserRole } from '@vben/types';

interface MenuItem {
  name: string;
  path: string;
  meta: {
    title: string;
    icon?: string;
    order?: number;
  };
  component?: string;
  children?: MenuItem[];
}

const ALL_MENUS: MenuItem[] = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    meta: { title: '工作台', icon: 'lucide:layout-dashboard', order: 1 },
    component: 'BasicLayout',
    children: [
      {
        name: 'Workspace',
        path: '/dashboard/workspace',
        meta: { title: '工作台' },
        component: '/dashboard/workspace/index',
      },
    ],
  },
  {
    name: 'Reports',
    path: '/reports',
    meta: { title: '日报管理', icon: 'lucide:file-text', order: 2 },
    component: 'BasicLayout',
    children: [
      {
        name: 'ReportList',
        path: '/reports/list',
        meta: { title: '日报列表' },
        component: '/reports/list/index',
      },
      {
        name: 'ReportSubmit',
        path: '/reports/submit',
        meta: { title: '提交日报' },
        component: '/reports/submit/index',
      },
    ],
  },
  {
    name: 'System',
    path: '/system',
    meta: { title: '系统管理', icon: 'lucide:settings', order: 99 },
    component: 'BasicLayout',
    children: [
      {
        name: 'UserList',
        path: '/system/users',
        meta: { title: '用户管理' },
        component: '/system/users/index',
      },
      {
        name: 'ShopList',
        path: '/system/shops',
        meta: { title: '门店管理' },
        component: '/system/shops/index',
      },
    ],
  },
];

export const ROLE_MENU_MAP: Record<UserRole, MenuItem[]> = {
  [UserRole.Staff]: [ALL_MENUS[0], ALL_MENUS[1]],
  [UserRole.Manager]: [ALL_MENUS[0], ALL_MENUS[1]],
  [UserRole.Finance]: [ALL_MENUS[0], ALL_MENUS[1]],
  [UserRole.Boss]: [ALL_MENUS[0], ALL_MENUS[1]],
  [UserRole.Admin]: ALL_MENUS,
};

export const ROLE_CODES_MAP: Record<UserRole, string[]> = {
  [UserRole.Staff]: ['report:create', 'report:view-own'],
  [UserRole.Manager]: ['report:create', 'report:view-shop', 'report:approve'],
  [UserRole.Finance]: ['report:view-all', 'report:export'],
  [UserRole.Boss]: ['report:view-all', 'report:export', 'report:dashboard'],
  [UserRole.Admin]: [
    'report:create',
    'report:view-all',
    'report:approve',
    'report:export',
    'report:dashboard',
    'user:manage',
    'shop:manage',
  ],
};

export type { MenuItem };
