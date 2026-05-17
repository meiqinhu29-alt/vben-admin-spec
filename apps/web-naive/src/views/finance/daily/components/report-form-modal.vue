<script lang="ts" setup>
import type { DailyReport } from '#/api/finance';

import { computed, reactive, ref, watch } from 'vue';

import {
  NButton,
  NDatePicker,
  NForm,
  NFormItem,
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
const formRef = ref();
const submitting = ref(false);
const shopOptions = ref<{ label: string; value: string }[]>([]);

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
  const date = new Date(formModel.reportDate ?? Date.now()).toISOString().slice(0, 10);
  const payload = {
    shopId: formModel.shopId,
    reportDate: date,
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
      await updateDailyReportApi(props.report.id, payload);
      message.success('更新成功');
    } else {
      await createDailyReportApi(payload);
      message.success('创建成功');
    }
    emit('saved');
  } catch {
    message.error(isEdit.value ? '更新失败' : '创建失败');
  } finally {
    submitting.value = false;
  }
}

function handleClose() {
  emit('update:show', false);
}
</script>

<template>
  <NModal
    :show="show"
    :title="title"
    preset="card"
    style="width: 640px"
    @update:show="handleClose"
  >
    <NForm
      ref="formRef"
      :model="formModel"
      :rules="rules"
      label-placement="left"
      label-width="100"
    >
      <NFormItem label="店铺" path="shopId">
        <NSelect
          v-model:value="formModel.shopId"
          :disabled="isEdit"
          :options="shopOptions"
          placeholder="请选择店铺"
        />
      </NFormItem>
      <NFormItem label="日期" path="reportDate">
        <NDatePicker
          v-model:value="formModel.reportDate"
          :disabled="isEdit"
          type="date"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="期初余额">
        <NInput :value="formModel.openingBalance" disabled />
      </NFormItem>
      <NFormItem label="营业额" path="revenue">
        <NInputNumber
          v-model:value="formModel.revenue"
          :precision="2"
          style="width: 100%"
          placeholder="请输入营业额"
        />
      </NFormItem>
      <NFormItem label="卡扣">
        <NInputNumber
          v-model:value="formModel.cardFee"
          :precision="2"
          style="width: 100%"
          placeholder="请输入卡扣"
        />
      </NFormItem>
      <NFormItem label="实际业绩">
        <NInput :value="actualRevenue.toFixed(2)" disabled />
      </NFormItem>
      <NFormItem label="刷给公司">
        <NInputNumber
          v-model:value="formModel.transferToCompany"
          :precision="2"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="转/存公司">
        <NInputNumber
          v-model:value="formModel.depositToCompany"
          :precision="2"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="店铺费用">
        <NInputNumber
          v-model:value="formModel.shopExpense"
          :precision="2"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="交给老板款">
        <NInputNumber
          v-model:value="formModel.payToOwner"
          :precision="2"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="期末余额">
        <NInput
          :value="closingBalance.toFixed(2)"
          disabled
          style="font-weight: bold; color: #18a058"
        />
      </NFormItem>
      <NFormItem label="充值收入">
        <NInputNumber
          v-model:value="formModel.topupIncome"
          :precision="2"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="商场结算">
        <NInputNumber
          v-model:value="formModel.mallSettlement"
          :precision="2"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="其他公司收入">
        <NInputNumber
          v-model:value="formModel.otherCompanyIncome"
          :precision="2"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="公司转老板">
        <NInputNumber
          v-model:value="formModel.companyToOwner"
          :precision="2"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="刷卡支付">
        <NInputNumber
          v-model:value="formModel.cardPayment"
          :precision="2"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="公司奖金">
        <NInputNumber
          v-model:value="formModel.companyBonus"
          :precision="2"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="备注">
        <NInput
          v-model:value="formModel.remark"
          type="textarea"
          placeholder="请输入备注"
        />
      </NFormItem>
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
