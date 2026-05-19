<script lang="ts" setup>
import type { SystemUser } from '#/api/system';

import { onMounted, ref, watch } from 'vue';

import {
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NModal,
  NSpace,
  NSpin,
  useMessage,
} from 'naive-ui';

import { assignUserRolesApi, listRolesApi } from '#/api/system';

defineOptions({ name: 'AssignRolesModal' });

const props = defineProps<{
  show: boolean;
  user: SystemUser;
}>();

const emit = defineEmits<{
  saved: [];
  'update:show': [value: boolean];
}>();

const message = useMessage();
const loading = ref(false);
const submitting = ref(false);
const allRoles = ref<{ id: string; name: string }[]>([]);
const selectedRoleIds = ref<string[]>([]);

async function loadRoles() {
  loading.value = true;
  try {
    const res = await listRolesApi({ pageSize: 200 });
    allRoles.value = res.items;
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      selectedRoleIds.value = props.user.roles.map((r) => r.id);
      if (allRoles.value.length === 0) loadRoles();
    }
  },
);

onMounted(() => {
  loadRoles();
});

async function handleSubmit() {
  submitting.value = true;
  try {
    await assignUserRolesApi(props.user.id, selectedRoleIds.value);
    message.success('分配成功');
    emit('saved');
  } catch {
    message.error('分配失败');
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
    title="分配角色"
    preset="card"
    style="width: 480px"
    @update:show="handleClose"
  >
    <NSpin :show="loading">
      <NCheckboxGroup v-model:value="selectedRoleIds">
        <NSpace vertical>
          <NCheckbox
            v-for="role in allRoles"
            :key="role.id"
            :value="role.id"
            :label="role.name"
          />
        </NSpace>
      </NCheckboxGroup>
    </NSpin>
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
