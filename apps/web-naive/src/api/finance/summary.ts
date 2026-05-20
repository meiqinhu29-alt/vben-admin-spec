import type { DailyReport } from './daily-report';

import { requestClient } from '#/api/request';

export interface SummaryResult {
  rows: (DailyReport & { shop: { code: string; id: string; name: string } })[];
  totals: Record<string, number>;
}

export function querySummaryApi(params: Record<string, any>) {
  return requestClient.get<SummaryResult>('/summary', { params });
}

export function downloadSummaryApi(params: Record<string, any>): Promise<Blob> {
  return requestClient.download('/summary/export', { params });
}
