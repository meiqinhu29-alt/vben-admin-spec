<script lang="ts" setup>
import type { SystemUser } from '#/api/system';

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

import { createUserApi, updateUserApi } from '#/api/system';

defineOptions({ name: 'UserFormModal' });

const props = defineProps<{
  show: boolean;
  user: null | SystemUser;
}>();

const emit = defineEmits<{
  saved: [];
  'update:show': [value: boolean];
}>();

const message = useMessage();
const formRef = ref();
const submitting = ref(false);

const isEdit = computed(() => !!props.user);
const title = computed(() => (isEdit.value ? '编辑用户' : '新建用户'));

const formModel = reactive({
  username: '',
  password: '',
  displayName: '',
  status: 'active' as string,
});

const rules = computed(() => ({
  username: { required: true, message: '请输入用户名', trigger: 'blur' },
  password: isEdit.value ? {} : { required: true, message: '请输入密码', trigger: 'blur' },
  displayName: { required: true, message: '请输入显示名称', trigger: 'blur' },
}));

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
];

watch(
  () => props.show,
  (val) => {
    if (val && props.user) {
      formModel.username = props.user.username;
      formModel.password = '';
      formModel.displayName = props.user.displayName;
      formModel.status = props.user.status;
    } else if (val) {
      formModel.username = '';
      formModel.password = '';
      formModel.displayName = '';
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
    if (isEdit.value && props.user) {
      await updateUserApi(props.user.id, {
        displayName: formModel.displayName,
        status: formModel.status,
      });
      message.success('更新成功');
    } else {
      await createUserApi({
        username: formModel.username,
        password: formModel.password,
        displayName: formModel.displayName,
        status: formModel.status,
      });
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
    style="width: 480px"
    @update:show="handleClose"
  >
    <NForm
      ref="formRef"
      :model="formModel"
      :rules="rules"
      label-placement="left"
      label-width="80"
    >
      <NFormItem label="用户名" path="username">
        <NInput
          v-model:value="formModel.username"
          :disabled="isEdit"
          placeholder="请输入用户名"
        />
      </NFormItem>
      <NFormItem v-if="!isEdit" label="密码" path="password">
        <NInput
          v-model:value="formModel.password"
          type="password"
          placeholder="请输入密码"
        />
      </NFormItem>
      <NFormItem label="显示名称" path="displayName">
        <NInput v-model:value="formModel.displayName" placeholder="请输入显示名称" />
      </NFormItem>
      <NFormItem label="状态" path="status">
        <NSelect v-model:value="formModel.status" :options="statusOptions" />
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
