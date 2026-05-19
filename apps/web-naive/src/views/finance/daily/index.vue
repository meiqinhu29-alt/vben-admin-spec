<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui';

import type { DailyReport } from '#/api/finance';

import { computed, h, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NGi,
  NGrid,
  NPopconfirm,
  NSelect,
  NSpace,
  NStatistic,
  NTag,
  useMessage,
} from 'naive-ui';

import {
  auditReportApi,
  deleteDailyReportApi,
  listDailyReportsApi,
  lockReportApi,
  rejectReportApi,
  unlockReportApi,
} from '#/api/finance';
import { listShopsApi } from '#/api/system';

import ReportDetailModal from './components/report-detail-modal.vue';
import ReportFormModal from './components/report-form-modal.vue';

defineOptions({ name: 'DailyReportList' });

const message = useMessage();
const userStore = useUserStore();

const roles = computed(() => userStore.userRoles ?? []);
const isAdmin = computed(() => roles.value.includes('admin'));
const isFinance = computed(
  () => roles.value.includes('finance') || isAdmin.value,
);
const isBoss = computed(() => roles.value.includes('boss') || isAdmin.value);

const loading = ref(false);
const data = ref<DailyReport[]>([]);
const pagination = reactive({ page: 1, pageSize: 20, itemCount: 0 });

const shopOptions = ref<{ label: string; value: string }[]>([]);
const filterShopIds = ref<string[]>([]);
const filterStatuses = ref<string[]>([]);
const filterDateRange = ref<[number, number] | null>(null);

const showFormModal = ref(false);
const editingReport = ref<DailyReport | null>(null);
const showDetailModal = ref(false);
const detailReport = ref<DailyReport | null>(null);

const statusOptions = [
  { label: '未审', value: 'pending' },
  { label: '已审', value: 'audited' },
  { label: '锁定', value: 'locked' },
];

const shopMap = computed(() => {
  const m: Record<string, string> = {};
  for (const s of shopOptions.value) m[s.value] = s.label;
  return m;
});

const numericKeys: (keyof DailyReport)[] = [
  'openingBalance',
  'revenue',
  'cardFee',
  'actualRevenue',
  'transferToCompany',
  'depositToCompany',
  'shopExpense',
  'payToOwner',
  'closingBalance',
];

const totals = computed(() => {
  const t: Record<string, number> = {};
  for (const k of numericKeys) {
    t[k] = data.value.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  }
  return t;
});

async function fetchData() {
  loading.value = true;
  try {
    const params: Record<string, any> = {
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
    if (filterShopIds.value.length > 0)
      params.shopIds = filterShopIds.value.join(',');
    if (filterStatuses.value.length > 0)
      params.statuses = filterStatuses.value.join(',');
    if (filterDateRange.value) {
      params.dateFrom = new Date(filterDateRange.value[0])
        .toISOString()
        .slice(0, 10);
      params.dateTo = new Date(filterDateRange.value[1])
        .toISOString()
        .slice(0, 10);
    }
    const res = await listDailyReportsApi(params);
    data.value = res.items;
    pagination.itemCount = res.total;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.page = 1;
  fetchData();
}

function handleCreate() {
  editingReport.value = null;
  showFormModal.value = true;
}

function handleEdit(row: DailyReport) {
  editingReport.value = row;
  showFormModal.value = true;
}

async function handleDelete(row: DailyReport) {
  try {
    await deleteDailyReportApi(row.id);
    message.success('删除成功');
    fetchData();
  } catch {
    message.error('删除失败');
  }
}

async function handleAudit(row: DailyReport) {
  try {
    await auditReportApi(row.id);
    message.success('审核成功');
    fetchData();
  } catch {
    message.error('审核失败');
  }
}

async function handleReject(row: DailyReport) {
  try {
    await rejectReportApi(row.id);
    message.success('反审成功');
    fetchData();
  } catch {
    message.error('反审失败');
  }
}

async function handleLock(row: DailyReport) {
  try {
    await lockReportApi(row.id);
    message.success('锁定成功');
    fetchData();
  } catch {
    message.error('锁定失败');
  }
}

async function handleUnlock(row: DailyReport) {
  try {
    await unlockReportApi(row.id);
    message.success('解锁成功');
    fetchData();
  } catch {
    message.error('解锁失败');
  }
}

function handleSaved() {
  showFormModal.value = false;
  fetchData();
}

function handleRowClick(row: DailyReport) {
  detailReport.value = row;
  showDetailModal.value = true;
}

function numCol(title: string, key: keyof DailyReport, width = 100) {
  return {
    title,
    key,
    width,
    render: (row: DailyReport) => Number(row[key]).toFixed(2),
    summary: () => totals.value[key as string]?.toFixed(2) ?? '',
  };
}

const columns: DataTableColumns<DailyReport> = [
  {
    title: '店铺名称',
    key: 'shopId',
    width: 120,
    render: (row) => shopMap.value[row.shopId] ?? row.shopId,
  },
  {
    title: '日期',
    key: 'reportDate',
    width: 110,
    render: (row) => row.reportDate?.slice(0, 10),
  },
  numCol('期初余额', 'openingBalance'),
  numCol('营业额', 'revenue'),
  numCol('卡扣', 'cardFee', 80),
  numCol('实际业绩', 'actualRevenue'),
  numCol('刷给公司', 'transferToCompany'),
  numCol('转/存公司', 'depositToCompany'),
  numCol('店铺费用', 'shopExpense'),
  numCol('交给老板', 'payToOwner'),
  numCol('期末余额', 'closingBalance'),
  {
    title: '状态',
    key: 'status',
    width: 80,
    render(row) {
      const map = {
        pending: { type: 'warning' as const, label: '未审' },
        audited: { type: 'info' as const, label: '已审' },
        locked: { type: 'success' as const, label: '锁定' },
      };
      const s = map[row.status] ?? {
        type: 'default' as const,
        label: row.status,
      };
      return h(NTag, { type: s.type, size: 'small' }, () => s.label);
    },
  },
  { title: '备注', key: 'remark', ellipsis: { tooltip: true } },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    fixed: 'right',
    render(row) {
      const btns: any[] = [];
      if (row.status === 'pending') {
        btns.push(
          h(
            NButton,
            { size: 'small', onClick: () => handleEdit(row) },
            () => '编辑',
          ),
        );
        if (isFinance.value) {
          btns.push(
            h(
              NPopconfirm,
              { onPositiveClick: () => handleAudit(row) },
              {
                trigger: () =>
                  h(NButton, { size: 'small', type: 'primary' }, () => '审核'),
                default: () => '确认审核该日报？',
              },
            ),
          );
        }
        btns.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row) },
            {
              trigger: () =>
                h(NButton, { size: 'small', type: 'error' }, () => '删除'),
              default: () => '确认删除该日报？',
            },
          ),
        );
      } else if (row.status === 'audited') {
        if (isFinance.value) {
          btns.push(
            h(
              NPopconfirm,
              { onPositiveClick: () => handleReject(row) },
              {
                trigger: () => h(NButton, { size: 'small' }, () => '反审'),
                default: () => '确认反审该日报？',
              },
            ),
          );
        }
        if (isBoss.value) {
          btns.push(
            h(
              NPopconfirm,
              { onPositiveClick: () => handleLock(row) },
              {
                trigger: () =>
                  h(NButton, { size: 'small', type: 'success' }, () => '锁定'),
                default: () => '确认锁定该日报？',
              },
            ),
          );
        }
      } else if (row.status === 'locked' && isAdmin.value) {
        btns.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handleUnlock(row) },
            {
              trigger: () =>
                h(NButton, { size: 'small', type: 'warning' }, () => '解锁'),
              default: () => '确认解锁该日报？',
            },
          ),
        );
      }
      return h(NSpace, { size: 'small' }, () => btns);
    },
  },
];

