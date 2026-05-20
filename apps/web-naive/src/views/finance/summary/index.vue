<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui';

import type { DailyReport, SummaryResult } from '#/api/finance';

import { computed, h, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NGi,
  NGrid,
  NSelect,
  NSpace,
  NStatistic,
  NTag,
} from 'naive-ui';

import { downloadSummaryApi, querySummaryApi } from '#/api/finance';
import { listShopsApi } from '#/api/system';

import ReportDetailModal from '../daily/components/report-detail-modal.vue';

defineOptions({ name: 'FundsSummary' });

type SummaryRow = SummaryResult['rows'][number];

const loading = ref(false);
const data = ref<SummaryRow[]>([]);
const totals = ref<Record<string, number>>({});

const showDetailModal = ref(false);
const detailReport = ref<DailyReport | null>(null);
const detailShopName = ref('');

const shopOptions = ref<{ label: string; value: string }[]>([]);
const filterShopIds = ref<string[]>([]);
const filterDateRange = ref<[number, number] | null>(null);
const filterStatuses = ref<string[]>([]);

const trendChartRef = ref();
const shopChartRef = ref();
const pieChartRef = ref();
const { renderEcharts: renderTrend } = useEcharts(trendChartRef);
const { renderEcharts: renderShop } = useEcharts(shopChartRef);
const { renderEcharts: renderPie } = useEcharts(pieChartRef);

const statusOptions = [
  { label: '未审', value: 'pending' },
  { label: '已审', value: 'audited' },
  { label: '锁定', value: 'locked' },
];

const kpi = computed(() => {
  const totalRevenue = totals.value.revenue ?? 0;
  const totalActual = totals.value.actualRevenue ?? 0;
  const totalExpense =
    (totals.value.transferToCompany ?? 0) +
    (totals.value.depositToCompany ?? 0) +
    (totals.value.shopExpense ?? 0) +
    (totals.value.payToOwner ?? 0);
  const pendingCount = data.value.filter((r) => r.status === 'pending').length;
  return { totalRevenue, totalActual, totalExpense, pendingCount };
});

function buildParams() {
  const p: Record<string, any> = {};
  if (filterShopIds.value.length > 0) p.shopIds = filterShopIds.value.join(',');
  if (filterStatuses.value.length > 0)
    p.statuses = filterStatuses.value.join(',');
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
    renderCharts();
  } finally {
    loading.value = false;
  }
}

function renderCharts() {
  renderTrendChart();
  renderShopChart();
  renderPieChart();
}

function renderTrendChart() {
  const dateMap = new Map<string, { actual: number; revenue: number; }>();
  for (const row of data.value) {
    const d = row.reportDate?.slice(0, 10);
    if (!d) continue;
    const existing = dateMap.get(d) ?? { revenue: 0, actual: 0 };
    existing.revenue += Number(row.revenue) || 0;
    existing.actual += Number(row.actualRevenue) || 0;
    dateMap.set(d, existing);
  }
  const dates = [...dateMap.keys()].toSorted();
  const revenues = dates.map((d) => dateMap.get(d)?.revenue ?? 0);
  const actuals = dates.map((d) => dateMap.get(d)?.actual ?? 0);

  renderTrend({
    tooltip: { trigger: 'axis' },
    legend: { data: ['营业额', '实际业绩'] },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value' },
    series: [
      { name: '营业额', type: 'line', data: revenues, smooth: true },
      { name: '实际业绩', type: 'line', data: actuals, smooth: true },
    ],
  });
}

function renderShopChart() {
  const shopMap = new Map<string, number>();
  for (const row of data.value) {
    const name = row.shop.name;
    shopMap.set(
      name,
      (shopMap.get(name) ?? 0) + (Number(row.actualRevenue) || 0),
    );
  }
  const shops = [...shopMap.entries()].toSorted((a, b) => b[1] - a[1]);

  renderShop({
    tooltip: { trigger: 'axis' },
    grid: { left: 80, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: shops.map((s) => s[0]) },
    series: [
      {
        type: 'bar',
        data: shops.map((s) => s[1]),
        itemStyle: { borderRadius: [0, 4, 4, 0] },
      },
    ],
  });
}

function renderPieChart() {
  const items = [
    { name: '刷给公司', value: totals.value.transferToCompany ?? 0 },
    { name: '转/存公司', value: totals.value.depositToCompany ?? 0 },
    { name: '店铺费用', value: totals.value.shopExpense ?? 0 },
    { name: '交给老板', value: totals.value.payToOwner ?? 0 },
  ].filter((i) => i.value > 0);

  renderPie({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data: items,
        label: { formatter: '{b}: {d}%' },
      },
    ],
  });
}

