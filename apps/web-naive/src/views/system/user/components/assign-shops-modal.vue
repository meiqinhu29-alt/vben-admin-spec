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

import { assignUserShopsApi, listShopsApi } from '#/api/system';

defineOptions({ name: 'AssignShopsModal' });

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
const allShops = ref<{ id: string; name: string; brand?: { name: string } }[]>([]);
const selectedShopIds = ref<string[]>([]);

async function loadShops() {
  loading.value = true;
  try {
    const res = await listShopsApi({ pageSize: 500 });
    allShops.value = res.items;
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      selectedShopIds.value = [...props.user.shopIds];
      if (!allShops.value.length) loadShops();
    }
  },
);

onMounted(() => {
  loadShops();
});

async function handleSubmit() {
  submitting.value = true;
  try {
    await assignUserShopsApi(props.user.id, selectedShopIds.value);
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
    title="分配店铺"
    preset="card"
    style="width: 480px"
    @update:show="handleClose"
  >
    <NSpin :show="loading">
      <NCheckboxGroup v-model:value="selectedShopIds">
        <NSpace vertical>
          <NCheckbox
            v-for="shop in allShops"
            :key="shop.id"
            :value="shop.id"
            :label="shop.brand ? `${shop.brand.name} - ${shop.name}` : shop.name"
          />
        </NSpace>
      </NCheckboxGroup>
    </NSpin>
    <template #footer>
      <NSpace justify="end">
        <NButton @click="handleClose">取消</NButton>
        <NButton type="primary" :loading="submitting" @click="handleSubmit">确定</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
