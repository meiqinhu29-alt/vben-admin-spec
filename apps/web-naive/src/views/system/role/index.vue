<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui';

import type { SystemRole } from '#/api/system';

import { h, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  NButton,
  NDataTable,
  NInput,
  NPopconfirm,
  NSelect,
  NSpace,
  NTag,
  useMessage,
} from 'naive-ui';

import { deleteRoleApi, listRolesApi } from '#/api/system';

import RoleFormModal from './components/role-form-modal.vue';
import RolePermissionDrawer from './components/role-permission-drawer.vue';

defineOptions({ name: 'RoleManagement' });

const message = useMessage();

const loading = ref(false);
const data = ref<SystemRole[]>([]);
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
});
const searchKeyword = ref('');
const searchStatus = ref<null | string>(null);

// Modal / Drawer state
const showFormModal = ref(false);
const editingRole = ref<null | SystemRole>(null);
const showPermDrawer = ref(false);
const permRoleId = ref('');

const statusOptions = [
  { label: '全部', value: '' },
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

async function fetchData() {
  loading.value = true;
  try {
    const res = await listRolesApi({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchKeyword.value || undefined,
      status: searchStatus.value || undefined,
    });
    data.value = res.items;
    pagination.itemCount = res.total;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.page = 1;
  fetchData();
}

function handlePageChange(page: number) {
  pagination.page = page;
  fetchData();
}

function handleCreate() {
  editingRole.value = null;
  showFormModal.value = true;
}

function handleEdit(row: SystemRole) {
  editingRole.value = row;
  showFormModal.value = true;
}

function handlePermission(row: SystemRole) {
  permRoleId.value = row.id;
  showPermDrawer.value = true;
}

async function handleDelete(row: SystemRole) {
  try {
    await deleteRoleApi(row.id);
    message.success('删除成功');
    fetchData();
  } catch {
    message.error('删除失败');
  }
}

function handleSaved() {
  showFormModal.value = false;
  fetchData();
}

const columns: DataTableColumns<SystemRole> = [
  { title: '角色编码', key: 'code', width: 150 },
  { title: '角色名称', key: 'name', width: 150 },
  {
    title: '状态',
    key: 'status',
    width: 100,
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
    title: '系统角色',
    key: 'isSystem',
    width: 100,
    render(row) {
      return row.isSystem
        ? h(NTag, { type: 'info', size: 'small' }, () => '系统')
        : h('span', '-');
    },
  },
  { title: '描述', key: 'description', ellipsis: { tooltip: true } },
  {
    title: '操作',
    key: 'actions',
    width: 240,
    render(row) {
      return h(NSpace, { size: 'small' }, () => [
        h(
          NButton,
          { size: 'small', onClick: () => handleEdit(row) },
          () => '编辑',
        ),
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            onClick: () => handlePermission(row),
          },
          () => '分配权限',
        ),
        row.isSystem
          ? null
          : h(
              NPopconfirm,
              { onPositiveClick: () => handleDelete(row) },
              {
                trigger: () =>
                  h(NButton, { size: 'small', type: 'error' }, () => '删除'),
                default: () => '确认删除该角色？',
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
  <Page title="角色管理" description="管理系统角色及其权限">
    <template #extra>
      <NButton type="primary" @click="handleCreate">新建角色</NButton>
    </template>

    <NSpace vertical :size="16">
      <NSpace>
        <NInput
          v-model:value="searchKeyword"
          placeholder="搜索角色编码/名称"
          clearable
          style="width: 200px"
          @keyup.enter="handleSearch"
        />
        <NSelect
          v-model:value="searchStatus"
          :options="statusOptions"
          placeholder="状态筛选"
          style="width: 120px"
          @update:value="handleSearch"
        />
        <NButton @click="handleSearch">搜索</NButton>
      </NSpace>

      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="{
          page: pagination.page,
          pageSize: pagination.pageSize,
          itemCount: pagination.itemCount,
          onUpdatePage: handlePageChange,
        }"
        :row-key="(row: SystemRole) => row.id"
      />
    </NSpace>

    <RoleFormModal
      v-model:show="showFormModal"
      :role="editingRole"
      @saved="handleSaved"
    />

    <RolePermissionDrawer v-model:show="showPermDrawer" :role-id="permRoleId" />
  </Page>
</template>
