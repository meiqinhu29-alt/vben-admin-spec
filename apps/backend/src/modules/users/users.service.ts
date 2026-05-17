import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        shopAccess: { select: { shopId: true } },
        userRoles: { include: { role: { select: { code: true, name: true } } } },
      },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async verifyPasswordByUsername(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.status !== 'active') return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return user;
  }
}
