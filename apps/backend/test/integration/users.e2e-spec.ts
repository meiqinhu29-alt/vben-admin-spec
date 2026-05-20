import type { INestApplication } from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service';
import {
  assignRole,
  createTestApp,
  createTestRole,
  truncateAll,
} from './test-helpers';

describe('users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    const financeRole = await createTestRole(prisma, 'finance', 'Finance');
    const user = await prisma.user.create({
      data: {
        username: 'infouser',
        passwordHash: await bcrypt.hash('pwd123456', 10),
        displayName: '信息用户',
        status: 'active',
      },
    });
    await assignRole(prisma, user.id, financeRole.id);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'infouser', password: 'pwd123456' });
    token = login.body.data.accessToken;
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await app.close();
  });

  it('returns user info for authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/user/info')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = res.body.data;
    expect(body.username).toBe('infouser');
    expect(body.roles).toEqual(['finance']);
    expect(body.shopIds).toEqual([]);
  });

  it('rejects without token', async () => {
    const res = await request(app.getHttpServer()).get('/api/user/info');
    expect(res.status).toBe(401);
  });

  it('returns user with shop ids when bound', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { username: 'infouser' },
    });

    const brand = await prisma.brand.create({
      data: { code: 'TEST', name: 'Test Brand' },
    });
    const shop1 = await prisma.shop.create({
      data: { code: 'S1', name: 'Shop 1', brandId: brand.id },
    });
    const shop2 = await prisma.shop.create({
      data: { code: 'S2', name: 'Shop 2', brandId: brand.id },
    });

    await prisma.userShopAccess.createMany({
      data: [
        { userId: user.id, shopId: shop1.id },
        { userId: user.id, shopId: shop2.id },
      ],
    });

    const res = await request(app.getHttpServer())
      .get('/api/user/info')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const body = res.body.data;
    expect(body.shopIds).toHaveLength(2);
  });
});
