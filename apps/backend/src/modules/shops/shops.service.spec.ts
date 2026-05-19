import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShopsService } from './shops.service';

function makePrisma() {
  return {
    shop: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    brand: {
      findUnique: vi.fn(),
    },
  };
}

describe('shopsService', () => {
  let service: ShopsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ShopsService(prisma as any, { resolveUserScope: vi.fn().mockResolvedValue({ scope: 'all', shopIds: [] }) } as any);
  });

  describe('list', () => {
    it('returns paginated result', async () => {
      const shops = [{ id: '1', code: 'SH1', name: 'Shop One' }];
      prisma.shop.findMany.mockResolvedValue(shops);
      prisma.shop.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        items: shops,
        total: 1,
        page: 1,
        pageSize: 10,
      });
    });

    it('filters by brandId', async () => {
      prisma.shop.findMany.mockResolvedValue([]);
      prisma.shop.count.mockResolvedValue(0);

      await service.list({ brandId: 'brand-1' });

      expect(prisma.shop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ brandId: 'brand-1' }),
        }),
      );
    });
  });

  describe('create', () => {
    it('throws ConflictException on duplicate code', async () => {
      prisma.shop.findUnique.mockResolvedValue({ id: '1', code: 'SH1' });

      await expect(
        service.create({ code: 'SH1', name: 'Shop', brandId: 'b1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when brand does not exist', async () => {
      prisma.shop.findUnique.mockResolvedValue(null);
      prisma.brand.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ code: 'SH1', name: 'Shop', brandId: 'bad-id' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates shop when valid', async () => {
      prisma.shop.findUnique.mockResolvedValue(null);
      prisma.brand.findUnique.mockResolvedValue({ id: 'b1', code: 'BR1' });
      prisma.shop.create.mockResolvedValue({
        id: '1',
        code: 'SH1',
        name: 'Shop One',
        brand: { id: 'b1', code: 'BR1', name: 'Brand' },
      });

      const result = await service.create({
        code: 'SH1',
        name: 'Shop One',
        brandId: 'b1',
      });
      expect(result.code).toBe('SH1');
      expect(result.brand).toBeDefined();
    });
  });

  describe('getById', () => {
    it('returns shop when found', async () => {
      prisma.shop.findUnique.mockResolvedValue({ id: '1', code: 'SH1' });
      const result = await service.getById('1');
      expect(result.code).toBe('SH1');
    });

    it('throws NotFoundException when not found', async () => {
      prisma.shop.findUnique.mockResolvedValue(null);
      await expect(service.getById('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when shop does not exist', async () => {
      prisma.shop.findUnique.mockResolvedValue(null);
      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });

    it('deletes shop', async () => {
      prisma.shop.findUnique.mockResolvedValue({ id: '1', code: 'SH1' });
      prisma.shop.delete.mockResolvedValue(undefined);

      await expect(service.remove('1')).resolves.toBeUndefined();
      expect(prisma.shop.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when shop does not exist', async () => {
      prisma.shop.findUnique.mockResolvedValue(null);
      await expect(service.update('999', { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException on duplicate code', async () => {
      prisma.shop.findUnique
        .mockResolvedValueOnce({ id: '1', code: 'SH1' })
        .mockResolvedValueOnce({ id: '2', code: 'SH2' });

      await expect(service.update('1', { code: 'SH2' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when new brandId does not exist', async () => {
      prisma.shop.findUnique.mockResolvedValue({ id: '1', code: 'SH1' });
      prisma.brand.findUnique.mockResolvedValue(null);

      await expect(service.update('1', { brandId: 'bad-id' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates shop successfully', async () => {
      prisma.shop.findUnique.mockResolvedValue({ id: '1', code: 'SH1' });
      prisma.shop.update.mockResolvedValue({
        id: '1',
        code: 'SH1',
        name: 'Updated',
        brand: { id: 'b1', code: 'BR1', name: 'Brand' },
      });

      const result = await service.update('1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });
});
