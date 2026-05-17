import { requestClient } from '#/api/request';

export interface DailyReport {
  id: string;
  shopId: string;
  reportDate: string;
  openingBalance: string;
  revenue: string;
  cardFee: string;
  actualRevenue: string;
  transferToCompany: string;
  depositToCompany: string;
  payToOwner: string;
  shopExpense: string;
  closingBalance: string;
  topupIncome: string;
  mallSettlement: string;
  otherCompanyIncome: string;
  companyToOwner: string;
  cardPayment: string;
  companyBonus: string;
  remark?: string;
  status: 'audited' | 'locked' | 'pending';
  createdAt: string;
}

export interface DailyReportListResult {
  items: DailyReport[];
  total: number;
  page: number;
  pageSize: number;
}

export function listDailyReportsApi(params?: Record<string, any>) {
  return requestClient.get<DailyReportListResult>('/daily-reports', { params });
}

export function getOpeningBalanceApi(shopId: string, date: string) {
  return requestClient.get<{ openingBalance: string }>(
    '/daily-reports/opening-balance',
    { params: { shopId, date } },
  );
}

export function createDailyReportApi(data: Record<string, any>) {
  return requestClient.post<DailyReport>('/daily-reports', data);
}

export function updateDailyReportApi(id: string, data: Record<string, any>) {
  return requestClient.request<DailyReport>(`/daily-reports/${id}`, {
    method: 'PATCH',
    data,
  });
}

export function deleteDailyReportApi(id: string) {
  return requestClient.delete(`/daily-reports/${id}`);
}

export function auditReportApi(id: string) {
  return requestClient.post<DailyReport>(`/daily-reports/${id}/audit`);
}

export function lockReportApi(id: string) {
  return requestClient.post<DailyReport>(`/daily-reports/${id}/lock`);
}

export function rejectReportApi(id: string, comment?: string) {
  return requestClient.post<DailyReport>(`/daily-reports/${id}/reject`, {
    comment,
  });
}

export function unlockReportApi(id: string) {
  return requestClient.post<DailyReport>(`/daily-reports/${id}/unlock`);
}
