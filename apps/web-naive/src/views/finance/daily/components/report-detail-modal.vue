<script lang="ts" setup>
import type { DailyReport } from '#/api/finance';

import { computed } from 'vue';

import { useAccess } from '@vben/access';

import { NCard, NGi, NGrid, NModal, NSpace, NTag } from 'naive-ui';

import FieldAttachment from './field-attachment.vue';

defineOptions({ name: 'ReportDetailModal' });

const props = defineProps<{
  report: DailyReport | null;
  shopName: string;
  show: boolean;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
}>();

const { hasAccessByRoles } = useAccess();
const isAdmin = computed(() => hasAccessByRoles(['admin']));

const statusMap = {
  pending: { type: 'warning' as const, label: '未审' },
  audited: { type: 'info' as const, label: '已审' },
  locked: { type: 'success' as const, label: '锁定' },
};

const status = computed(() => {
  if (!props.report) return statusMap.pending;
  return statusMap[props.report.status] ?? statusMap.pending;
});

function fmt(val: string | undefined) {
  return val ? Number(val).toFixed(2) : '0.00';
}

function handleClose() {
  emit('update:show', false);
}

const attachmentFields = [
  { key: 'transferToCompany', label: '刷给公司' },
  { key: 'depositToCompany', label: '转/存公司' },
  { key: 'shopExpense', label: '店铺费用' },
  { key: 'payToOwner', label: '交给老板款' },
];
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    style="width: 920px; max-height: 90vh"
    content-style="overflow-y: auto"
    title="日报详情"
    @update:show="handleClose"
  >
    <template v-if="report">
      <div class="detail-header">
        <div class="header-info">
          <span class="shop-name">{{ shopName }}</span>
          <span class="report-date">{{ report.reportDate?.slice(0, 10) }}</span>
        </div>
        <NTag :type="status.type" size="medium">{{ status.label }}</NTag>
      </div>

      <NCard
        v-if="isAdmin"
        size="small"
        class="formula-card"
        style="margin-bottom: 16px"
      >
        <div class="formula-block">
          <div class="formula-row">
            <span class="formula-target">实际业绩</span>
            <span class="formula-eq">=</span>
            <div class="slot-wrap">
              <span class="slot-label">营业额</span>
              <div class="formula-pill">{{ fmt(report.revenue) }}</div>
            </div>
            <span class="formula-op">-</span>
            <div class="slot-wrap">
              <span class="slot-label">卡扣</span>
              <div class="formula-pill">{{ fmt(report.cardFee) }}</div>
            </div>
            <span class="formula-eq">=</span>
            <span class="formula-result">{{ fmt(report.actualRevenue) }}</span>
          </div>

          <div class="formula-divider"></div>

          <div class="formula-row">
            <span class="formula-target primary">期末余额</span>
            <span class="formula-eq">=</span>
            <div class="slot-wrap">
              <span class="slot-label">期初余额</span>
              <div class="formula-pill">{{ fmt(report.openingBalance) }}</div>
            </div>
            <span class="formula-op">+</span>
            <div class="slot-wrap">
              <span class="slot-label success">实际业绩</span>
              <div class="formula-pill derived">
                {{ fmt(report.actualRevenue) }}
              </div>
            </div>
            <span class="formula-op">-</span>
            <div class="slot-wrap">
              <span class="slot-label">刷给公司</span>
              <div class="formula-pill">
                {{ fmt(report.transferToCompany) }}
              </div>
            </div>
            <span class="formula-op">-</span>
            <div class="slot-wrap">
              <span class="slot-label">转/存公司</span>
              <div class="formula-pill">{{ fmt(report.depositToCompany) }}</div>
            </div>
            <span class="formula-op">-</span>
            <div class="slot-wrap">
              <span class="slot-label">交给老板</span>
              <div class="formula-pill">{{ fmt(report.payToOwner) }}</div>
            </div>
            <span class="formula-op">-</span>
            <div class="slot-wrap">
              <span class="slot-label">店铺费用</span>
              <div class="formula-pill">{{ fmt(report.shopExpense) }}</div>
            </div>
            <span class="formula-eq">=</span>
            <span class="formula-result primary">{{
              fmt(report.closingBalance)
            }}</span>
          </div>
        </div>
      </NCard>

      <NCard size="small" style="margin-bottom: 12px" title="其他收支">
        <NGrid :cols="3" :x-gap="12" :y-gap="8">
          <NGi>
            <div class="other-item">
              <span class="other-label">充值收入</span>
              <span class="other-value">{{ fmt(report.topupIncome) }}</span>
            </div>
          </NGi>
          <NGi>
            <div class="other-item">
              <span class="other-label">商场结算</span>
              <span class="other-value">{{ fmt(report.mallSettlement) }}</span>
            </div>
          </NGi>
        </NGrid>
      </NCard>

      <NCard
        v-if="report.remark"
        size="small"
        title="备注"
        style="margin-bottom: 12px"
      >
        <p class="remark-text">{{ report.remark }}</p>
      </NCard>

      <NCard size="small" title="凭证附件">
        <NSpace :size="16" wrap>
          <div v-for="f in attachmentFields" :key="f.key" class="att-group">
            <span class="att-group-label">{{ f.label }}</span>
            <FieldAttachment
              :report-id="report.id"
              :field-name="f.key"
              :label="f.label"
              readonly
            />
          </div>
        </NSpace>
      </NCard>
    </template>
  </NModal>
</template>

<style scoped>
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  margin-bottom: 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.header-info {
  display: flex;
  gap: 12px;
  align-items: baseline;
}

.shop-name {
  font-size: 18px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.report-date {
  font-size: 14px;
  color: hsl(var(--muted-foreground));
}

.formula-card {
  background: hsl(var(--muted) / 40%);
  border: 1px solid hsl(var(--border));
}

.formula-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.formula-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: flex-end;
  font-size: 14px;
  color: hsl(var(--foreground));
}

.formula-divider {
  height: 1px;
  margin: 2px 0;
  background: hsl(var(--border));
}

.slot-wrap {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
}

.slot-label {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  text-align: center;
  letter-spacing: 0.5px;
}

.slot-label.success {
  color: var(--success-color, #18a058);
}

.formula-target {
  min-width: 64px;
  padding-bottom: 4px;
  font-weight: 600;
  color: var(--success-color, #18a058);
}

.formula-target.primary {
  color: var(--info-color, #2080f0);
}

.formula-eq,
.formula-op {
  padding-bottom: 4px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.formula-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 28px;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 500;
  color: hsl(var(--foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
}

.formula-pill.derived {
  color: var(--success-color, #18a058);
  background: rgb(24 160 88 / 10%);
  border: 1px dashed var(--success-color, #18a058);
}

.formula-result {
  margin-left: 4px;
  font-size: 22px;
  font-weight: 700;
  color: var(--success-color, #18a058);
}

.formula-result.primary {
  color: var(--info-color, #2080f0);
}

.other-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.other-label {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.other-value {
  font-size: 13px;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.remark-text {
  margin: 0;
  color: hsl(var(--foreground));
  white-space: pre-wrap;
}

.att-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.att-group-label {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
</style>
