<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui';

import type { SummaryResult } from '#/api/finance';

import { h, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  NButton,
  NDataTable,
  NDatePicker,
  NSelect,
  NSpace,
  NTag,
} from 'naive-ui';

import { exportSummaryUrl, querySummaryApi } from '#/api/finance';
import { listShopsApi } from '#/api/system';

defineOptions({ name: 'FundsSummary' });

type SummaryRow = SummaryResult['rows'][number];

const loading = ref(false);
const data = ref<SummaryRow[]>([]);
const totals = ref<Record<string, number>>({});

const shopOptions = ref<{ label: string; value: string }[]>([]);
const filterShopIds = ref<string[]>([]);
const filterDateRange = ref<[number, number] | null>(null);
const filterStatus = ref<null | string>(null);

const statusOptions = [
  { label: '全部', value: '' },
  { label: '未审', value: 'pending' },
  { label: '已审', value: 'audited' },
  { label: '锁定', value: 'locked' },
];

function buildParams() {
  const p: Record<string, any> = {};
  if (filterShopIds.value.length > 0)
    p.shopIds = filterShopIds.value.join(',');
  if (filterStatus.value) p.status = filterStatus.value;
  if (filterDateRange.value) {
    p.dateFrom = new Date(filterDateRange.value[0]).toISOString().slice(0, 10);
    p.dateTo = new Date(filterDateRange.value[1]).toISOString().slice(0, 10);
  }
  return p;
}

async function fetchData() {
  loading.value = true;
  try {
    const res = await querySummaryApi(buildParams());
    data.value = res.rows;
    totals.value = res.totals;
  } finally {
    loading.value = false;
  }
}

function handleExport() {
  window.open(exportSummaryUrl(buildParams()), '_blank');
}

const numericKeys = [
  'openingBalance',
  'revenue',
  'cardFee',
  'actualRevenue',
  'transferToCompany',
  'depositToCompany',
  'shopExpense',
  'payToOwner',
  'closingBalance',
] as const;

function numCol(title: string, key: (typeof numericKeys)[number], width = 100) {
  return {
    title,
    key,
    width,
    render: (row: SummaryRow) => Number(row[key]).toFixed(2),
    summary: () => ({
      value: h(
        'span',
        { style: 'background:#fffbe6;display:block' },
        totals.value[key] !== undefined
          ? Number(totals.value[key]).toFixed(2)
          : '',
      ),
    }),
  };
}

const columns: DataTableColumns<SummaryRow> = [
  { title: '店铺代码', key: 'shop.code', width: 100, render: (r) => r.shop.code },
  { title: '店铺名称', key: 'shop.name', width: 120, render: (r) => r.shop.name },
  { title: '日期', key: 'reportDate', width: 110 },
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
      const s = map[row.status] ?? { type: 'default' as const, label: row.status };
      return h(NTag, { type: s.type, size: 'small' }, () => s.label);
    },
  },
  { title: '备注', key: 'remark', ellipsis: { tooltip: true } },
];

onMounted(async () => {
  const res = await listShopsApi({ pageSize: 200 });
  shopOptions.value = res.items.map((s) => ({ label: s.name, value: s.id }));
  fetchData();
});
</script>

<template>
  <Page title="资金汇总表" description="多店铺资金汇总查询">
    <NSpace vertical :size="16">
      <NSpace>
        <NSelect
          v-model:value="filterShopIds"
          :options="shopOptions"
          multiple
          clearable
          placeholder="选择店铺（可多选）"
          style="width: 240px"
        />
        <NSelect
          v-model:value="filterStatus"
          :options="statusOptions"
          clearable
          placeholder="状态筛选"
          style="width: 120px"
        />
        <NDatePicker
          v-model:value="filterDateRange"
          type="daterange"
          clearable
          style="width: 240px"
        />
        <NButton type="primary" @click="fetchData">查询</NButton>
        <NButton @click="handleExport">导出</NButton>
      </NSpace>

      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="false"
        :row-key="(row: SummaryRow) => row.id"
        :summary="
          () => {
            const row: Record<string, any> = { 'shop.code': { value: '合计' } };
            for (const k of numericKeys) {
              row[k] = {
                value: h(
                  'span',
                  { style: 'background:#fffbe6;display:block;font-weight:600' },
                  totals[k] !== undefined ? Number(totals[k]).toFixed(2) : '',
                ),
              };
            }
            return row;
          }
        "
        scroll-x="1800"
        size="small"
      />
    </NSpace>
  </Page>
</template>
