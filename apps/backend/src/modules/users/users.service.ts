import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async assignRoles(userId: string, roleIds: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    await this.prisma.$transaction([
      this.prisma.userRoleRelation.deleteMany({ where: { userId } }),
      ...roleIds.map((roleId) =>
        this.prisma.userRoleRelation.create({ data: { userId, roleId } }),
      ),
    ]);
  }

  async assignShops(userId: string, shopIds: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    await this.prisma.$transaction([
      this.prisma.userShopAccess.deleteMany({ where: { userId } }),
      ...shopIds.map((shopId) =>
        this.prisma.userShopAccess.create({ data: { userId, shopId } }),
      ),
    ]);
  }

  async changePassword(id: string, newPassword: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User ${id} not found`);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async create(dto: {
    displayName: string;
    password: string;
    status?: string;
    username: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing)
      throw new ConflictException(`Username ${dto.username} already exists`);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        displayName: dto.displayName,
        status: (dto.status ?? 'active') as any,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        shopAccess: { select: { shopId: true } },
        userRoles: {
          include: { role: { select: { code: true, name: true } } },
        },
      },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async list(query: {
    keyword?: string;
    page?: number;
    pageSize?: number;
    status?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (query.keyword) {
      where.OR = [
        { username: { contains: query.keyword, mode: 'insensitive' } },
        { displayName: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          userRoles: {
            include: { role: { select: { id: true, code: true, name: true } } },
          },
          shopAccess: { select: { shopId: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        ...u,
        passwordHash: undefined,
        roles: u.userRoles.map((ur) => ur.role),
        shopIds: u.shopAccess.map((s) => s.shopId),
      })),
      total,
      page,
      pageSize,
    };
  }

  async remove(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User ${id} not found`);
    await this.prisma.user.delete({ where: { id } });
  }

  async update(id: string, dto: { displayName?: string; status?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`User ${id} not found`);
    return this.prisma.user.update({ where: { id }, data: dto as any });
  }

  async verifyPasswordByUsername(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.status !== 'active') return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return user;
  }
}
