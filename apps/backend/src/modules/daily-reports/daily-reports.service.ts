import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { BalanceCalculatorService } from './balance-calculator.service';
import { CreateDailyReportDto } from './dto/create-daily-report.dto';
import { UpdateDailyReportDto } from './dto/update-daily-report.dto';

interface ListQuery {
  shopId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class DailyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: BalanceCalculatorService,
  ) {}

  async cascadeRecalculate(shopId: string, fromDate: Date, _userId: string) {
    const reports = await this.prisma.dailyFundsReport.findMany({
      where: {
        shopId,
        reportDate: { gt: fromDate },
        status: { not: 'locked' },
      },
      orderBy: { reportDate: 'asc' },
    });

    let prevClosing: null | string = null;
    for (const report of reports) {
      const openingBalance =
        prevClosing ??
        (await this.getOpeningBalance(shopId, report.reportDate));
      const { actualRevenue, closingBalance } = this.calculator.calculate({
        openingBalance,
        revenue: report.revenue,
        cardFee: report.cardFee,
        transferToCompany: report.transferToCompany,
        depositToCompany: report.depositToCompany,
        payToOwner: report.payToOwner,
        shopExpense: report.shopExpense,
      });
      await this.prisma.dailyFundsReport.update({
        where: { id: report.id },
        data: { openingBalance, actualRevenue, closingBalance },
      });
      prevClosing = closingBalance;
    }
  }

  async create(dto: CreateDailyReportDto, userId: string) {
    const reportDate = new Date(dto.reportDate);
    const openingBalance =
      dto.openingBalance ??
      (await this.getOpeningBalance(dto.shopId, reportDate));

    const { actualRevenue, closingBalance } = this.calculator.calculate({
      openingBalance,
      revenue: dto.revenue ?? '0',
      cardFee: dto.cardFee ?? '0',
      transferToCompany: dto.transferToCompany ?? '0',
      depositToCompany: dto.depositToCompany ?? '0',
      payToOwner: dto.payToOwner ?? '0',
      shopExpense: dto.shopExpense ?? '0',
    });

    const report = await this.prisma.dailyFundsReport.create({
      data: {
        shopId: dto.shopId,
        reportDate,
        openingBalance,
        revenue: dto.revenue ?? '0',
        cardFee: dto.cardFee ?? '0',
        actualRevenue,
        transferToCompany: dto.transferToCompany ?? '0',
        depositToCompany: dto.depositToCompany ?? '0',
        payToOwner: dto.payToOwner ?? '0',
        shopExpense: dto.shopExpense ?? '0',
        closingBalance,
        topupIncome: dto.topupIncome ?? '0',
        mallSettlement: dto.mallSettlement ?? '0',
        otherCompanyIncome: dto.otherCompanyIncome ?? '0',
        companyToOwner: dto.companyToOwner ?? '0',
        cardPayment: dto.cardPayment ?? '0',
        companyBonus: dto.companyBonus ?? '0',
        remark: dto.remark,
        createdBy: userId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        reportId: report.id,
        operatorId: userId,
        action: 'submit',
        toStatus: 'pending',
      },
    });

    return report;
  }

  async getById(id: string) {
    const report = await this.prisma.dailyFundsReport.findUnique({
      where: { id },
      include: { attachments: { where: { deletedAt: null } } },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async getOpeningBalance(shopId: string, date: Date): Promise<string> {
    const prior = await this.prisma.dailyFundsReport.findFirst({
      where: { shopId, reportDate: { lt: date } },
      orderBy: { reportDate: 'desc' },
      select: { closingBalance: true },
    });
    if (prior) return prior.closingBalance.toString();

    const shop = await this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      select: { initialBalance: true },
    });
    return shop.initialBalance.toString();
  }

  async list(query: ListQuery) {
    const { shopId, status, dateFrom, dateTo, page = 1, pageSize = 20 } = query;
    const where: any = {};
    if (shopId) where.shopId = shopId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.reportDate = {};
      if (dateFrom) where.reportDate.gte = new Date(dateFrom);
      if (dateTo) where.reportDate.lte = new Date(dateTo);
    }
    const [total, items] = await Promise.all([
      this.prisma.dailyFundsReport.count({ where }),
      this.prisma.dailyFundsReport.findMany({
        where,
        orderBy: { reportDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, items, page, pageSize };
  }

  async remove(id: string) {
    const existing = await this.prisma.dailyFundsReport.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Report not found');
    if (existing.status !== 'pending') {
      throw new BadRequestException('Only pending reports can be deleted');
    }
    return this.prisma.dailyFundsReport.delete({ where: { id } });
  }

  async update(id: string, dto: UpdateDailyReportDto, userId: string) {
    const existing = await this.prisma.dailyFundsReport.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Report not found');
    if (existing.status !== 'pending') {
      throw new BadRequestException('Only pending reports can be edited');
    }

    const openingBalance =
      dto.openingBalance ?? existing.openingBalance.toString();
    const { actualRevenue, closingBalance } = this.calculator.calculate({
      openingBalance,
      revenue: dto.revenue ?? existing.revenue.toString(),
      cardFee: dto.cardFee ?? existing.cardFee.toString(),
      transferToCompany:
        dto.transferToCompany ?? existing.transferToCompany.toString(),
      depositToCompany:
        dto.depositToCompany ?? existing.depositToCompany.toString(),
      payToOwner: dto.payToOwner ?? existing.payToOwner.toString(),
      shopExpense: dto.shopExpense ?? existing.shopExpense.toString(),
    });

    const updated = await this.prisma.dailyFundsReport.update({
      where: { id },
      data: {
        ...(dto.openingBalance !== undefined && {
          openingBalance: dto.openingBalance,
        }),
        ...(dto.revenue !== undefined && { revenue: dto.revenue }),
        ...(dto.cardFee !== undefined && { cardFee: dto.cardFee }),
        ...(dto.transferToCompany !== undefined && {
          transferToCompany: dto.transferToCompany,
        }),
        ...(dto.depositToCompany !== undefined && {
          depositToCompany: dto.depositToCompany,
        }),
        ...(dto.payToOwner !== undefined && { payToOwner: dto.payToOwner }),
        ...(dto.shopExpense !== undefined && { shopExpense: dto.shopExpense }),
        ...(dto.topupIncome !== undefined && { topupIncome: dto.topupIncome }),
        ...(dto.mallSettlement !== undefined && {
          mallSettlement: dto.mallSettlement,
        }),
        ...(dto.otherCompanyIncome !== undefined && {
          otherCompanyIncome: dto.otherCompanyIncome,
        }),
        ...(dto.companyToOwner !== undefined && {
          companyToOwner: dto.companyToOwner,
        }),
        ...(dto.cardPayment !== undefined && { cardPayment: dto.cardPayment }),
        ...(dto.companyBonus !== undefined && {
          companyBonus: dto.companyBonus,
        }),
        ...(dto.remark !== undefined && { remark: dto.remark }),
        actualRevenue,
        closingBalance,
      },
    });

    await this.prisma.auditLog.create({
      data: { reportId: id, operatorId: userId, action: 'edit' },
    });

    await this.cascadeRecalculate(existing.shopId, existing.reportDate, userId);

    return updated;
  }
}
