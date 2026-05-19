<script lang="ts" setup>
import type {
  AnalysisOverviewItem,
  WorkbenchQuickNavItem,
} from '@vben/common-ui';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  AnalysisChartCard,
  AnalysisOverview,
  WorkbenchQuickNav,
} from '@vben/common-ui';
import { useAccess } from '@vben/access';
import {
  SvgBellIcon,
  SvgCakeIcon,
  SvgCardIcon,
  SvgDownloadIcon,
} from '@vben/icons';
import { preferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';

import { NAvatar, NEmpty, NTag } from 'naive-ui';

import { listDailyReportsApi } from '#/api/finance';

defineOptions({ name: 'Home' });

const router = useRouter();
const userStore = useUserStore();
const { hasAccessByCodes } = useAccess();

const userRoles = computed(() => userStore.userRoles ?? []);

// 基于 authCode 的权限判断
const canViewSummary = computed(() => hasAccessByCodes(['finance:summary']));
const canViewDaily = computed(() => hasAccessByCodes(['finance:daily']));
const canManageUser = computed(() => hasAccessByCodes(['system:user']));
const canManageShop = computed(() => hasAccessByCodes(['system:shop']));
const canManageRole = computed(() => hasAccessByCodes(['system:role']));
const canManageBrand = computed(() => hasAccessByCodes(['system:brand']));

// 是否显示资金统计概览（有汇总权限即可见）
const canViewStats = computed(() => canViewSummary.value);
// 最近日报需要日报权限
const canViewRecent = computed(() => canViewDaily.value);

const today = computed(() => {
  const now = new Date();
  const weekDay = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${weekDay}`;
});

const roleLabels: Record<string, string> = {
  admin: '系统管理员',
  boss: '老板',
  finance: '财务',
  manager: '店长',
  staff: '员工',
};

const roleTags = computed(() => userRoles.value.map((r) => roleLabels[r] ?? r));

const stats = ref({
  total: 0,
  pending: 0,
  audited: 0,
  locked: 0,
  totalRevenue: 0,
});
const recentReports = ref<any[]>([]);

async function loadStats() {
  if (!canViewStats.value) return;
  try {
    const res = await listDailyReportsApi({ page: 1, pageSize: 100 });
    const items = res.items ?? [];
    stats.value.total = res.total ?? 0;
    stats.value.pending = items.filter((r) => r.status === 'pending').length;
    stats.value.audited = items.filter((r) => r.status === 'audited').length;
    stats.value.locked = items.filter((r) => r.status === 'locked').length;
    stats.value.totalRevenue = items.reduce(
      (sum, r) => sum + (Number(r.revenue) || 0),
      0,
    );
    recentReports.value = items.slice(0, 5);
  } catch {
    // user may not have permission
  }
}

const overviewItems = computed<AnalysisOverviewItem[]>(() => [
  {
    icon: SvgCardIcon,
    title: '日报总数',
    totalTitle: '累计日报',
    totalValue: stats.value.total,
    value: stats.value.total,
  },
  {
    icon: SvgBellIcon,
    title: '待审核',
    totalTitle: '待审核日报',
    totalValue: stats.value.pending,
    value: stats.value.pending,
  },
  {
    icon: SvgCakeIcon,
    title: '已审核',
    totalTitle: '已审核日报',
    totalValue: stats.value.audited,
    value: stats.value.audited,
  },
  {
    icon: SvgDownloadIcon,
    title: '已锁定',
    totalTitle: '已锁定日报',
    totalValue: stats.value.locked,
    value: stats.value.locked,
  },
]);

const quickNavItems = computed<WorkbenchQuickNavItem[]>(() => {
  const items: WorkbenchQuickNavItem[] = [];
  if (canViewDaily.value) {
    items.push({
      color: '#1fdaca',
      icon: 'lucide:file-text',
      title: '资金日报',
      url: '/finance/daily',
    });
  }
  if (canViewSummary.value) {
    items.push({
      color: '#3fb27f',
      icon: 'lucide:bar-chart-3',
      title: '资金汇总',
      url: '/finance/summary',
    });
  }
  if (canManageUser.value) {
    items.push({
      color: '#e18525',
      icon: 'lucide:users',
      title: '用户管理',
      url: '/system/user',
    });
  }
  if (canManageShop.value) {
    items.push({
      color: '#bf0c2c',
      icon: 'lucide:store',
      title: '店铺管理',
      url: '/system/shop',
    });
  }
  if (canManageRole.value) {
    items.push({
      color: '#7c3aed',
      icon: 'lucide:shield',
      title: '角色管理',
      url: '/system/role',
    });
  }
  if (canManageBrand.value) {
    items.push({
      color: '#0891b2',
      icon: 'lucide:tag',
      title: '品牌管理',
      url: '/system/brand',
    });
  }
  return items;
});

const statusMap: Record<
  string,
  { label: string; type: 'info' | 'success' | 'warning'; }
> = {
  pending: { type: 'warning', label: '未审' },
  audited: { type: 'info', label: '已审' },
  locked: { type: 'success', label: '锁定' },
};

function navTo(nav: WorkbenchQuickNavItem) {
  if (!nav.url) return;
  if (nav.url.startsWith('http')) {
    window.open(nav.url, '_blank');
  } else {
    router.push(nav.url);
  }
}

function fmt(val: string | undefined) {
  return val ? Number(val).toFixed(2) : '0.00';
}

function fmtMoney(val: number) {
  if (val >= 10_000) return `${(val / 10_000).toFixed(2)}万`;
  return val.toFixed(2);
}

onMounted(() => {
  loadStats();
});
</script>

<template>
  <div class="p-5">
    <!-- 自定义欢迎头部 -->
    <div class="welcome-header card-box">
      <NAvatar
        :src="userStore.userInfo?.avatar || preferences.app.defaultAvatar"
        :size="80"
        round
      />
      <div class="welcome-info">
        <h1 class="welcome-title">
          欢迎回来，{{ userStore.userInfo?.realName ?? '用户' }} 👋
        </h1>
        <p class="welcome-date">{{ today }}</p>
        <div class="welcome-tags">
          <NTag
            v-for="role in roleTags"
            :key="role"
            :bordered="false"
            type="primary"
            size="small"
            round
          >
            {{ role }}
          </NTag>
        </div>
      </div>

      <!-- 头部右侧概要数据（按权限） -->
      <div v-if="canViewStats" class="welcome-summary">
        <div class="summary-item">
          <span class="summary-label">本期日报</span>
          <span class="summary-value">{{ stats.total }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">待审核</span>
          <span class="summary-value warning">{{ stats.pending }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">累计营业额</span>
          <span class="summary-value primary">
            ¥{{ fmtMoney(stats.totalRevenue) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 数据概览（仅财务/老板可见） -->
    <AnalysisOverview v-if="canViewStats" :items="overviewItems" class="mt-5" />

    <div class="mt-5 w-full md:flex">
      <!-- 快捷导航 -->
      <AnalysisChartCard class="md:mr-4 md:w-1/2" title="快捷功能">
        <WorkbenchQuickNav :items="quickNavItems" title="" @click="navTo" />
      </AnalysisChartCard>

      <!-- 最近日报（仅店长以上可见） -->
      <AnalysisChartCard
        v-if="canViewRecent"
        class="mt-5 md:mt-0 md:w-1/2"
        title="最近日报"
      >
        <NEmpty
          v-if="recentReports.length === 0"
          description="暂无数据"
          style="padding: 32px 0"
        />
        <div v-else class="recent-list">
          <div
            v-for="report in recentReports"
            :key="report.id"
            class="recent-item"
            @click="router.push('/finance/daily')"
          >
            <div class="recent-item-left">
              <span class="recent-item-date">
                {{ report.reportDate?.slice(0, 10) }}
              </span>
              <NTag
                :type="statusMap[report.status]?.type ?? 'default'"
                size="small"
                :bordered="false"
              >
                {{ statusMap[report.status]?.label ?? report.status }}
              </NTag>
            </div>
            <div class="recent-item-right">
              <span class="recent-amount">¥{{ fmt(report.revenue) }}</span>
              <span class="recent-balance">
                余额 ¥{{ fmt(report.closingBalance) }}
              </span>
            </div>
          </div>
        </div>
      </AnalysisChartCard>
    </div>

    <!-- 普通员工的提示信息 -->
    <div v-if="!canViewRecent && !canViewStats" class="mt-5 staff-tip card-box">
      <div class="staff-tip-icon">📝</div>
      <div>
        <h3 class="staff-tip-title">开始记录今日资金流水</h3>
        <p class="staff-tip-desc">点击「资金日报」开始录入今日数据</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-header {
  display: flex;
  gap: 20px;
  align-items: center;
  padding: 24px;
}

.welcome-info {
  flex: 1;
  min-width: 0;
}

.welcome-title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.welcome-date {
  margin: 0 0 8px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.welcome-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.welcome-summary {
  display: flex;
  gap: 32px;
  align-items: center;
  padding-left: 24px;
  border-left: 1px solid hsl(var(--border));
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
  min-width: 80px;
}

.summary-label {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.summary-value {
  font-size: 22px;
  font-weight: 700;
  color: hsl(var(--foreground));
}

.summary-value.warning {
  color: #f0a020;
}

.summary-value.primary {
  color: #18a058;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  transition: all 0.2s ease;
}

.recent-item:hover {
  background: hsl(var(--muted) / 40%);
  border-color: hsl(var(--primary) / 50%);
}

.recent-item-left {
  display: flex;
  gap: 12px;
  align-items: center;
}

.recent-item-date {
  font-size: 14px;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.recent-item-right {
  display: flex;
  gap: 16px;
  align-items: center;
}

.recent-amount {
  font-size: 14px;
  font-weight: 600;
  color: #18a058;
}

.recent-balance {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.staff-tip {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 24px;
}

.staff-tip-icon {
  font-size: 48px;
}

.staff-tip-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.staff-tip-desc {
  margin: 0;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

@media (width <= 768px) {
  .welcome-header {
    flex-wrap: wrap;
  }

  .welcome-summary {
    width: 100%;
    padding: 16px 0 0;
    border-top: 1px solid hsl(var(--border));
    border-left: none;
  }
}
</style>
