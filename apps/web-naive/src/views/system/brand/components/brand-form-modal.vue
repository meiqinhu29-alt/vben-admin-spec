<script lang="ts" setup>
import type { Brand } from '#/api/system';

import { computed, reactive, ref, watch } from 'vue';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  useMessage,
} from 'naive-ui';

import { createBrandApi, updateBrandApi } from '#/api/system';

defineOptions({ name: 'BrandFormModal' });

const props = defineProps<{
  brand: Brand | null;
  show: boolean;
}>();

const emit = defineEmits<{
  saved: [];
  'update:show': [value: boolean];
}>();

const message = useMessage();
const formRef = ref();
const submitting = ref(false);

const isEdit = computed(() => !!props.brand);
const title = computed(() => (isEdit.value ? '编辑品牌' : '新建品牌'));

const formModel = reactive({
  code: '',
  name: '',
  logoUrl: '',
  status: 'active' as string,
});

const rules = {
  code: { required: true, message: '请输入品牌代码', trigger: 'blur' },
  name: { required: true, message: '请输入品牌名称', trigger: 'blur' },
};

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

watch(
  () => props.show,
  (val) => {
    if (val && props.brand) {
      formModel.code = props.brand.code;
      formModel.name = props.brand.name;
      formModel.logoUrl = props.brand.logoUrl ?? '';
      formModel.status = props.brand.status;
    } else if (val) {
      formModel.code = '';
      formModel.name = '';
      formModel.logoUrl = '';
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
    if (isEdit.value && props.brand) {
      await updateBrandApi(props.brand.id, {
        name: formModel.name,
        logoUrl: formModel.logoUrl || undefined,
        status: formModel.status,
      });
      message.success('更新成功');
    } else {
      await createBrandApi({
        code: formModel.code,
        name: formModel.name,
        logoUrl: formModel.logoUrl || undefined,
        status: formModel.status,
      });
      message.success('创建成功');
    }
    emit('saved');
  } catch (error: any) {
    const msg =
      error?.response?.data?.message ||
      error?.message ||
      (isEdit.value ? '更新失败' : '创建失败');
    message.error(msg);
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
    style="width: 500px"
    @update:show="handleClose"
  >
    <NForm
      ref="formRef"
      :model="formModel"
      :rules="rules"
      label-placement="left"
      label-width="80"
    >
      <NFormItem label="品牌代码" path="code">
        <NInput
          v-model:value="formModel.code"
          :disabled="isEdit"
          placeholder="请输入品牌代码"
        />
      </NFormItem>
      <NFormItem label="品牌名称" path="name">
        <NInput v-model:value="formModel.name" placeholder="请输入品牌名称" />
      </NFormItem>
      <NFormItem label="Logo URL" path="logoUrl">
        <NInput
          v-model:value="formModel.logoUrl"
          placeholder="请输入Logo URL（可选）"
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