onMounted(async () => {
  const res = await listShopsApi({ pageSize: 200 });
  shopOptions.value = res.items.map((s) => ({ label: s.name, value: s.id }));
  fetchData();
});
</script>

<template>
  <Page title="资金日报" description="门店每日资金流水记录">
    <template #extra>
      <NButton type="primary" @click="handleCreate">添加</NButton>
    </template>

    <NSpace vertical :size="16">
      <NSpace>
        <NSelect
          v-model:value="filterShopIds"
          :options="shopOptions"
          multiple
          clearable
          placeholder="店铺（可多选）"
          style="width: 220px"
          :max-tag-count="1"
        />
        <NSelect
          v-model:value="filterStatuses"
          :options="statusOptions"
          multiple
          clearable
          placeholder="状态（可多选）"
          style="width: 200px"
          :max-tag-count="2"
        />
        <NDatePicker
          v-model:value="filterDateRange"
          type="daterange"
          clearable
          style="width: 240px"
        />
        <NButton type="primary" @click="handleSearch">查询</NButton>
      </NSpace>

      <NCard size="small" title="本页合计" style="margin-bottom: 12px">
        <NGrid :cols="5" :x-gap="16" :y-gap="8">
          <NGi>
            <NStatistic label="营业额" :value="totals.revenue?.toFixed(2)" />
          </NGi>
          <NGi>
            <NStatistic
              label="实际业绩"
              :value="totals.actualRevenue?.toFixed(2)"
            />
          </NGi>
          <NGi>
            <NStatistic
              label="刷给公司"
              :value="totals.transferToCompany?.toFixed(2)"
            />
          </NGi>
          <NGi>
            <NStatistic
              label="店铺费用"
              :value="totals.shopExpense?.toFixed(2)"
            />
          </NGi>
          <NGi>
            <NStatistic
              label="期末余额"
              :value="totals.closingBalance?.toFixed(2)"
            />
          </NGi>
        </NGrid>
      </NCard>

      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="{
          page: pagination.page,
          pageSize: pagination.pageSize,
          itemCount: pagination.itemCount,
          showSizePicker: true,
          pageSizes: [10, 20, 50, 100],
          showQuickJumper: true,
          onUpdatePage: (p: number) => {
            pagination.page = p;
            fetchData();
          },
          onUpdatePageSize: (s: number) => {
            pagination.pageSize = s;
            pagination.page = 1;
            fetchData();
          },
        }"
        :row-key="(row: DailyReport) => row.id"
        :row-props="
          (row: DailyReport) => ({
            style: 'cursor: pointer',
            onClick: (e: MouseEvent) => {
              if ((e.target as HTMLElement).closest('button, .n-popconfirm'))
                return;
              handleRowClick(row);
            },
          })
        "
        scroll-x="1600"
        size="small"
      />
    </NSpace>

    <ReportFormModal
      v-model:show="showFormModal"
      :report="editingReport"
      @saved="handleSaved"
    />

    <ReportDetailModal
      v-model:show="showDetailModal"
      :report="detailReport"
      :shop-name="detailReport ? (shopMap[detailReport.shopId] ?? '') : ''"
    />
  </Page>
</template>

<style scoped>
.daily-table :deep(.n-data-table) {
  font-size: 13px;
}
</style>
