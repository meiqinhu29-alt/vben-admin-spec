<script lang="ts" setup>
import type { DailyReport } from '#/api/finance';

import { computed, reactive, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import {
  NButton,
  NCard,
  NDatePicker,
  NDivider,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpace,
  useMessage,
} from 'naive-ui';

import {
  createDailyReportApi,
  getOpeningBalanceApi,
  updateDailyReportApi,
} from '#/api/finance';
import { listShopsApi } from '#/api/system';

import FieldAttachment from './field-attachment.vue';

defineOptions({ name: 'ReportFormModal' });

const props = defineProps<{
  report: DailyReport | null;
  show: boolean;
}>();

const emit = defineEmits<{
  saved: [];
  'update:show': [value: boolean];
}>();

const message = useMessage();
const { hasAccessByRoles } = useAccess();
const isAdmin = computed(() => hasAccessByRoles(['admin']));
const formRef = ref();
const submitting = ref(false);
const shopOptions = ref<{ label: string; value: string }[]>([]);
const attachmentRefs = ref<
  Record<
    string,
    { commitPending: () => void; discardPending: () => Promise<void> }
  >
>({});

function setAttachmentRef(key: string) {
  return (el: any) => {
    if (el) attachmentRefs.value[key] = el;
    else delete attachmentRefs.value[key];
  };
}

const isEdit = computed(() => !!props.report);
const title = computed(() => (isEdit.value ? '编辑日报' : '新建日报'));

const formModel = reactive({
  shopId: '',
  reportDate: null as null | number,
  openingBalance: '0',
  revenue: null as null | number,
  cardFee: null as null | number,
  transferToCompany: null as null | number,
  depositToCompany: null as null | number,
  payToOwner: null as null | number,
  shopExpense: null as null | number,
  topupIncome: null as null | number,
  mallSettlement: null as null | number,
  otherCompanyIncome: null as null | number,
  companyToOwner: null as null | number,
  cardPayment: null as null | number,
  companyBonus: null as null | number,
  remark: '',
});

const actualRevenue = computed(() => {
  const r = formModel.revenue ?? 0;
  const c = formModel.cardFee ?? 0;
  return r - c;
});

const closingBalance = computed(() => {
  const opening = Number(formModel.openingBalance) || 0;
  const transfers =
    (formModel.transferToCompany ?? 0) +
    (formModel.depositToCompany ?? 0) +
    (formModel.payToOwner ?? 0) +
    (formModel.shopExpense ?? 0);
  return opening + actualRevenue.value - transfers;
});

const rules = {
  shopId: { required: true, message: '请选择店铺', trigger: 'change' },
  reportDate: {
    required: true,
    message: '请选择日期',
    type: 'number' as const,
    trigger: 'change',
  },
  revenue: {
    required: true,
    message: '请输入营业额',
    type: 'number' as const,
    trigger: 'blur',
  },
};

async function loadShops() {
  const res = await listShopsApi({ pageSize: 200 });
  shopOptions.value = res.items.map((s) => ({ label: s.name, value: s.id }));
}

async function fetchOpeningBalance() {
  if (!formModel.shopId || !formModel.reportDate) return;
  const date = new Date(formModel.reportDate).toISOString().slice(0, 10);
  try {
    const res = await getOpeningBalanceApi(formModel.shopId, date);
    formModel.openingBalance = res.openingBalance;
  } catch {
    // ignore
  }
}

watch(
  () => props.show,
  async (val) => {
    if (!val) return;
    await loadShops();
    if (props.report) {
      formModel.shopId = props.report.shopId;
      formModel.reportDate = new Date(props.report.reportDate).getTime();
      formModel.openingBalance = props.report.openingBalance;
      formModel.revenue = Number(props.report.revenue);
      formModel.cardFee = Number(props.report.cardFee);
      formModel.transferToCompany = Number(props.report.transferToCompany);
      formModel.depositToCompany = Number(props.report.depositToCompany);
      formModel.payToOwner = Number(props.report.payToOwner);
      formModel.shopExpense = Number(props.report.shopExpense);
      formModel.topupIncome = Number(props.report.topupIncome);
      formModel.mallSettlement = Number(props.report.mallSettlement);
      formModel.otherCompanyIncome = Number(props.report.otherCompanyIncome);
      formModel.companyToOwner = Number(props.report.companyToOwner);
      formModel.cardPayment = Number(props.report.cardPayment);
      formModel.companyBonus = Number(props.report.companyBonus);
      formModel.remark = props.report.remark ?? '';
    } else {
      Object.assign(formModel, {
        shopId: '',
        reportDate: null,
        openingBalance: '0',
        revenue: null,
        cardFee: null,
        transferToCompany: null,
        depositToCompany: null,
        payToOwner: null,
        shopExpense: null,
        topupIncome: null,
        mallSettlement: null,
        otherCompanyIncome: null,
        companyToOwner: null,
        cardPayment: null,
        companyBonus: null,
        remark: '',
      });
    }
  },
);

watch([() => formModel.shopId, () => formModel.reportDate], () => {
  if (!isEdit.value) fetchOpeningBalance();
});

async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  submitting.value = true;
  const date = new Date(formModel.reportDate ?? Date.now())
    .toISOString()
    .slice(0, 10);
  const commonFields = {
    revenue: String(formModel.revenue ?? 0),
    cardFee: String(formModel.cardFee ?? 0),
    transferToCompany: String(formModel.transferToCompany ?? 0),
    depositToCompany: String(formModel.depositToCompany ?? 0),
    payToOwner: String(formModel.payToOwner ?? 0),
    shopExpense: String(formModel.shopExpense ?? 0),
    topupIncome: String(formModel.topupIncome ?? 0),
    mallSettlement: String(formModel.mallSettlement ?? 0),
    otherCompanyIncome: String(formModel.otherCompanyIncome ?? 0),
    companyToOwner: String(formModel.companyToOwner ?? 0),
    cardPayment: String(formModel.cardPayment ?? 0),
    companyBonus: String(formModel.companyBonus ?? 0),
    remark: formModel.remark || undefined,
  };
  try {
    if (isEdit.value && props.report) {
      await updateDailyReportApi(props.report.id, commonFields);
      message.success('更新成功');
    } else {
      await createDailyReportApi({
        shopId: formModel.shopId,
        reportDate: date,
        ...commonFields,
      });
      message.success('创建成功');
    }
    Object.values(attachmentRefs.value).forEach((r) => r.commitPending());
    emit('saved');
  } catch {
    message.error(isEdit.value ? '更新失败' : '创建失败');
  } finally {
    submitting.value = false;
  }
}

