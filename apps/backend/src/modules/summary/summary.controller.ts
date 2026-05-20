import type { Response } from 'express';

import type { AuthUser } from '../../common/decorators/current-user.decorator';

import { Controller, Get, Query, Res } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SummaryService } from './summary.service';

@Controller('summary')
export class SummaryController {
  constructor(private readonly summary: SummaryService) {}

  @Get('export')
  async export(
    @CurrentUser() user: AuthUser,
    @Query('shopIds') shopIds?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
    @Query('statuses') statuses?: string,
    @Res() res?: Response,
  ) {
    const { rows, totals } = await this.summary.query({
      shopIds: shopIds ? shopIds.split(',') : undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      status,
      statuses: statuses ? statuses.split(',').filter(Boolean) : undefined,
      userId: user.userId,
    });

    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('资金汇总');

    sheet.addRow([
      '店铺代码',
      '店铺名称',
      '日期',
      '期初余额',
      '营业额',
      '卡扣',
      '实际业绩',
      '刷给公司',
      '转/存公司',
      '店铺费用',
      '交给老板',
      '期末余额',
      '状态',
      '备注',
    ]);

    for (const row of rows) {
      sheet.addRow([
        (row as any).shop?.code ?? '',
        (row as any).shop?.name ?? '',
        row.reportDate instanceof Date
          ? row.reportDate.toISOString().slice(0, 10)
          : String(row.reportDate),
        Number(row.openingBalance).toFixed(2),
        Number(row.revenue).toFixed(2),
        Number(row.cardFee).toFixed(2),
        Number(row.actualRevenue).toFixed(2),
        Number(row.transferToCompany).toFixed(2),
        Number(row.depositToCompany).toFixed(2),
        Number(row.shopExpense).toFixed(2),
        Number(row.payToOwner).toFixed(2),
        Number(row.closingBalance).toFixed(2),
        row.status,
        row.remark ?? '',
      ]);
    }

    sheet.addRow([
      '合计',
      '',
      '',
      totals.openingBalance?.toFixed(2) ?? '0.00',
      totals.revenue?.toFixed(2) ?? '0.00',
      totals.cardFee?.toFixed(2) ?? '0.00',
      totals.actualRevenue?.toFixed(2) ?? '0.00',
      totals.transferToCompany?.toFixed(2) ?? '0.00',
      totals.depositToCompany?.toFixed(2) ?? '0.00',
      totals.shopExpense?.toFixed(2) ?? '0.00',
      totals.payToOwner?.toFixed(2) ?? '0.00',
      totals.closingBalance?.toFixed(2) ?? '0.00',
      '',
      '',
    ]);

    const buffer = await workbook.xlsx.writeBuffer();

    if (res) {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="summary.xlsx"',
      );
      res.send(buffer);
    }
  }

  @Get()
  async query(
    @CurrentUser() user: AuthUser,
    @Query('shopIds') shopIds?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
    @Query('statuses') statuses?: string,
  ) {
    return this.summary.query({
      shopIds: shopIds ? shopIds.split(',') : undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      status,
      statuses: statuses ? statuses.split(',').filter(Boolean) : undefined,
      userId: user.userId,
    });
  }
}
