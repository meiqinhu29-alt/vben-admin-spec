import { requestClient } from '#/api/request';

export interface SystemRole {
  id: string;
  code: string;
  name: string;
  description?: string;
  dataScope: 'all' | 'self' | 'shop';
  status: 'active' | 'inactive';
  isSystem: boolean;
  createdAt: string;
}

export interface RoleListResult {
  items: SystemRole[];
  total: number;
  page: number;
  pageSize: number;
}

export function listRolesApi(params?: Record<string, any>) {
  return requestClient.get<RoleListResult>('/system/roles', { params });
}

export function getRoleApi(id: string) {
  return requestClient.get<SystemRole>(`/system/roles/${id}`);
}

export function createRoleApi(data: {
  code: string;
  dataScope?: string;
  description?: string;
  name: string;
  status?: string;
}) {
  return requestClient.post<SystemRole>('/system/roles', data);
}

export function updateRoleApi(id: string, data: Record<string, any>) {
  return requestClient.request<SystemRole>(`/system/roles/${id}`, {
    data,
    method: 'PATCH',
  });
}

export function deleteRoleApi(id: string) {
  return requestClient.delete(`/system/roles/${id}`);
}

export function assignRoleMenusApi(roleId: string, menuIds: string[]) {
  return requestClient.put(`/system/roles/${roleId}/menus`, {
    menuIds,
  });
}
