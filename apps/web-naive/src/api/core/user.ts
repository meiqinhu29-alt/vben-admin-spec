import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

export interface AppUserInfo extends UserInfo {
  shopIds?: string[];
}

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  return requestClient.get<AppUserInfo>('/user/info');
}
