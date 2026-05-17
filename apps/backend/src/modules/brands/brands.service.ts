import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBrandDto) {
    const exists = await this.prisma.brand.findUnique({
      where: { code: dto.code },
    });
    if (exists) throw new ConflictException('Brand code already exists');
    return this.prisma.brand.create({ data: dto });
  }

  async getById(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
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
      this.prisma.brand.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.brand.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async remove(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');

    const shopCount = await this.prisma.shop.count({
      where: { brandId: id },
    });
    if (shopCount > 0) {
      throw new ConflictException('Cannot delete brand with associated shops');
    }

    await this.prisma.brand.delete({ where: { id } });
  }

  async update(id: string, dto: UpdateBrandDto) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found');

    if (dto.code && dto.code !== brand.code) {
      const dup = await this.prisma.brand.findUnique({
        where: { code: dto.code },
      });
      if (dup) throw new ConflictException('Brand code already exists');
    }

    return this.prisma.brand.update({ where: { id }, data: dto });
  }
}