async function handleExport() {
  try {
    const blob = await downloadSummaryApi(buildParams());
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    // error already shown by interceptor
  }
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
  };
}

const columns: DataTableColumns<SummaryRow> = [
  { title: '店铺', key: 'shop.name', width: 120, render: (r) => r.shop.name },
  {
    title: '日期',
    key: 'reportDate',
    width: 110,
    render: (r) => r.reportDate?.slice(0, 10),
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
  {
    title: '操作',
    key: 'actions',
    width: 80,
    fixed: 'right',
    render(row) {
      return h(
        NButton,
        {
          size: 'small',
          quaternary: true,
          type: 'primary',
          onClick: () => handleViewDetail(row),
        },
        () => '详情',
      );
    },
  },
];

function handleViewDetail(row: SummaryRow) {
  detailReport.value = row as unknown as DailyReport;
  detailShopName.value = row.shop.name;
  showDetailModal.value = true;
}

onMounted(async () => {
  const res = await listShopsApi({ pageSize: 200 });
  shopOptions.value = res.items.map((s) => ({ label: s.name, value: s.id }));
  fetchData();
});
</script>

<template>
  <Page title="资金汇总表" description="多维度资金数据分析">
    <template #extra>
      <NButton @click="handleExport">导出 Excel</NButton>
    </template>

    <NSpace vertical :size="16">
      <NSpace>
        <NSelect
          v-model:value="filterShopIds"
          :options="shopOptions"
          multiple
          clearable
          placeholder="店铺（可多选）"
          style="width: 240px"
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
        <NButton type="primary" @click="fetchData">查询</NButton>
      </NSpace>

      <NGrid :cols="4" :x-gap="12">
        <NGi>
          <NCard size="small">
            <NStatistic label="总营业额">
              <span class="kpi-value">{{ kpi.totalRevenue.toFixed(2) }}</span>
            </NStatistic>
          </NCard>
        </NGi>
        <NGi>
          <NCard size="small">
            <NStatistic label="实际业绩">
              <span class="kpi-value green">{{
                kpi.totalActual.toFixed(2)
              }}</span>
            </NStatistic>
          </NCard>
        </NGi>
        <NGi>
          <NCard size="small">
            <NStatistic label="总支出">
              <span class="kpi-value orange">{{
                kpi.totalExpense.toFixed(2)
              }}</span>
            </NStatistic>
          </NCard>
        </NGi>
        <NGi>
          <NCard size="small">
            <NStatistic label="待审核">
              <span class="kpi-value red">{{ kpi.pendingCount }}</span>
            </NStatistic>
          </NCard>
        </NGi>
      </NGrid>

      <NGrid :cols="3" :x-gap="12">
        <NGi :span="2">
          <NCard size="small" title="营收趋势">
            <EchartsUI ref="trendChartRef" height="260px" />
          </NCard>
        </NGi>
        <NGi>
          <NCard size="small" title="支出构成">
            <EchartsUI ref="pieChartRef" height="260px" />
          </NCard>
        </NGi>
      </NGrid>

      <NCard size="small" title="店铺业绩对比">
        <EchartsUI ref="shopChartRef" height="200px" />
      </NCard>

      <NCard size="small" title="明细数据">
        <NDataTable
          :columns="columns"
          :data="data"
          :loading="loading"
          :pagination="false"
          :row-key="(row: SummaryRow) => row.id"
          :summary="
            () => {
              const row: Record<string, any> = {
                'shop.name': { value: '合计' },
              };
              for (const k of numericKeys) {
                row[k] = {
                  value: h(
                    'span',
                    { style: 'font-weight:600' },
                    totals[k] !== undefined ? Number(totals[k]).toFixed(2) : '',
                  ),
                };
              }
              return row;
            }
          "
          scroll-x="1700"
          size="small"
        />
      </NCard>
    </NSpace>

    <ReportDetailModal
      v-model:show="showDetailModal"
      :report="detailReport"
      :shop-name="detailShopName"
    />
  </Page>
</template>

<style scoped>
.kpi-value {
  font-size: 22px;
  font-weight: 700;
}

.kpi-value.green {
  color: #18a058;
}

.kpi-value.orange {
  color: #f0a020;
}

.kpi-value.red {
  color: #d03050;
}
</style>
