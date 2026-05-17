<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui';

import type { Brand, Shop } from '#/api/system';

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

import { deleteShopApi, listBrandsApi, listShopsApi } from '#/api/system';

import ShopFormModal from './components/shop-form-modal.vue';

defineOptions({ name: 'ShopManagement' });

const message = useMessage();

const loading = ref(false);
const data = ref<Shop[]>([]);
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
});
const searchKeyword = ref('');
const searchBrandId = ref<null | string>(null);
const searchStatus = ref<null | string>(null);

const showFormModal = ref(false);
const editingShop = ref<Shop | null>(null);

const brandOptions = ref<Array<{ label: string; value: string }>>([]);

const statusOptions = [
  { label: '全部', value: '' },
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

async function fetchBrands() {
  try {
    const res = await listBrandsApi({ pageSize: 999 });
    brandOptions.value = [
      { label: '全部', value: '' },
      ...res.items.map((b: Brand) => ({ label: b.name, value: b.id })),
    ];
  } catch {
    // ignore
  }
}

async function fetchData() {
  loading.value = true;
  try {
    const res = await listShopsApi({
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchKeyword.value || undefined,
      brandId: searchBrandId.value || undefined,
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
  editingShop.value = null;
  showFormModal.value = true;
}

function handleEdit(row: Shop) {
  editingShop.value = row;
  showFormModal.value = true;
}

async function handleDelete(row: Shop) {
  try {
    await deleteShopApi(row.id);
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

const columns: DataTableColumns<Shop> = [
  { title: '店铺代码', key: 'code', width: 120 },
  { title: '店铺名称', key: 'name', width: 150 },
  {
    title: '所属品牌',
    key: 'brand',
    width: 120,
    render(row) {
      return row.brand?.name ?? '-';
    },
  },
  { title: '初始余额', key: 'initialBalance', width: 100 },
  { title: '地址', key: 'address', width: 150, ellipsis: { tooltip: true } },
  { title: '联系人', key: 'contactName', width: 100 },
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
    title: '操作',
    key: 'actions',
    width: 160,
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
            default: () => '确认删除该店铺？',
          },
        ),
      ]);
    },
  },
];

onMounted(() => {
  fetchBrands();
  fetchData();
});
</script>

<template>
  <Page title="店铺管理" description="管理系统店铺信息">
    <template #extra>
      <NButton type="primary" @click="handleCreate">新建店铺</NButton>
    </template>

    <NSpace vertical :size="16">
      <NSpace>
        <NInput
          v-model:value="searchKeyword"
          placeholder="搜索店铺代码/名称"
          clearable
          style="width: 200px"
          @keyup.enter="handleSearch"
        />
        <NSelect
          v-model:value="searchBrandId"
          :options="brandOptions"
          placeholder="品牌筛选"
          style="width: 150px"
          @update:value="handleSearch"
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
        :row-key="(row: Shop) => row.id"
      />
    </NSpace>

    <ShopFormModal
      v-model:show="showFormModal"
      :shop="editingShop"
      @saved="handleSaved"
    />
  </Page>
</template>
