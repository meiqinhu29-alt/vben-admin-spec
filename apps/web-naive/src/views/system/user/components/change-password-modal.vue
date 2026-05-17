<script lang="ts" setup>
import { ref, watch } from 'vue';

import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
  useMessage,
} from 'naive-ui';

import { changePasswordApi } from '#/api/system';

defineOptions({ name: 'ChangePasswordModal' });

const props = defineProps<{
  show: boolean;
  userId: string;
}>();

const emit = defineEmits<{
  saved: [];
  'update:show': [value: boolean];
}>();

const message = useMessage();
const formRef = ref();
const submitting = ref(false);
const newPassword = ref('');

const rules = {
  newPassword: { required: true, message: '请输入新密码', trigger: 'blur' },
};

watch(
  () => props.show,
  (val) => {
    if (val) newPassword.value = '';
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
    await changePasswordApi(props.userId, newPassword.value);
    message.success('密码修改成功');
    emit('saved');
  } catch {
    message.error('密码修改失败');
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
    title="修改密码"
    preset="card"
    style="width: 400px"
    @update:show="handleClose"
  >
    <NForm
      ref="formRef"
      :model="{ newPassword }"
      :rules="rules"
      label-placement="left"
      label-width="80"
    >
      <NFormItem label="新密码" path="newPassword">
        <NInput
          v-model:value="newPassword"
          type="password"
          placeholder="请输入新密码"
        />
      </NFormItem>
    </NForm>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleClose">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="handleSubmit">确定</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
