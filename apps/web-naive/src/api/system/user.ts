import { requestClient } from '#/api/request';

export interface SystemUser {
  id: string;
  username: string;
  displayName: string;
  status: 'active' | 'disabled';
  roles: { id: string; code: string; name: string }[];
  shopIds: string[];
  createdAt: string;
}

export interface UserListResult {
  items: SystemUser[];
  total: number;
  page: number;
  pageSize: number;
}

export function listUsersApi(params?: Record<string, any>) {
  return requestClient.get<UserListResult>('/users', { params });
}

export function createUserApi(data: Record<string, any>) {
  return requestClient.post<SystemUser>('/users', data);
}

export function updateUserApi(id: string, data: Record<string, any>) {
  return requestClient.request<SystemUser>(`/users/${id}`, { method: 'PATCH', data });
}

export function changePasswordApi(id: string, newPassword: string) {
  return requestClient.post(`/users/${id}/password`, { newPassword });
}

export function deleteUserApi(id: string) {
  return requestClient.delete(`/users/${id}`);
}

export function assignUserRolesApi(id: string, roleIds: string[]) {
  return requestClient.request(`/users/${id}/roles`, { method: 'PUT', data: { roleIds } });
}

export function assignUserShopsApi(id: string, shopIds: string[]) {
  return requestClient.request(`/users/${id}/shops`, { method: 'PUT', data: { shopIds } });
}
