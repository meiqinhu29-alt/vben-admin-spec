import { requestClient } from '#/api/request';
import type { DailyReport } from './daily-report';

export interface SummaryResult {
  rows: (DailyReport & { shop: { id: string; code: string; name: string } })[];
  totals: Record<string, number>;
}

export function querySummaryApi(params: Record<string, any>) {
  return requestClient.get<SummaryResult>('/summary', { params });
}

export function exportSummaryUrl(params: Record<string, any>): string {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
    ),
  ).toString();
  return `/api/summary/export${qs ? `?${qs}` : ''}`;
}