async function handleClose() {
  await Promise.allSettled(
    Object.values(attachmentRefs.value).map((r) => r.discardPending()),
  );
  emit('update:show', false);
}
</script>

<template>
  <NModal
    :show="show"
    :title="title"
    preset="card"
    style="width: 860px; max-height: 90vh"
    content-style="overflow-y: auto"
    @update:show="handleClose"
  >
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
            <NInputNumber
              v-model:value="formModel.revenue"
              size="small"
              :precision="2"
              :show-button="false"
              class="formula-slot"
            />
          </div>
          <span class="formula-op">-</span>
          <div class="slot-wrap">
            <span class="slot-label">卡扣</span>
            <NInputNumber
              v-model:value="formModel.cardFee"
              size="small"
              :precision="2"
              :show-button="false"
              class="formula-slot"
            />
          </div>
          <span class="formula-eq">=</span>
          <span class="formula-result">{{ actualRevenue.toFixed(2) }}</span>
        </div>

        <div class="formula-divider"></div>

        <div class="formula-row">
          <span class="formula-target primary">期末余额</span>
          <span class="formula-eq">=</span>
          <div class="slot-wrap">
            <span class="slot-label">期初余额</span>
            <NInputNumber
              :value="Number(formModel.openingBalance) || 0"
              size="small"
              :precision="2"
              :show-button="false"
              disabled
              class="formula-slot"
            />
          </div>
          <span class="formula-op">+</span>
          <div class="slot-wrap">
            <span class="slot-label success">实际业绩</span>
            <span class="formula-derived">{{ actualRevenue.toFixed(2) }}</span>
          </div>
          <span class="formula-op">-</span>
          <div class="slot-wrap">
            <span class="slot-label">刷给公司</span>
            <NInputNumber
              v-model:value="formModel.transferToCompany"
              size="small"
              :precision="2"
              :show-button="false"
              class="formula-slot"
            />
          </div>
          <span class="formula-op">-</span>
          <div class="slot-wrap">
            <span class="slot-label">转/存公司</span>
            <NInputNumber
              v-model:value="formModel.depositToCompany"
              size="small"
              :precision="2"
              :show-button="false"
              class="formula-slot"
            />
          </div>
          <span class="formula-op">-</span>
          <div class="slot-wrap">
            <span class="slot-label">交给老板</span>
            <NInputNumber
              v-model:value="formModel.payToOwner"
              size="small"
              :precision="2"
              :show-button="false"
              class="formula-slot"
            />
          </div>
          <span class="formula-op">-</span>
          <div class="slot-wrap">
            <span class="slot-label">店铺费用</span>
            <NInputNumber
              v-model:value="formModel.shopExpense"
              size="small"
              :precision="2"
              :show-button="false"
              class="formula-slot"
            />
          </div>
          <span class="formula-eq">=</span>
          <span class="formula-result primary">{{
            closingBalance.toFixed(2)
          }}</span>
        </div>
      </div>
    </NCard>

    <NForm
      ref="formRef"
      :model="formModel"
      :rules="rules"
      label-placement="left"
      label-width="100"
    >
      <NGrid :cols="2" :x-gap="24">
        <NGi>
          <NFormItem label="店铺" path="shopId">
            <NSelect
              v-model:value="formModel.shopId"
              :disabled="isEdit"
              :options="shopOptions"
              placeholder="请选择店铺"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="日期" path="reportDate">
            <NDatePicker
              v-model:value="formModel.reportDate"
              :disabled="isEdit"
              type="date"
              style="width: 100%"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="期初余额">
            <NInput :value="formModel.openingBalance" disabled />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="营业额" path="revenue">
            <NInputNumber
              v-model:value="formModel.revenue"
              :precision="2"
              style="width: 100%"
              placeholder="请输入营业额"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="卡扣">
            <NInputNumber
              v-model:value="formModel.cardFee"
              :precision="2"
              style="width: 100%"
              placeholder="请输入卡扣"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="刷给公司">
            <NInputNumber
              v-model:value="formModel.transferToCompany"
              :precision="2"
              style="width: 100%"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="转/存公司">
            <NInputNumber
              v-model:value="formModel.depositToCompany"
              :precision="2"
              style="width: 100%"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="店铺费用">
            <NInputNumber
              v-model:value="formModel.shopExpense"
              :precision="2"
              style="width: 100%"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="交给老板款">
            <NInputNumber
              v-model:value="formModel.payToOwner"
              :precision="2"
              style="width: 100%"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="充值收入">
            <NInputNumber
              v-model:value="formModel.topupIncome"
              :precision="2"
              style="width: 100%"
            />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="商场结算">
            <NInputNumber
              v-model:value="formModel.mallSettlement"
              :precision="2"
              style="width: 100%"
            />
          </NFormItem>
        </NGi>
      </NGrid>

      <NDivider title-placement="left">备注</NDivider>
      <NFormItem label="" :show-label="false">
        <NInput
          v-model:value="formModel.remark"
          type="textarea"
          :rows="3"
          placeholder="请输入备注"
        />
      </NFormItem>

      <template v-if="isEdit && props.report">
        <NDivider title-placement="left">凭证上传</NDivider>
        <p class="upload-hint">
          上传后状态为「🆕
          待提交」，必须点击下方「确定」按钮才会正式保存到日报；点击「取消」会自动清理本次上传。
        </p>
        <NGrid :cols="2" :x-gap="16" :y-gap="12">
          <NGi>
            <div class="attachment-field">
              <span class="attachment-label">刷给公司</span>
              <FieldAttachment
                :ref="setAttachmentRef('transferToCompany')"
                :report-id="props.report.id"
                field-name="transferToCompany"
                label="凭证"
              />
            </div>
          </NGi>
          <NGi>
            <div class="attachment-field">
              <span class="attachment-label">转/存公司</span>
              <FieldAttachment
                :ref="setAttachmentRef('depositToCompany')"
                :report-id="props.report.id"
                field-name="depositToCompany"
                label="凭证"
              />
            </div>
          </NGi>
          <NGi>
            <div class="attachment-field">
              <span class="attachment-label">店铺费用</span>
              <FieldAttachment
                :ref="setAttachmentRef('shopExpense')"
                :report-id="props.report.id"
                field-name="shopExpense"
                label="凭证"
              />
            </div>
          </NGi>
          <NGi>
            <div class="attachment-field">
              <span class="attachment-label">交给老板款</span>
              <FieldAttachment
                :ref="setAttachmentRef('payToOwner')"
                :report-id="props.report.id"
                field-name="payToOwner"
                label="凭证"
              />
            </div>
          </NGi>
        </NGrid>
      </template>
      <template v-else-if="!isEdit">
        <NDivider title-placement="left">凭证上传</NDivider>
        <p style=" font-size: 13px;color: var(--text-color-3, #999)">
          保存日报后可上传凭证附件
        </p>
      </template>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleClose">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="handleSubmit">
          确定
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
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

.formula-eq {
  padding-bottom: 4px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.formula-op {
  padding-bottom: 4px;
  margin: 0 2px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.formula-slot {
  width: 96px;
}

.formula-slot :deep(.n-input__input-el) {
  text-align: center;
}

.formula-derived {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 28px;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--success-color, #18a058);
  background: rgb(24 160 88 / 10%);
  border: 1px dashed var(--success-color, #18a058);
  border-radius: 4px;
}

.formula-result {
  padding-bottom: 0;
  margin-left: 4px;
  font-size: 22px;
  font-weight: 700;
  color: var(--success-color, #18a058);
}

.formula-result.primary {
  color: var(--info-color, #2080f0);
}

.attachment-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: hsl(var(--muted) / 30%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.attachment-label {
  font-size: 13px;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.upload-hint {
  padding: 8px 12px;
  margin: 0 0 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 40%);
  border-left: 3px solid var(--warning-color, #f0a020);
  border-radius: 4px;
}
</style>
