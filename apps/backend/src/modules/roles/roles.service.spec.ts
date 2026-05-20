import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RolesService } from './roles.service';

function makePrisma() {
  return {
    role: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userRoleRelation: {
      count: vi.fn(),
    },
    roleMenu: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn((args: any[]) => Promise.all(args)),
  };
}

describe('rolesService', () => {
  let service: RolesService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new RolesService(prisma as any);
  });

  describe('list', () => {
    it('returns paginated result', async () => {
      const roles = [{ id: '1', code: 'admin', name: 'Admin' }];
      prisma.role.findMany.mockResolvedValue(roles);
      prisma.role.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        items: roles,
        total: 1,
        page: 1,
        pageSize: 10,
      });
    });
  });

  describe('create', () => {
    it('throws ConflictException on duplicate code', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: '1', code: 'admin' });

      await expect(
        service.create({ code: 'admin', name: 'Admin' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates role when code is unique', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      prisma.role.create.mockResolvedValue({
        id: '1',
        code: 'editor',
        name: 'Editor',
      });

      const result = await service.create({ code: 'editor', name: 'Editor' });
      expect(result.code).toBe('editor');
    });
  });

  describe('remove', () => {
    it('throws ConflictException on system role', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: '1',
        code: 'super-admin',
        isSystem: true,
      });

      await expect(service.remove('1')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when users assigned', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: '1',
        code: 'editor',
        isSystem: false,
      });
      prisma.userRoleRelation.count.mockResolvedValue(3);

      await expect(service.remove('1')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when role does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });

    it('deletes role when allowed', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: '1',
        code: 'temp',
        isSystem: false,
      });
      prisma.userRoleRelation.count.mockResolvedValue(0);
      prisma.role.delete.mockResolvedValue(undefined);

      await expect(service.remove('1')).resolves.toBeUndefined();
      expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('assignMenus', () => {
    it('replaces existing associations', async () => {
      prisma.role.findUniqueOrThrow.mockResolvedValue({ id: '1' });
      prisma.roleMenu.deleteMany.mockResolvedValue({ count: 2 });
      prisma.roleMenu.createMany.mockResolvedValue({ count: 2 });

      await service.assignMenus('1', ['m1', 'm2']);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.roleMenu.deleteMany).toHaveBeenCalledWith({
        where: { roleId: '1' },
      });
      expect(prisma.roleMenu.createMany).toHaveBeenCalledWith({
        data: [
          { roleId: '1', menuId: 'm1' },
          { roleId: '1', menuId: 'm2' },
        ],
      });
    });
  });
});
