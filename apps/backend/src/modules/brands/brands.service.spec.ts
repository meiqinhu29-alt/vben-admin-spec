import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BrandsService } from './brands.service';

function makePrisma() {
  return {
    brand: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    shop: {
      count: vi.fn(),
    },
  };
}

describe('brandsService', () => {
  let service: BrandsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new BrandsService(prisma as any);
  });

  describe('list', () => {
    it('returns paginated result', async () => {
      const brands = [{ id: '1', code: 'BR1', name: 'Brand One' }];
      prisma.brand.findMany.mockResolvedValue(brands);
      prisma.brand.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        items: brands,
        total: 1,
        page: 1,
        pageSize: 10,
      });
    });
  });

  describe('create', () => {
    it('throws ConflictException on duplicate code', async () => {
      prisma.brand.findUnique.mockResolvedValue({ id: '1', code: 'BR1' });

      await expect(
        service.create({ code: 'BR1', name: 'Brand' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates brand when code is unique', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);
      prisma.brand.create.mockResolvedValue({
        id: '1',
        code: 'BR1',
        name: 'Brand One',
      });

      const result = await service.create({ code: 'BR1', name: 'Brand One' });
      expect(result.code).toBe('BR1');
    });
  });

  describe('getById', () => {
    it('returns brand when found', async () => {
      prisma.brand.findUnique.mockResolvedValue({ id: '1', code: 'BR1' });
      const result = await service.getById('1');
      expect(result.code).toBe('BR1');
    });

    it('throws NotFoundException when not found', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);
      await expect(service.getById('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when brand does not exist', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);
      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when brand has shops', async () => {
      prisma.brand.findUnique.mockResolvedValue({ id: '1', code: 'BR1' });
      prisma.shop.count.mockResolvedValue(3);

      await expect(service.remove('1')).rejects.toThrow(ConflictException);
    });

    it('deletes brand when no shops', async () => {
      prisma.brand.findUnique.mockResolvedValue({ id: '1', code: 'BR1' });
      prisma.shop.count.mockResolvedValue(0);
      prisma.brand.delete.mockResolvedValue(undefined);

      await expect(service.remove('1')).resolves.toBeUndefined();
      expect(prisma.brand.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when brand does not exist', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);
      await expect(service.update('999', { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException on duplicate code', async () => {
      prisma.brand.findUnique
        .mockResolvedValueOnce({ id: '1', code: 'BR1' })
        .mockResolvedValueOnce({ id: '2', code: 'BR2' });

      await expect(service.update('1', { code: 'BR2' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('updates brand successfully', async () => {
      prisma.brand.findUnique.mockResolvedValue({ id: '1', code: 'BR1' });
      prisma.brand.update.mockResolvedValue({
        id: '1',
        code: 'BR1',
        name: 'Updated',
      });

      const result = await service.update('1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });
});
