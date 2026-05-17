<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui';

import type { SystemUser } from '#/api/system';

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

import { deleteUserApi, listUsersApi } from '#/api/system';

import AssignRolesModal from './components/assign-roles-modal.vue';
import AssignShopsModal from './components/assign-shops-modal.vue';
import ChangePasswordModal from './components/change-password-modal.vue';
import UserFormModal from './components/user-form-modal.vue';

defineOptions({ name: 'UserManagement' });

const message = useMessage();

const loading = ref(false);
const data = ref<SystemUser[]>([]);
const pagination = reactive({ page: 1, pageSize: 10, itemCount: 0 });
const searchKeyword = ref('');
const searchStatus = ref<null | string>(null);

const showFormModal = ref(false);
const editingUser = ref<null | SystemUser>(null);
const showRolesModal = ref(false);
const showShopsModal = ref(false);
const showPasswordModal = ref(false);
const activeUser = ref<null | SystemUser>(null);

const statusOptions = [
  { label: '全部', value: '' },
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
];

async function fetchData() {
  loading.value = true;
  try {
    const res = await listUsersApi({
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
  editingUser.value = null;
  showFormModal.value = true;
}

function handleEdit(row: SystemUser) {
  editingUser.value = row;
  showFormModal.value = true;
}

function handleAssignRoles(row: SystemUser) {
  activeUser.value = row;
  showRolesModal.value = true;
}

function handleAssignShops(row: SystemUser) {
  activeUser.value = row;
  showShopsModal.value = true;
}

function handleChangePassword(row: SystemUser) {
  activeUser.value = row;
  showPasswordModal.value = true;
}

async function handleDelete(row: SystemUser) {
  try {
    await deleteUserApi(row.id);
    message.success('删除成功');
    fetchData();
  } catch {
    message.error('删除失败');
  }
}

function handleSaved() {
  showFormModal.value = false;
  showRolesModal.value = false;
  showShopsModal.value = false;
  showPasswordModal.value = false;
  fetchData();
}

const columns: DataTableColumns<SystemUser> = [
  { title: '用户名', key: 'username', width: 140 },
  { title: '显示名称', key: 'displayName', width: 140 },
  {
    title: '角色',
    key: 'roles',
    render(row) {
      if (!row.roles?.length) return h('span', '-');
      return h(NSpace, { size: 4 }, () =>
        row.roles.map((r) =>
          h(NTag, { size: 'small', type: 'info' }, () => r.name),
        ),
      );
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render(row) {
      return h(
        NTag,
        { type: row.status === 'active' ? 'success' : 'warning', size: 'small' },
        () => (row.status === 'active' ? '启用' : '停用'),
      );
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 320,
    render(row) {
      return h(NSpace, { size: 'small' }, () => [
        h(NButton, { size: 'small', onClick: () => handleEdit(row) }, () => '编辑'),
        h(NButton, { size: 'small', type: 'primary', onClick: () => handleAssignRoles(row) }, () => '分配角色'),
        h(NButton, { size: 'small', type: 'primary', onClick: () => handleAssignShops(row) }, () => '分配店铺'),
        h(NButton, { size: 'small', onClick: () => handleChangePassword(row) }, () => '修改密码'),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row) },
          {
            trigger: () => h(NButton, { size: 'small', type: 'error' }, () => '删除'),
            default: () => '确认删除该用户？',
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
  <Page title="用户管理" description="管理系统用户">
    <template #extra>
      <NButton type="primary" @click="handleCreate">新建用户</NButton>
    </template>

    <NSpace vertical :size="16">
      <NSpace>
        <NInput
          v-model:value="searchKeyword"
          placeholder="搜索用户名/显示名称"
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
        <NButton @click="handleSearch">查询</NButton>
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
        :row-key="(row: SystemUser) => row.id"
      />
    </NSpace>

    <UserFormModal
      v-model:show="showFormModal"
      :user="editingUser"
      @saved="handleSaved"
    />

    <AssignRolesModal
      v-if="activeUser"
      v-model:show="showRolesModal"
      :user="activeUser"
      @saved="handleSaved"
    />

    <AssignShopsModal
      v-if="activeUser"
      v-model:show="showShopsModal"
      :user="activeUser"
      @saved="handleSaved"
    />

    <ChangePasswordModal
      v-if="activeUser"
      v-model:show="showPasswordModal"
      :user-id="activeUser.id"
      @saved="handleSaved"
    />
  </Page>
</template>
