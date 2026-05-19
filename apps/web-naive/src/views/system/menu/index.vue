<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui';

import type { SystemMenu } from '#/api/system';

import { h, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  NButton,
  NDataTable,
  NPopconfirm,
  NSpace,
  NTag,
  useMessage,
} from 'naive-ui';

import { deleteMenuApi, listMenuTreeApi } from '#/api/system';

import MenuFormModal from './components/menu-form-modal.vue';

defineOptions({ name: 'MenuManagement' });

const message = useMessage();

const loading = ref(false);
const data = ref<SystemMenu[]>([]);
const expandedAll = ref(true);
const expandedRowKeys = ref<string[]>([]);

// Modal state
const showFormModal = ref(false);
const editingMenu = ref<null | SystemMenu>(null);
const parentMenu = ref<null | SystemMenu>(null);

const typeColorMap: Record<string, string> = {
  catalog: 'info',
  menu: 'success',
  button: 'warning',
  link: 'default',
  embedded: 'default',
};

const typeLabelMap: Record<string, string> = {
  catalog: '目录',
  menu: '菜单',
  button: '按钮',
  link: '外链',
  embedded: '内嵌',
};

function collectKeys(list: SystemMenu[]): string[] {
  const keys: string[] = [];
  for (const item of list) {
    keys.push(item.id);
    if (item.children?.length) {
      keys.push(...collectKeys(item.children));
    }
  }
  return keys;
}

async function fetchData() {
  loading.value = true;
  try {
    data.value = await listMenuTreeApi();
    if (expandedAll.value) {
      expandedRowKeys.value = collectKeys(data.value);
    }
  } finally {
    loading.value = false;
  }
}

function toggleExpand() {
  if (expandedAll.value) {
    expandedRowKeys.value = [];
    expandedAll.value = false;
  } else {
    expandedRowKeys.value = collectKeys(data.value);
    expandedAll.value = true;
  }
}

function handleCreate() {
  editingMenu.value = null;
  parentMenu.value = null;
  showFormModal.value = true;
}

function handleCreateChild(row: SystemMenu) {
  editingMenu.value = null;
  parentMenu.value = row;
  showFormModal.value = true;
}

function handleEdit(row: SystemMenu) {
  editingMenu.value = row;
  parentMenu.value = null;
  showFormModal.value = true;
}

async function handleDelete(row: SystemMenu) {
  try {
    await deleteMenuApi(row.id);
    message.success('删除成功');
    fetchData();
  } catch {
    message.error('删除失败，可能存在子菜单');
  }
}

function handleSaved() {
  showFormModal.value = false;
  fetchData();
}

const columns: DataTableColumns<SystemMenu> = [
  {
    title: '菜单名称',
    key: 'name',
    width: 200,
    render(row) {
      const icon = row.meta?.icon;
      const displayName = row.meta?.title || row.name;
      return h('span', {}, [
        icon ? h('i', { class: icon, style: 'margin-right: 4px' }) : null,
        displayName,
      ]);
    },
  },
  {
    title: '类型',
    key: 'type',
    width: 80,
    render(row) {
      return h(
        NTag,
        { type: typeColorMap[row.type] as any, size: 'small' },
        () => typeLabelMap[row.type] ?? row.type,
      );
    },
  },
  { title: '路由路径', key: 'path', width: 180, ellipsis: { tooltip: true } },
  {
    title: '权限标识',
    key: 'authCode',
    width: 150,
    ellipsis: { tooltip: true },
  },
  { title: '组件', key: 'component', width: 180, ellipsis: { tooltip: true } },
  { title: '排序', key: 'sortOrder', width: 70 },
  {
    title: '状态',
    key: 'status',
    width: 80,
    render(row) {
      return h(
        NTag,
        {
          type: row.status === 'active' ? 'success' : 'warning',
          size: 'small',
        },
        () => (row.status === 'active' ? '启用' : '停用'),
      );
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 220,
    fixed: 'right',
    render(row) {
      return h(NSpace, { size: 'small' }, () => [
        row.type === 'catalog' || row.type === 'menu'
          ? h(
              NButton,
              { size: 'small', onClick: () => handleCreateChild(row) },
              () => '新增子级',
            )
          : null,
        h(
          NButton,
          { size: 'small', onClick: () => handleEdit(row) },
          () => '编辑',
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row) },
          {
            trigger: () =>
              h(NButton, { size: 'small', type: 'error' }, () => '删除'),
            default: () => '确认删除该菜单？',
          },
        ),
      ]);
    },
  },
];

onMounted(() => {
  fetchData();
});
</script>

<template>
  <Page title="菜单管理" description="管理系统菜单、目录、按钮权限">
    <template #extra>
      <NSpace>
        <NButton @click="toggleExpand">
          {{ expandedAll ? '折叠全部' : '展开全部' }}
        </NButton>
        <NButton type="primary" @click="handleCreate"> 新建顶级菜单 </NButton>
      </NSpace>
    </template>

    <NDataTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :row-key="(row: SystemMenu) => row.id"
      :expanded-row-keys="expandedRowKeys"
      @update:expanded-row-keys="
        (keys: Array<string | number>) => (expandedRowKeys = keys as string[])
      "
    />

    <MenuFormModal
      v-model:show="showFormModal"
      :menu="editingMenu"
      :parent="parentMenu"
      @saved="handleSaved"
    />
  </Page>
</template>
