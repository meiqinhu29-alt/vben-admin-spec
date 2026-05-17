import { requestClient } from '#/api/request';

export interface Brand {
  id: string;
  code: string;
  name: string;
  logoUrl?: null | string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface BrandListResult {
  items: Brand[];
  total: number;
  page: number;
  pageSize: number;
}

export function listBrandsApi(params?: Record<string, any>) {
  return requestClient.get<BrandListResult>('/brands', { params });
}

export function createBrandApi(data: Record<string, any>) {
  return requestClient.post<Brand>('/brands', data);
}

export function updateBrandApi(id: string, data: Record<string, any>) {
  return requestClient.request<Brand>(`/brands/${id}`, { method: 'PATCH', data });
}

export function deleteBrandApi(id: string) {
  return requestClient.delete(`/brands/${id}`);
}
