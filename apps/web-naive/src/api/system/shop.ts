import { requestClient } from '#/api/request';

export interface Shop {
  id: string;
  code: string;
  name: string;
  brandId: string;
  brand?: { code: string; id: string; name: string };
  initialBalance: string;
  address?: null | string;
  contactName?: null | string;
  contactPhone?: null | string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface ShopListResult {
  items: Shop[];
  total: number;
  page: number;
  pageSize: number;
}

export function listShopsApi(params?: Record<string, any>) {
  return requestClient.get<ShopListResult>('/shops', { params });
}

export function createShopApi(data: Record<string, any>) {
  return requestClient.post<Shop>('/shops', data);
}

export function updateShopApi(id: string, data: Record<string, any>) {
  return requestClient.request<Shop>(`/shops/${id}`, { method: 'PATCH', data });
}

export function deleteShopApi(id: string) {
  return requestClient.delete(`/shops/${id}`);
}
