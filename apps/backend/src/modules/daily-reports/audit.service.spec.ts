import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditService } from './audit.service';

const mockPrisma = {
  dailyFundsReport: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
};

describe('auditService', () => {
  let service: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuditService(mockPrisma as any);
    mockPrisma.$transaction.mockImplementation((ops: any[]) =>
      Promise.all(ops),
    );
  });

  describe('audit', () => {
    it('throws ConflictException when status is not pending', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'audited',
      });
      await expect(service.audit('r1', 'u1', ['finance'])).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ForbiddenException when role is not finance/admin', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'pending',
      });
      await expect(service.audit('r1', 'u1', ['staff'])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('succeeds and transitions to audited', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'pending',
      });
      const updated = { id: 'r1', status: 'audited' };
      mockPrisma.dailyFundsReport.update.mockResolvedValue(updated);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.audit('r1', 'u1', ['finance']);
      expect(result).toEqual(updated);
      expect(mockPrisma.dailyFundsReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'audited' }),
        }),
      );
    });
  });

  describe('lock', () => {
    it('throws ConflictException when status is not audited', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'pending',
      });
      await expect(service.lock('r1', 'u1', ['boss'])).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ForbiddenException when role is not boss/admin', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'audited',
      });
      await expect(service.lock('r1', 'u1', ['finance'])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('succeeds and transitions to locked', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'audited',
      });
      const updated = { id: 'r1', status: 'locked' };
      mockPrisma.dailyFundsReport.update.mockResolvedValue(updated);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.lock('r1', 'u1', ['boss']);
      expect(result).toEqual(updated);
    });
  });

  describe('reject', () => {
    it('throws ConflictException when status is not audited', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'pending',
      });
      await expect(service.reject('r1', 'u1', ['finance'])).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ForbiddenException when role is not finance/admin', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'audited',
      });
      await expect(service.reject('r1', 'u1', ['boss'])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('transitions back to pending', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'audited',
      });
      const updated = { id: 'r1', status: 'pending' };
      mockPrisma.dailyFundsReport.update.mockResolvedValue(updated);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.reject(
        'r1',
        'u1',
        ['finance'],
        'wrong numbers',
      );
      expect(result).toEqual(updated);
      expect(mockPrisma.dailyFundsReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending', auditedBy: null }),
        }),
      );
    });
  });

  describe('unlock', () => {
    it('throws ConflictException when status is not locked', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'audited',
      });
      await expect(service.unlock('r1', 'u1', ['admin'])).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ForbiddenException when role is not admin', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'locked',
      });
      await expect(service.unlock('r1', 'u1', ['boss'])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('requires admin role and transitions to audited', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'locked',
      });
      const updated = { id: 'r1', status: 'audited' };
      mockPrisma.dailyFundsReport.update.mockResolvedValue(updated);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.unlock('r1', 'u1', ['admin']);
      expect(result).toEqual(updated);
    });
  });

  describe('findOrThrow', () => {
    it('throws NotFoundException when report does not exist', async () => {
      mockPrisma.dailyFundsReport.findUnique.mockResolvedValue(null);
      await expect(service.audit('missing', 'u1', ['admin'])).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
