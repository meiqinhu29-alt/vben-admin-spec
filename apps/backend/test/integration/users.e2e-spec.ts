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
    const user = await prisma.user.findUnique({
      where: { username: 'infouser' },
    });
    if (!user) throw new Error('test setup failure');

    await prisma.userShopAccess.createMany({
      data: [
        { userId: user.id, shopId: '00000000-0000-0000-0000-000000000001' },
        { userId: user.id, shopId: '00000000-0000-0000-0000-000000000002' },
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
