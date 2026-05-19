import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

interface SummaryQuery {
  shopIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  status?: string;
  statuses?: string[];
}

const NUMERIC_FIELDS = [
  'openingBalance',
  'revenue',
  'cardFee',
  'actualRevenue',
  'transferToCompany',
  'depositToCompany',
  'payToOwner',
  'shopExpense',
  'closingBalance',
  'topupIncome',
  'mallSettlement',
  'otherCompanyIncome',
  'companyToOwner',
  'cardPayment',
  'companyBonus',
] as const;

@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async query(params: SummaryQuery) {
    const where: any = {};
    if (params.shopIds?.length) where.shopId = { in: params.shopIds };
    if (params.dateFrom || params.dateTo) {
      where.reportDate = {};
      if (params.dateFrom) where.reportDate.gte = params.dateFrom;
      if (params.dateTo) where.reportDate.lte = params.dateTo;
    }
    if (params.statuses?.length) where.status = { in: params.statuses };
    else if (params.status) where.status = params.status;

    const rows = await this.prisma.dailyFundsReport.findMany({
      where,
      orderBy: [{ shopId: 'asc' }, { reportDate: 'asc' }],
      include: { shop: { select: { id: true, code: true, name: true } } },
    });

    const totals: Record<string, number> = {};
    for (const field of NUMERIC_FIELDS) {
      totals[field] = rows.reduce(
        (sum: number, r) => sum + Number(r[field]),
        0,
      );
    }

    return { rows, totals };
  }
}
