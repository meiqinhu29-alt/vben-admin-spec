import type { INestApplication } from '@nestjs/common';

import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { PrismaService } from '../../src/prisma/prisma.service';

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  const prisma = moduleRef.get(PrismaService);
  return { app, prisma };
}

export async function createTestRole(
  prisma: PrismaService,
  code: string,
  name: string,
  isSystem = false,
) {
  return prisma.role.create({
    data: { code, name, status: 'active', isSystem },
  });
}

export async function assignRole(
  prisma: PrismaService,
  userId: string,
  roleId: string,
) {
  return prisma.userRoleRelation.create({
    data: { userId, roleId },
  });
}

export async function truncateAll(prisma: PrismaService) {
  await prisma.$transaction([
    prisma.userPermission.deleteMany({}),
    prisma.roleMenu.deleteMany({}),
    prisma.userRoleRelation.deleteMany({}),
    prisma.refreshToken.deleteMany({}),
    prisma.userShopAccess.deleteMany({}),
    prisma.shop.deleteMany({}),
    prisma.brand.deleteMany({}),
    prisma.menu.deleteMany({}),
    prisma.role.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);
}
