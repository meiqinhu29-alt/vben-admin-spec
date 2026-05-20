import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../../prisma/prisma.service';
import { PermissionsService } from './permissions.service';

describe('permissionsService', () => {
  let service: PermissionsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: PrismaService,
          useValue: {
            userRoleRelation: {
              findMany: vi.fn(),
            },
            roleMenu: {
              findMany: vi.fn(),
            },
            userPermission: {
              findMany: vi.fn(),
            },
            menu: {
              findMany: vi.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should return empty array when user has no roles', async () => {
    vi.spyOn(prisma.userRoleRelation, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.userPermission, 'findMany').mockResolvedValue([]);

    const result = await service.resolvePermissions('user-1');

    expect(result).toEqual([]);
  });

  it('should union permissions from multiple roles and deduplicate', async () => {
    vi.spyOn(prisma.userRoleRelation, 'findMany').mockResolvedValue([
      { roleId: 'role-1', userId: 'user-1' },
      { roleId: 'role-2', userId: 'user-1' },
    ] as any);
    vi.spyOn(prisma.roleMenu, 'findMany').mockResolvedValue([
      { roleId: 'role-1', menuId: 'm1', menu: { authCode: 'user:read' } },
      { roleId: 'role-1', menuId: 'm2', menu: { authCode: 'user:write' } },
      { roleId: 'role-2', menuId: 'm1', menu: { authCode: 'user:read' } },
      { roleId: 'role-2', menuId: 'm3', menu: { authCode: 'order:read' } },
    ] as any);
    vi.spyOn(prisma.userPermission, 'findMany').mockResolvedValue([]);

    const result = await service.resolvePermissions('user-1');

    expect(result).toEqual(['order:read', 'user:read', 'user:write']);
  });

  it('should apply user grant override to add new permission', async () => {
    vi.spyOn(prisma.userRoleRelation, 'findMany').mockResolvedValue([
      { roleId: 'role-1', userId: 'user-1' },
    ] as any);
    vi.spyOn(prisma.roleMenu, 'findMany').mockResolvedValue([
      { roleId: 'role-1', menuId: 'm1', menu: { authCode: 'user:read' } },
    ] as any);
    vi.spyOn(prisma.userPermission, 'findMany').mockResolvedValue([
      { userId: 'user-1', authCode: 'admin:panel', effect: 'grant' },
    ] as any);

    const result = await service.resolvePermissions('user-1');

    expect(result).toEqual(['admin:panel', 'user:read']);
  });

  it('should apply user deny override to remove role permission', async () => {
    vi.spyOn(prisma.userRoleRelation, 'findMany').mockResolvedValue([
      { roleId: 'role-1', userId: 'user-1' },
    ] as any);
    vi.spyOn(prisma.roleMenu, 'findMany').mockResolvedValue([
      { roleId: 'role-1', menuId: 'm1', menu: { authCode: 'user:read' } },
      { roleId: 'role-1', menuId: 'm2', menu: { authCode: 'user:write' } },
    ] as any);
    vi.spyOn(prisma.userPermission, 'findMany').mockResolvedValue([
      { userId: 'user-1', authCode: 'user:write', effect: 'deny' },
    ] as any);

    const result = await service.resolvePermissions('user-1');

    expect(result).toEqual(['user:read']);
  });
});
