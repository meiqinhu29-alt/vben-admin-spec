import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMenuDto) {
    if (dto.parentId) {
      const parent = await this.prisma.menu.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent)
        throw new NotFoundException(`Parent menu ${dto.parentId} not found`);
    }

    if (dto.authCode) {
      const existing = await this.prisma.menu.findUnique({
        where: { authCode: dto.authCode },
      });
      if (existing)
        throw new ConflictException(`authCode ${dto.authCode} already exists`);
    }

    return this.prisma.menu.create({
      data: {
        parentId: dto.parentId ?? null,
        type: dto.type,
        name: dto.name,
        path: dto.path ?? null,
        component: dto.component ?? null,
        authCode: dto.authCode ?? null,
        meta: dto.meta ?? {},
        status: dto.status ?? 'active',
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async getById(id: string) {
    const menu = await this.prisma.menu.findUnique({ where: { id } });
    if (!menu) throw new NotFoundException(`Menu ${id} not found`);
    return menu;
  }

  async listTree() {
    const all = await this.prisma.menu.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return this.buildTree(all, null);
  }

  async remove(id: string) {
    const existing = await this.prisma.menu.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Menu ${id} not found`);

    const childCount = await this.prisma.menu.count({
      where: { parentId: id },
    });
    if (childCount > 0) {
      throw new ConflictException(
        `Cannot delete menu with ${childCount} child(ren); delete children first`,
      );
    }

    await this.prisma.menu.delete({ where: { id } });
  }

  async update(id: string, dto: UpdateMenuDto) {
    const existing = await this.prisma.menu.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Menu ${id} not found`);

    if (dto.parentId !== undefined && dto.parentId !== null) {
      const parent = await this.prisma.menu.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent)
        throw new NotFoundException(`Parent menu ${dto.parentId} not found`);
      if (dto.parentId === id)
        throw new ConflictException('Menu cannot be its own parent');
    }

    if (dto.authCode && dto.authCode !== existing.authCode) {
      const dup = await this.prisma.menu.findUnique({
        where: { authCode: dto.authCode },
      });
      if (dup)
        throw new ConflictException(`authCode ${dto.authCode} already exists`);
    }

    return this.prisma.menu.update({ where: { id }, data: dto });
  }

  private buildTree(menus: any[], parentId: null | string): any[] {
    return menus
      .filter((m) => m.parentId === parentId)
      .map((m) => {
        const children = this.buildTree(menus, m.id);
        return {
          ...m,
          children: children.length > 0 ? children : undefined,
        };
      });
  }
}
