import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async assignMenus(roleId: string, menuIds: string[]) {
    await this.prisma.role
      .findUniqueOrThrow({ where: { id: roleId } })
      .catch(() => {
        throw new NotFoundException('Role not found');
      });

    await this.prisma.$transaction([
      this.prisma.roleMenu.deleteMany({ where: { roleId } }),
      this.prisma.roleMenu.createMany({
        data: menuIds.map((menuId) => ({ roleId, menuId })),
      }),
    ]);
  }

  async create(dto: CreateRoleDto) {
    const exists = await this.prisma.role.findUnique({
      where: { code: dto.code },
    });
    if (exists) throw new ConflictException('Role code already exists');
    return this.prisma.role.create({ data: dto });
  }

  async getById(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async list(query: {
    keyword?: string;
    page?: number;
    pageSize?: number;
    status?: string;
  }) {
    const { keyword, page = 1, pageSize = 10, status } = query;
    const where: Record<string, any> = {};

    if (keyword) {
      where.OR = [
        { code: { contains: keyword, mode: 'insensitive' } },
        { name: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.role.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) {
      throw new ConflictException('System roles cannot be deleted');
    }

    const userCount = await this.prisma.userRoleRelation.count({
      where: { roleId: id },
    });
    if (userCount > 0) {
      throw new ConflictException('Cannot delete role with assigned users');
    }

    await this.prisma.role.delete({ where: { id } });
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    if (dto.code && dto.code !== role.code) {
      const dup = await this.prisma.role.findUnique({
        where: { code: dto.code },
      });
      if (dup) throw new ConflictException('Role code already exists');
    }

    return this.prisma.role.update({ where: { id }, data: dto });
  }
}
