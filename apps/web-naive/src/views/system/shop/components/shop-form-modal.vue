<script lang="ts" setup>
import type { Brand, Shop } from '#/api/system';

import { computed, onMounted, reactive, ref, watch } from 'vue';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpace,
  useMessage,
} from 'naive-ui';

import { createShopApi, listBrandsApi, updateShopApi } from '#/api/system';

defineOptions({ name: 'ShopFormModal' });

const props = defineProps<{
  shop: Shop | null;
  show: boolean;
}>();

const emit = defineEmits<{
  saved: [];
  'update:show': [value: boolean];
}>();

const message = useMessage();
const formRef = ref();
const submitting = ref(false);

const isEdit = computed(() => !!props.shop);
const title = computed(() => (isEdit.value ? '编辑店铺' : '新建店铺'));

const brandOptions = ref<Array<{ label: string; value: string }>>([]);

const formModel = reactive({
  code: '',
  name: '',
  brandId: null as null | string,
  initialBalance: 0,
  address: '',
  contactName: '',
  contactPhone: '',
  status: 'active' as string,
});

const rules = {
  code: { required: true, message: '请输入店铺代码', trigger: 'blur' },
  name: { required: true, message: '请输入店铺名称', trigger: 'blur' },
  brandId: {
    required: true,
    message: '请选择所属品牌',
    trigger: 'change',
  },
};

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

async function fetchBrands() {
  try {
    const res = await listBrandsApi({ pageSize: 999 });
    brandOptions.value = res.items.map((b: Brand) => ({
      label: b.name,
      value: b.id,
    }));
  } catch {
    // ignore
  }
}

watch(
  () => props.show,
  (val) => {
    if (val && props.shop) {
      formModel.code = props.shop.code;
      formModel.name = props.shop.name;
      formModel.brandId = props.shop.brandId;
      formModel.initialBalance = Number(props.shop.initialBalance) || 0;
      formModel.address = props.shop.address ?? '';
      formModel.contactName = props.shop.contactName ?? '';
      formModel.contactPhone = props.shop.contactPhone ?? '';
      formModel.status = props.shop.status;
    } else if (val) {
      formModel.code = '';
      formModel.name = '';
      formModel.brandId = null;
      formModel.initialBalance = 0;
      formModel.address = '';
      formModel.contactName = '';
      formModel.contactPhone = '';
      formModel.status = 'active';
    }
  },
);

async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  submitting.value = true;
  try {
    const payload = {
      name: formModel.name,
      brandId: formModel.brandId,
      initialBalance: formModel.initialBalance,
      address: formModel.address || undefined,
      contactName: formModel.contactName || undefined,
      contactPhone: formModel.contactPhone || undefined,
      status: formModel.status,
    };
    if (isEdit.value && props.shop) {
      await updateShopApi(props.shop.id, payload);
      message.success('更新成功');
    } else {
      await createShopApi({ code: formModel.code, ...payload });
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

onMounted(() => {
  fetchBrands();
});
</script>

<template>
  <NModal
    :show="show"
    :title="title"
    preset="card"
    style="width: 560px"
    @update:show="handleClose"
  >
    <NForm
      ref="formRef"
      :model="formModel"
      :rules="rules"
      label-placement="left"
      label-width="80"
    >
      <NFormItem label="店铺代码" path="code">
        <NInput
          v-model:value="formModel.code"
          :disabled="isEdit"
          placeholder="请输入店铺代码"
        />
      </NFormItem>
      <NFormItem label="店铺名称" path="name">
        <NInput v-model:value="formModel.name" placeholder="请输入店铺名称" />
      </NFormItem>
      <NFormItem label="所属品牌" path="brandId">
        <NSelect
          v-model:value="formModel.brandId"
          :options="brandOptions"
          placeholder="请选择所属品牌"
        />
      </NFormItem>
      <NFormItem label="初始余额" path="initialBalance">
        <NInputNumber
          v-model:value="formModel.initialBalance"
          :precision="2"
          placeholder="请输入初始余额"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="地址" path="address">
        <NInput v-model:value="formModel.address" placeholder="请输入地址" />
      </NFormItem>
      <NFormItem label="联系人" path="contactName">
        <NInput
          v-model:value="formModel.contactName"
          placeholder="请输入联系人"
        />
      </NFormItem>
      <NFormItem label="联系电话" path="contactPhone">
        <NInput
          v-model:value="formModel.contactPhone"
          placeholder="请输入联系电话"
        />
      </NFormItem>
      <NFormItem label="状态" path="status">
        <NSelect v-model:value="formModel.status" :options="statusOptions" />
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
