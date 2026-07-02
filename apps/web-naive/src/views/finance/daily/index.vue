<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui';

import type { DailyReport } from '#/api/finance';
import type { Shop } from '#/api/system';

import { computed, h, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

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
const { hasAccessByCodes } = useAccess();

const canCreate = computed(() => hasAccessByCodes(['report:create']));
const canEdit = computed(() => hasAccessByCodes(['report:edit']));
const canDelete = computed(() => hasAccessByCodes(['report:delete']));
const canAudit = computed(() => hasAccessByCodes(['report:audit']));
const canReject = computed(() => hasAccessByCodes(['report:reject']));
const canLock = computed(() => hasAccessByCodes(['report:lock']));
const canUnlock = computed(() => hasAccessByCodes(['report:unlock']));

const loading = ref(false);
const data = ref<DailyReport[]>([]);
const pagination = reactive({ page: 1, pageSize: 100, itemCount: 0 });

const shopOptions = ref<{ label: string; value: string }[]>([]);
const shops = ref<Shop[]>([]);
const filterShopIds = ref<string[]>([]);
const filterStatuses = ref<string[]>([]);

// 默认展示当月整月（1 号 ~ 月末），配合大分页一页看完整月
function currentMonthRange(): [number, number] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return [start.getTime(), end.getTime()];
}

// 按本地时区格式化为 YYYY-MM-DD，避免 toISOString 的 UTC 偏移导致日期错位
function toLocalDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const filterDateRange = ref<[number, number] | null>(currentMonthRange());

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

const shopInfoMap = computed(() => {
  const m: Record<string, Shop> = {};
  for (const s of shops.value) m[s.id] = s;
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
  'topupIncome',
  'mallSettlement',
  'otherCompanyIncome',
  'closingBalance',
  'companyToOwner',
  'cardPayment',
  'companyBonus',
];

const totals = computed(() => {
  const t: Record<string, number> = {};
  for (const k of numericKeys) {
    t[k] = data.value.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  }
  return t;
});

// 表底黄色合计行（对应参考页底部汇总行）
function summaryRow() {
  const row: Record<string, any> = {};
  for (const col of columns) {
    const key = (col as any).key as string;
    row[key] = numericKeys.includes(key as keyof DailyReport)
      ? { value: totals.value[key]?.toFixed(2) ?? '0.00' }
      : { value: '' };
  }
  row.brand = { value: '合计' };
  return row;
}

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
      params.dateFrom = toLocalDate(filterDateRange.value[0]);
      params.dateTo = toLocalDate(filterDateRange.value[1]);
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

function numCol(
  title: string,
  key: keyof DailyReport,
  width = 100,
  red = false,
) {
  return {
    title: red
      ? () => h('span', { class: 'col-red-title' }, title)
      : title,
    key,
    width,
    className: red ? 'col-red-cell' : undefined,
    render: (row: DailyReport) => Number(row[key]).toFixed(2),
    summary: () => totals.value[key as string]?.toFixed(2) ?? '',
  };
}

const columns: DataTableColumns<DailyReport> = [
  {
    title: '品牌',
    key: 'brand',
    width: 90,
    render: (row) => shopInfoMap.value[row.shopId]?.brand?.name ?? '-',
  },
  {
    title: '店铺代码',
    key: 'shopCode',
    width: 90,
    render: (row) => shopInfoMap.value[row.shopId]?.code ?? '-',
  },
  {
    title: '店铺名称',
    key: 'shopId',
    width: 160,
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
  numCol('交给店老板款', 'payToOwner', 110, true),
  numCol('充值收入', 'topupIncome'),
  numCol('商场收款', 'mallSettlement', 100, true),
  numCol('公司其它收入', 'otherCompanyIncome', 110),
  numCol('期末余额', 'closingBalance'),
  numCol('公司转店老板', 'companyToOwner', 110, true),
  numCol('刷卡收款', 'cardPayment', 100, true),
  numCol('公司垫脚', 'companyBonus', 100, true),
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
        if (canEdit.value) {
          btns.push(
            h(
              NButton,
              { size: 'small', onClick: () => handleEdit(row) },
              () => '编辑',
            ),
          );
        }
        if (canAudit.value) {
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
        if (canDelete.value) {
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
        }
      } else if (row.status === 'audited') {
        if (canReject.value) {
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
        if (canLock.value) {
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
      } else if (row.status === 'locked' && canUnlock.value) {
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
  shops.value = res.items;
  shopOptions.value = res.items.map((s) => ({ label: s.name, value: s.id }));
  fetchData();
});
</script>

<template>
  <Page title="资金日报" description="门店每日资金流水记录">
    <template #extra>
      <NButton v-if="canCreate" type="primary" @click="handleCreate">添加</NButton>
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
        :summary="summaryRow"
        :pagination="{
          page: pagination.page,
          pageSize: pagination.pageSize,
          itemCount: pagination.itemCount,
          showSizePicker: true,
          pageSizes: [31, 50, 100, 200],
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
        scroll-x="2400"
        size="small"
        class="daily-table"
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

/* 表底合计行：黄色高亮，对应参考页底部汇总条 */
.daily-table :deep(.n-data-table-td--summary) {
  font-weight: 700;
  color: #000;
  background-color: #ffd666 !important;
}

/* 敏感列表头：红底白字高亮（对应参考页红色表头列） */
.daily-table :deep(th:has(.col-red-title)) {
  background-color: #d03050 !important;
}

.daily-table :deep(.col-red-title) {
  font-weight: 700;
  color: #fff;
}
</style>
