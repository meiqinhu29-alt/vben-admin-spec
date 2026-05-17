import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:notebook-pen',
      order: 10,
      title: '财务管理',
    },
    name: 'Finance',
    path: '/finance',
    redirect: '/finance/daily',
    children: [
      {
        name: 'DailyReport',
        path: '/finance/daily',
        component: () => import('#/views/finance/daily/index.vue'),
        meta: {
          icon: 'lucide:file-text',
          title: '资金日报',
        },
      },
    ],
  },
];

export default routes;
