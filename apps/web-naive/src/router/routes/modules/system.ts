import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:settings',
      order: 90,
      title: '系统管理',
      authority: ['admin'],
    },
    name: 'System',
    path: '/system',
    redirect: '/system/role',
    children: [
      {
        name: 'RoleManagement',
        path: '/system/role',
        component: () => import('#/views/system/role/index.vue'),
        meta: {
          icon: 'lucide:shield',
          title: '角色管理',
          authority: ['admin'],
        },
      },
      {
        name: 'MenuManagement',
        path: '/system/menu',
        component: () => import('#/views/system/menu/index.vue'),
        meta: {
          icon: 'lucide:list-tree',
          title: '菜单管理',
          authority: ['admin'],
        },
      },
    ],
  },
];

export default routes;
