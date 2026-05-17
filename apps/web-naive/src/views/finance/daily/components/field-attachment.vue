<script lang="ts" setup>
import type { ReportAttachment } from '#/api/finance';

import { onMounted, ref, watch } from 'vue';

import { NButton, NImage, NSpace, useMessage } from 'naive-ui';

import {
  deleteAttachmentApi,
  listAttachmentsApi,
  uploadAttachmentApi,
} from '#/api/finance';

defineOptions({ name: 'FieldAttachment' });

const props = defineProps<{
  fieldName: string;
  label: string;
  reportId: string;
}>();

const message = useMessage();
const attachments = ref<ReportAttachment[]>([]);
const uploading = ref(false);

async function load() {
  if (!props.reportId) return;
  const all = await listAttachmentsApi(props.reportId);
  attachments.value = all.filter((a) => a.fieldName === props.fieldName);
}

async function handleDelete(id: string) {
  await deleteAttachmentApi(id);
  message.success('已删除');
  await load();
}

async function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    await uploadAttachmentApi(props.reportId, props.fieldName, file);
    message.success('上传成功');
    await load();
  } catch {
    message.error('上传失败');
  } finally {
    uploading.value = false;
    (e.target as HTMLInputElement).value = '';
  }
}

watch(() => props.reportId, load);
onMounted(load);
</script>

<template>
  <NSpace :size="4" align="center">
    <template v-for="att in attachments" :key="att.id">
      <div style="position: relative; display: inline-block">
        <NImage
          v-if="/\.(jpg|jpeg|png|gif|webp)$/i.test(att.fileName)"
          :src="att.url"
          width="48"
          height="48"
          object-fit="cover"
          style="display: block; border-radius: 4px"
        />
        <a v-else :href="att.url" target="_blank" style="font-size: 12px">{{
          att.fileName
        }}</a>
        <NButton
          size="tiny"
          type="error"
          circle
          style="
            position: absolute;
            top: -6px;
            right: -6px;
            min-width: 16px;
            height: 16px;
            font-size: 10px;
          "
          @click="handleDelete(att.id)"
        >
          ×
        </NButton>
      </div>
    </template>
    <label v-if="reportId" style="cursor: pointer">
      <NButton size="small" :loading="uploading" tag="span">上传{{ label }}</NButton>
      <input
        type="file"
        accept="image/*,.pdf"
        style="display: none"
        @change="handleFileChange"
      />
    </label>
  </NSpace>
</template>
