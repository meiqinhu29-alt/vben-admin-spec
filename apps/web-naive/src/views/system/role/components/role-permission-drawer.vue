<script lang="ts" setup>
import type { SystemMenu } from '#/api/system';

import { h, ref, watch } from 'vue';

import {
  NButton,
  NDrawer,
  NDrawerContent,
  NSpace,
  NTag,
  NTree,
  useMessage,
} from 'naive-ui';

import { assignRoleMenusApi, getRoleApi, listMenuTreeApi } from '#/api/system';

defineOptions({ name: 'RolePermissionDrawer' });

const props = defineProps<{
  roleId: string;
  show: boolean;
}>();

const emit = defineEmits<{
  'update:show': [value: boolean];
}>();

const message = useMessage();
const loading = ref(false);
const saving = ref(false);
const treeData = ref<any[]>([]);
const checkedKeys = ref<string[]>([]);

const typeLabels: Record<string, string> = {
  catalog: '目录',
  menu: '菜单',
  button: '按钮',
  link: '外链',
  embedded: '内嵌',
};

function buildTreeData(menus: SystemMenu[]): any[] {
  return menus.map((menu) => ({
    key: menu.id,
    label: menu.name,
    suffix: () =>
      h(NSpace, { size: 4 }, () => [
        h(
          NTag,
          { size: 'tiny', bordered: false },
          () => typeLabels[menu.type] || menu.type,
        ),
        menu.authCode
          ? h(
              NTag,
              { size: 'tiny', type: 'warning', bordered: false },
              () => menu.authCode,
            )
          : null,
      ]),
    children: menu.children?.length ? buildTreeData(menu.children) : undefined,
  }));
}

watch(
  () => props.show,
  async (val) => {
    if (!val || !props.roleId) return;
    loading.value = true;
    try {
      const [menuTree, roleData] = await Promise.all([
        listMenuTreeApi(),
        getRoleApi(props.roleId),
      ]);
      treeData.value = buildTreeData(menuTree);
      // roleData may contain menuIds if the API returns them
      checkedKeys.value = (roleData as any).menuIds ?? [];
    } catch {
      message.error('加载权限数据失败');
    } finally {
      loading.value = false;
    }
  },
);

async function handleSave() {
  saving.value = true;
  try {
    await assignRoleMenusApi(props.roleId, checkedKeys.value);
    message.success('权限分配成功');
    emit('update:show', false);
  } catch {
    message.error('权限分配失败');
  } finally {
    saving.value = false;
  }
}

function handleClose() {
  emit('update:show', false);
}
</script>

<template>
  <NDrawer :show="show" :width="480" @update:show="handleClose">
    <NDrawerContent title="分配权限" :native-scrollbar="false">
      <NTree
        v-model:checked-keys="checkedKeys"
        :data="treeData"
        :loading="loading"
        checkable
        cascade
        block-line
        expand-on-click
        default-expand-all
        key-field="key"
        label-field="label"
        children-field="children"
      />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="handleClose">取消</NButton>
          <NButton type="primary" :loading="saving" @click="handleSave">
            保存
          </NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>
