<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui';

import type { Brand } from '#/api/system';

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

import { deleteBrandApi, listBrandsApi } from '#/api/system';

import BrandFormModal from './components/brand-form-modal.vue';

defineOptions({ name: 'BrandManagement' });

const message = useMessage();

const loading = ref(false);
const data = ref<Brand[]>([]);
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
});
const searchKeyword = ref('');
const searchStatus = ref<null | string>(null);

const showFormModal = ref(false);
const editingBrand = ref<Brand | null>(null);

const statusOptions = [
  { label: '全部', value: '' },
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

async function fetchData() {
  loading.value = true;
  try {
    const res = await listBrandsApi({
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
  editingBrand.value = null;
  showFormModal.value = true;
}

function handleEdit(row: Brand) {
  editingBrand.value = row;
  showFormModal.value = true;
}

async function handleDelete(row: Brand) {
  try {
    await deleteBrandApi(row.id);
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

const columns: DataTableColumns<Brand> = [
  { title: '品牌代码', key: 'code', width: 150 },
  { title: '品牌名称', key: 'name', width: 150 },
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
  { title: '创建时间', key: 'createdAt', width: 180 },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    fixed: 'right',
    render(row) {
      return h(NSpace, { size: 'small' }, () => [
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
            default: () => '确认删除该品牌？',
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
  <Page title="品牌管理" description="管理系统品牌信息">
    <template #extra>
      <NButton type="primary" @click="handleCreate">新建品牌</NButton>
    </template>

    <NSpace vertical :size="16">
      <NSpace>
        <NInput
          v-model:value="searchKeyword"
          placeholder="搜索品牌代码/名称"
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
        :row-key="(row: Brand) => row.id"
      />
    </NSpace>

    <BrandFormModal
      v-model:show="showFormModal"
      :brand="editingBrand"
      @saved="handleSaved"
    />
  </Page>
</template>
