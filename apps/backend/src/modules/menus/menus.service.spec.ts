import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MenusService } from './menus.service';

function makePrisma() {
  return {
    menu: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe('menusService', () => {
  let service: MenusService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new MenusService(prisma as any);
  });

  describe('listTree', () => {
    it('builds correct tree structure', async () => {
      const menus = [
        { id: '1', parentId: null, name: 'System', sortOrder: 0,
          createdAt: new Date() },
        { id: '2', parentId: '1', name: 'Users', sortOrder: 0,
          createdAt: new Date() },
        { id: '3', parentId: '1', name: 'Roles', sortOrder: 1,
          createdAt: new Date() },
        { id: '4', parentId: null, name: 'Dashboard', sortOrder: 1,
          createdAt: new Date() },
      ];
      prisma.menu.findMany.mockResolvedValue(menus);

      const tree = await service.listTree();

      expect(tree).toHaveLength(2);
      expect(tree[0].name).toBe('System');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].name).toBe('Users');
      expect(tree[0].children[1].name).toBe('Roles');
      expect(tree[1].name).toBe('Dashboard');
      expect(tree[1].children).toBeUndefined();
    });
  });

  describe('create', () => {
    it('validates parentId exists', async () => {
      prisma.menu.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          type: 'menu',
          name: 'Users',
          parentId: 'non-existent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('validates authCode uniqueness', async () => {
      // parentId check passes (no parentId provided)
      // authCode check finds duplicate
      prisma.menu.findUnique.mockResolvedValueOnce({
        id: '1',
        authCode: 'user:create',
      });

      await expect(
        service.create({
          type: 'button',
          name: 'Create User',
          authCode: 'user:create',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates menu when valid', async () => {
      prisma.menu.findUnique.mockResolvedValue(null);
      prisma.menu.create.mockResolvedValue({
        id: '1',
        type: 'menu',
        name: 'Users',
        parentId: null,
      });

      const result = await service.create({ type: 'menu', name: 'Users' });
      expect(result.name).toBe('Users');
      expect(prisma.menu.create).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('refuses when menu has children', async () => {
      prisma.menu.findUnique.mockResolvedValue({ id: '1', name: 'System' });
      prisma.menu.count.mockResolvedValue(3);

      await expect(service.remove('1')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when menu does not exist', async () => {
      prisma.menu.findUnique.mockResolvedValue(null);

      await expect(service.remove('999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('succeeds when no children', async () => {
      prisma.menu.findUnique.mockResolvedValue({ id: '1', name: 'Users' });
      prisma.menu.count.mockResolvedValue(0);
      prisma.menu.delete.mockResolvedValue(undefined);

      await expect(service.remove('1')).resolves.toBeUndefined();
      expect(prisma.menu.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
