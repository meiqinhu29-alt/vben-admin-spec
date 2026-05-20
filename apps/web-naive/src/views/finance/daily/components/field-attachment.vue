<script lang="ts" setup>
import type { UploadFileInfo } from 'naive-ui';

import type { ReportAttachment } from '#/api/finance';

import { onMounted, ref, watch } from 'vue';

import { NUpload, useMessage } from 'naive-ui';

import {
  deleteAttachmentApi,
  listAttachmentsApi,
  uploadAttachmentApi,
} from '#/api/finance';

defineOptions({ name: 'FieldAttachment' });

const props = withDefaults(
  defineProps<{
    fieldName: string;
    label: string;
    readonly?: boolean;
    reportId: string;
  }>(),
  { readonly: false },
);

const message = useMessage();
const fileList = ref<UploadFileInfo[]>([]);

// IDs uploaded during this form session — discardable on form cancel.
const pendingIds = ref<Set<string>>(new Set());

const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);

function toFileItem(att: ReportAttachment, pending = false): UploadFileInfo {
  return {
    id: att.id,
    name: pending ? `🆕 ${att.fileName}` : att.fileName,
    status: 'finished',
    url: att.url,
    thumbnailUrl: isImage(att.fileName) ? att.url : undefined,
    type: isImage(att.fileName) ? 'image/*' : undefined,
  } as UploadFileInfo;
}

async function load() {
  if (!props.reportId) return;
  const all = await listAttachmentsApi(props.reportId);
  fileList.value = all
    .filter((a) => a.fieldName === props.fieldName)
    .map((a) => toFileItem(a, pendingIds.value.has(a.id)));
}

async function customRequest({
  file,
  onFinish,
  onError,
}: {
  file: UploadFileInfo;
  onError: () => void;
  onFinish: () => void;
}) {
  if (!file.file) {
    onError();
    return;
  }
  try {
    const att = await uploadAttachmentApi(
      props.reportId,
      props.fieldName,
      file.file,
    );
    file.id = att.id;
    file.url = att.url;
    file.name = `🆕 ${att.fileName}`;
    file.thumbnailUrl = isImage(att.fileName) ? att.url : undefined;
    pendingIds.value.add(att.id);
    onFinish();
    message.success('已上传，待提交后正式保存');
  } catch {
    onError();
  }
}

async function handleRemove({ file }: { file: UploadFileInfo }) {
  if (!file.id) return true;
  try {
    await deleteAttachmentApi(file.id);
    pendingIds.value.delete(file.id);
    message.success('已删除');
    return true;
  } catch {
    return false;
  }
}

async function discardPending() {
  if (pendingIds.value.size === 0) return;
  const ids = [...pendingIds.value];
  pendingIds.value.clear();
  await Promise.allSettled(ids.map((id) => deleteAttachmentApi(id)));
}

function commitPending() {
  pendingIds.value.clear();
  fileList.value = fileList.value.map((f) => ({
    ...f,
    name: f.name?.replace(/^🆕\s/, '') ?? '',
  }));
}

defineExpose({ discardPending, commitPending });

watch(() => props.reportId, load);
onMounted(load);
</script>

<template>
  <NUpload
    v-if="!readonly"
    v-model:file-list="fileList"
    list-type="image-card"
    accept="image/*,.pdf"
    :max="6"
    :custom-request="customRequest"
    :on-remove="handleRemove"
  >
    上传{{ label }}
  </NUpload>
  <NUpload
    v-else
    v-model:file-list="fileList"
    list-type="image-card"
    :show-trigger="false"
    :show-remove-button="false"
    disabled
  />
</template>
