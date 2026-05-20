<script lang="ts" setup>
import type { SystemMenu } from '#/api/system';

import { computed, reactive, ref, watch } from 'vue';

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

import { createMenuApi, updateMenuApi } from '#/api/system';

defineOptions({ name: 'MenuFormModal' });

const props = defineProps<{
  menu: null | SystemMenu;
  parent: null | SystemMenu;
  show: boolean;
}>();

const emit = defineEmits<{
  saved: [];
  'update:show': [value: boolean];
}>();

const message = useMessage();
const formRef = ref();
const submitting = ref(false);

const isEdit = computed(() => !!props.menu);
const title = computed(() => {
  if (isEdit.value) return '编辑菜单';
  if (props.parent) return `新增子级 - ${props.parent.name}`;
  return '新建顶级菜单';
});

const typeOptions = [
  { label: '目录', value: 'catalog' },
  { label: '菜单', value: 'menu' },
  { label: '按钮', value: 'button' },
  { label: '外链', value: 'link' },
  { label: '内嵌', value: 'embedded' },
];

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

const formModel = reactive({
  type: 'catalog' as SystemMenu['type'],
  name: '',
  path: '',
  component: '',
  authCode: '',
  status: 'active' as string,
  sortOrder: 0,
  metaTitle: '',
  metaIcon: '',
  metaOrder: 0,
});

const rules = computed(() => {
  const base: Record<string, any> = {
    name: { required: true, message: '请输入菜单名称', trigger: 'blur' },
    type: { required: true, message: '请选择类型', trigger: 'change' },
  };
  if (formModel.type === 'button') {
    base.authCode = {
      required: true,
      message: '请输入权限标识',
      trigger: 'blur',
    };
  }
  return base;
});

const showPath = computed(() =>
  ['catalog', 'embedded', 'link', 'menu'].includes(formModel.type),
);
const showComponent = computed(() =>
  ['catalog', 'menu'].includes(formModel.type),
);
const showAuthCode = computed(() =>
  ['button', 'menu'].includes(formModel.type),
);
const showMetaIcon = computed(() =>
  ['catalog', 'menu'].includes(formModel.type),
);
const showMetaOrder = computed(() => formModel.type === 'catalog');

function resetForm() {
  formModel.type = 'catalog';
  formModel.name = '';
  formModel.path = '';
  formModel.component = '';
  formModel.authCode = '';
  formModel.status = 'active';
  formModel.sortOrder = 0;
  formModel.metaTitle = '';
  formModel.metaIcon = '';
  formModel.metaOrder = 0;
}

watch(
  () => props.show,
  (val) => {
    if (!val) return;
    if (props.menu) {
      formModel.type = props.menu.type;
      formModel.name = props.menu.name;
      formModel.path = props.menu.path ?? '';
      formModel.component = props.menu.component ?? '';
      formModel.authCode = props.menu.authCode ?? '';
      formModel.status = props.menu.status;
      formModel.sortOrder = props.menu.sortOrder;
      formModel.metaTitle = props.menu.meta?.title ?? '';
      formModel.metaIcon = props.menu.meta?.icon ?? '';
      formModel.metaOrder = props.menu.meta?.order ?? 0;
    } else {
      resetForm();
      if (props.parent) {
        // Creating child: default to menu type for catalog parent
        formModel.type = props.parent.type === 'catalog' ? 'menu' : 'button';
      }
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
  const payload: Record<string, any> = {
    type: formModel.type,
    name: formModel.name,
    status: formModel.status,
    sortOrder: formModel.sortOrder,
    meta: { title: formModel.metaTitle || formModel.name },
  };
  if (showPath.value) payload.path = formModel.path;
  if (showComponent.value) payload.component = formModel.component;
  if (showAuthCode.value) payload.authCode = formModel.authCode;
  if (showMetaIcon.value) payload.meta.icon = formModel.metaIcon;
  if (showMetaOrder.value) payload.meta.order = formModel.metaOrder;

  // Set parentId
  payload.parentId =
    isEdit.value && props.menu
      ? props.menu.parentId
      : (props.parent?.id ?? null);

  try {
    if (isEdit.value && props.menu) {
      await updateMenuApi(props.menu.id, payload);
      message.success('更新成功');
    } else {
      await createMenuApi(payload);
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
    style="width: 600px"
    @update:show="handleClose"
  >
    <NForm
      ref="formRef"
      :model="formModel"
      :rules="rules"
      label-placement="left"
      label-width="90"
    >
      <NFormItem v-if="parent || (menu && menu.parentId)" label="父级菜单">
        <NInput :value="parent?.name ?? '(上级)'" disabled />
      </NFormItem>
      <NFormItem label="菜单类型" path="type">
        <NSelect
          v-model:value="formModel.type"
          :options="typeOptions"
          :disabled="isEdit"
        />
      </NFormItem>
      <NFormItem label="菜单名称" path="name">
        <NInput v-model:value="formModel.name" placeholder="请输入菜单名称" />
      </NFormItem>
      <NFormItem v-if="showPath" label="路由路径" path="path">
        <NInput v-model:value="formModel.path" placeholder="请输入路由路径" />
      </NFormItem>
      <NFormItem v-if="showComponent" label="组件路径" path="component">
        <NInput
          v-model:value="formModel.component"
          placeholder="请输入组件路径"
        />
      </NFormItem>
      <NFormItem v-if="showAuthCode" label="权限标识" path="authCode">
        <NInput
          v-model:value="formModel.authCode"
          placeholder="请输入权限标识"
        />
      </NFormItem>
      <NFormItem label="菜单标题" path="metaTitle">
        <NInput
          v-model:value="formModel.metaTitle"
          placeholder="显示标题（留空则使用菜单名称）"
        />
      </NFormItem>
      <NFormItem v-if="showMetaIcon" label="图标" path="metaIcon">
        <NInput
          v-model:value="formModel.metaIcon"
          placeholder="请输入图标名称"
        />
      </NFormItem>
      <NFormItem v-if="showMetaOrder" label="目录排序" path="metaOrder">
        <NInputNumber
          v-model:value="formModel.metaOrder"
          :min="0"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="排序" path="sortOrder">
        <NInputNumber
          v-model:value="formModel.sortOrder"
          :min="0"
          style="width: 100%"
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
