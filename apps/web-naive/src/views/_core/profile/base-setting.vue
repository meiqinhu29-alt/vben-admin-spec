<script setup lang="ts">
import type { AppUserInfo } from '#/api/core/user';

import { computed } from 'vue';

import { useUserStore } from '@vben/stores';

import { NDescriptions, NDescriptionsItem, NTag } from 'naive-ui';

import { USER_ROLE_LABELS } from '#/utils/role';

const userStore = useUserStore();
const userInfo = computed(() => userStore.userInfo as AppUserInfo | null);
const shopIds = computed<string[]>(() => userInfo.value?.shopIds ?? []);
const roles = computed<string[]>(() => userInfo.value?.roles ?? []);
</script>

<template>
  <div class="profile-base">
    <h3 class="profile-base__title">基本信息</h3>
    <NDescriptions v-if="userInfo" bordered label-placement="left" :column="1">
      <NDescriptionsItem label="用户名">
        {{ userInfo.username }}
      </NDescriptionsItem>
      <NDescriptionsItem label="姓名">
        {{ userInfo.realName ?? '-' }}
      </NDescriptionsItem>
      <NDescriptionsItem label="角色">
        <template v-if="roles.length > 0">
          <NTag
            v-for="r in roles"
            :key="r"
            class="profile-base__role-tag"
            :bordered="false"
            type="primary"
            size="small"
          >
            {{ USER_ROLE_LABELS[r] ?? r }}
          </NTag>
        </template>
        <span v-else>-</span>
      </NDescriptionsItem>
      <NDescriptionsItem label="所属店铺数">
        {{ shopIds.length }}
      </NDescriptionsItem>
      <NDescriptionsItem label="账号 ID">
        <span class="profile-base__user-id">{{ userInfo.userId }}</span>
      </NDescriptionsItem>
    </NDescriptions>
  </div>
</template>

<style scoped>
.profile-base {
  max-width: 720px;
}

.profile-base__title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.profile-base__role-tag {
  margin-right: 6px;
}

.profile-base__user-id {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
</style>
