import { requestClient } from '#/api/request';

export interface SystemMenu {
  id: string;
  parentId: null | string;
  type: 'button' | 'catalog' | 'embedded' | 'link' | 'menu';
  name: string;
  path?: string;
  component?: string;
  authCode?: string;
  meta: Record<string, any>;
  status: 'active' | 'inactive';
  sortOrder: number;
  children?: SystemMenu[];
}

export function listMenuTreeApi() {
  return requestClient.get<SystemMenu[]>('/system/menus');
}

export function createMenuApi(data: Record<string, any>) {
  return requestClient.post<SystemMenu>('/system/menus', data);
}

export function updateMenuApi(id: string, data: Record<string, any>) {
  return requestClient.request<SystemMenu>(`/system/menus/${id}`, {
    data,
    method: 'PATCH',
  });
}

export function deleteMenuApi(id: string) {
  return requestClient.delete(`/system/menus/${id}`);
}
