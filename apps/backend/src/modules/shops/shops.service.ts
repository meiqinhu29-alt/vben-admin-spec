import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DataScopeService } from '../../common/services/data-scope.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';

@Injectable()
export class ShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  async create(dto: CreateShopDto) {
    const exists = await this.prisma.shop.findUnique({
      where: { code: dto.code },
    });
    if (exists) throw new ConflictException('Shop code already exists');

    const brand = await this.prisma.brand.findUnique({
      where: { id: dto.brandId },
    });
    if (!brand) throw new NotFoundException('Brand not found');

    return this.prisma.shop.create({
      data: dto,
      include: { brand: { select: { id: true, code: true, name: true } } },
    });
  }

  async getById(id: string, userId?: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: { brand: { select: { id: true, code: true, name: true } } },
    });
    if (!shop) throw new NotFoundException('Shop not found');

    if (userId) {
      const scope = await this.dataScope.resolveUserScope(userId);
      if (scope.scope === 'shop' && !scope.shopIds.includes(shop.id)) {
        throw new NotFoundException('Shop not found');
      }
    }

    return shop;
  }

  async list(query: {
    brandId?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
    status?: string;
    userId?: string;
  }) {
    const {
      brandId,
      keyword,
      page = 1,
      pageSize = 10,
      status,
      userId,
    } = query;
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
    if (brandId) {
      where.brandId = brandId;
    }

    // 数据范围过滤：shop/self 都按 UserShopAccess 限制
    if (userId) {
      const scope = await this.dataScope.resolveUserScope(userId);
      if (scope.scope !== 'all') {
        if (scope.shopIds.length === 0) {
          return { items: [], total: 0, page, pageSize };
        }
        where.id = { in: scope.shopIds };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.shop.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { brand: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.shop.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async remove(id: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id } });
    if (!shop) throw new NotFoundException('Shop not found');
    await this.prisma.shop.delete({ where: { id } });
  }

  async update(id: string, dto: UpdateShopDto) {
    const shop = await this.prisma.shop.findUnique({ where: { id } });
    if (!shop) throw new NotFoundException('Shop not found');

    if (dto.code && dto.code !== shop.code) {
      const dup = await this.prisma.shop.findUnique({
        where: { code: dto.code },
      });
      if (dup) throw new ConflictException('Shop code already exists');
    }

    if (dto.brandId) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: dto.brandId },
      });
      if (!brand) throw new NotFoundException('Brand not found');
    }

    return this.prisma.shop.update({
      where: { id },
      data: dto,
      include: { brand: { select: { id: true, code: true, name: true } } },
    });
  }
}
