import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BalanceCalculatorService } from './balance-calculator.service';
import { DailyReportsService } from './daily-reports.service';

const mockPrisma = {
  dailyFundsReport: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  shop: { findUniqueOrThrow: vi.fn() },
  auditLog: { create: vi.fn() },
};

describe('dailyReportsService', () => {
  let service: DailyReportsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DailyReportsService(
      mockPrisma as any,
      new BalanceCalculatorService(),
    );
  });

  describe('getOpeningBalance', () => {
    it('returns shop.initialBalance when no prior report', async () => {
      mockPrisma.dailyFundsReport.findFirst.mockResolvedValue(null);
      mockPrisma.shop.findUniqueOrThrow.mockResolvedValue({
        initialBalance: { toString: () => '500.00' },
      });

      const result = await service.getOpeningBalance(
        'shop-1',
        new Date('2024-01-10'),
      );
      expect(result).toBe('500.00');
    });

    it('returns previous report closingBalance', async () => {
      mockPrisma.dailyFundsReport.findFirst.mockResolvedValue({
        closingBalance: { toString: () => '1234.56' },
      });

      const result = await service.getOpeningBalance(
        'shop-1',
        new Date('2024-01-10'),
      );
      expect(result).toBe('1234.56');
      expect(mockPrisma.shop.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('calls calculator and writes correct values', async () => {
      mockPrisma.dailyFundsReport.findFirst.mockResolvedValue(null);
      mockPrisma.shop.findUniqueOrThrow.mockResolvedValue({
        initialBalance: { toString: () => '1000' },
      });
      mockPrisma.dailyFundsReport.create.mockResolvedValue({
        id: 'r1',
        shopId: 'shop-1',
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.create(
        {
          shopId: 'shop-1',
          reportDate: '2024-01-10',
          revenue: '5000',
          cardFee: '100',
          transferToCompany: '2000',
          depositToCompany: '500',
          payToOwner: '300',
          shopExpense: '200',
        },
        'user-1',
      );

      const createCall =
        mockPrisma.dailyFundsReport.create.mock.calls[0][0].data;
      expect(createCall.actualRevenue).toBe('4900.00');
      expect(createCall.closingBalance).toBe('2900.00');
      expect(createCall.openingBalance).toBe('1000');
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'submit' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('throws BadRequestException when status is not pending', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'audited',
      });

      await expect(service.update('r1', {}, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('recalculates and writes audit log on success', async () => {
      const existing = {
        id: 'r1',
        shopId: 'shop-1',
        reportDate: new Date('2024-01-10'),
        status: 'pending',
        openingBalance: { toString: () => '1000' },
        revenue: { toString: () => '5000' },
        cardFee: { toString: () => '100' },
        transferToCompany: { toString: () => '2000' },
        depositToCompany: { toString: () => '500' },
        payToOwner: { toString: () => '300' },
        shopExpense: { toString: () => '200' },
      };
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue(existing);
      mockPrisma.dailyFundsReport.update.mockResolvedValue({
        ...existing,
        revenue: '6000',
      });
      mockPrisma.auditLog.create.mockResolvedValue({});
      // cascade: no subsequent reports
      mockPrisma.dailyFundsReport.findMany.mockResolvedValue([]);

      await service.update('r1', { revenue: '6000' }, 'user-1');

      expect(mockPrisma.dailyFundsReport.update).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'edit' }),
        }),
      );
    });
  });

  describe('cascadeRecalculate', () => {
    it('updates subsequent reports with chained opening balances', async () => {
      const fromDate = new Date('2024-01-10');
      const reports = [
        {
          id: 'r2',
          reportDate: new Date('2024-01-11'),
          revenue: { toString: () => '3000' },
          cardFee: { toString: () => '0' },
          transferToCompany: { toString: () => '1000' },
          depositToCompany: { toString: () => '0' },
          payToOwner: { toString: () => '0' },
          shopExpense: { toString: () => '0' },
        },
        {
          id: 'r3',
          reportDate: new Date('2024-01-12'),
          revenue: { toString: () => '2000' },
          cardFee: { toString: () => '0' },
          transferToCompany: { toString: () => '500' },
          depositToCompany: { toString: () => '0' },
          payToOwner: { toString: () => '0' },
          shopExpense: { toString: () => '0' },
        },
      ];
      mockPrisma.dailyFundsReport.findMany.mockResolvedValue(reports);
      // getOpeningBalance for r2 (no prior)
      mockPrisma.dailyFundsReport.findFirst.mockResolvedValue({
        closingBalance: { toString: () => '2900' },
      });
      mockPrisma.dailyFundsReport.update.mockResolvedValue({});

      await service.cascadeRecalculate('shop-1', fromDate, 'user-1');

      expect(mockPrisma.dailyFundsReport.update).toHaveBeenCalledTimes(2);
      // r2: opening=2900, actualRevenue=3000, closing=2900+3000-1000=4900
      expect(mockPrisma.dailyFundsReport.update.mock.calls[0][0]).toMatchObject(
        {
          where: { id: 'r2' },
          data: {
            openingBalance: '2900',
            actualRevenue: '3000.00',
            closingBalance: '4900.00',
          },
        },
      );
      // r3: opening=4900 (chained), actualRevenue=2000, closing=4900+2000-500=6400
      expect(mockPrisma.dailyFundsReport.update.mock.calls[1][0]).toMatchObject(
        {
          where: { id: 'r3' },
          data: {
            openingBalance: '4900.00',
            actualRevenue: '2000.00',
            closingBalance: '6400.00',
          },
        },
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when report does not exist', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue(null);
      await expect(service.remove('r1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when status is not pending', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'locked',
      });
      await expect(service.remove('r1')).rejects.toThrow(BadRequestException);
    });
  });
});
