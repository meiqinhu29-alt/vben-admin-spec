<script lang="ts" setup>
import type { SystemRole } from '#/api/system';

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

import { createRoleApi, updateRoleApi } from '#/api/system';

defineOptions({ name: 'RoleFormModal' });

const props = defineProps<{
  role: null | SystemRole;
  show: boolean;
}>();

const emit = defineEmits<{
  saved: [];
  'update:show': [value: boolean];
}>();

const message = useMessage();
const formRef = ref();
const submitting = ref(false);

const isEdit = computed(() => !!props.role);
const title = computed(() => (isEdit.value ? '编辑角色' : '新建角色'));

const formModel = reactive({
  code: '',
  name: '',
  description: '',
  status: 'active' as string,
});

const rules = {
  code: { required: true, message: '请输入角色编码', trigger: 'blur' },
  name: { required: true, message: '请输入角色名称', trigger: 'blur' },
};

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

watch(
  () => props.show,
  (val) => {
    if (val && props.role) {
      formModel.code = props.role.code;
      formModel.name = props.role.name;
      formModel.description = props.role.description ?? '';
      formModel.status = props.role.status;
    } else if (val) {
      formModel.code = '';
      formModel.name = '';
      formModel.description = '';
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
    if (isEdit.value && props.role) {
      await updateRoleApi(props.role.id, {
        name: formModel.name,
        description: formModel.description,
        status: formModel.status,
      });
      message.success('更新成功');
    } else {
      await createRoleApi({
        code: formModel.code,
        name: formModel.name,
        description: formModel.description,
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
      <NFormItem label="角色编码" path="code">
        <NInput
          v-model:value="formModel.code"
          :disabled="isEdit"
          placeholder="请输入角色编码"
        />
      </NFormItem>
      <NFormItem label="角色名称" path="name">
        <NInput v-model:value="formModel.name" placeholder="请输入角色名称" />
      </NFormItem>
      <NFormItem label="描述" path="description">
        <NInput
          v-model:value="formModel.description"
          type="textarea"
          placeholder="请输入描述"
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
