import type { INestApplication } from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, truncateAll } from './test-helpers';

describe('Menu (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let staffToken: string;
  let adminToken: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    const passwordHash = await bcrypt.hash('test123', 10);
    await prisma.user.createMany({
      data: [
        {
          username: 'staff1',
          passwordHash,
          displayName: 'Staff One',
          role: 'staff',
          status: 'active',
        },
        {
          username: 'admin1',
          passwordHash,
          displayName: 'Admin One',
          role: 'admin',
          status: 'active',
        },
      ],
    });

    const staffLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'staff1', password: 'test123' });
    staffToken =
      staffLogin.body.accessToken ?? staffLogin.body.data?.accessToken;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin1', password: 'test123' });
    adminToken =
      adminLogin.body.accessToken ?? adminLogin.body.data?.accessToken;
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app.getHttpServer()).get('/api/menu/all');
    expect(res.status).toBe(401);
  });

  it('staff sees only Dashboard + Reports menus', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/menu/all')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    const menus = res.body.data ?? res.body;
    expect(Array.isArray(menus)).toBe(true);
    expect(menus).toHaveLength(2);
    expect(menus.map((m: { name: string }) => m.name)).toEqual([
      'Dashboard',
      'Reports',
    ]);
  });

  it('admin sees all 3 menus including System', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/menu/all')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const menus = res.body.data ?? res.body;
    expect(menus).toHaveLength(3);
    expect(menus.map((m: { name: string }) => m.name)).toContain('System');
  });

  it('staff codes include report:create', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/codes')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    const codes = res.body.data ?? res.body;
    expect(codes).toContain('report:create');
  });

  it('admin codes include user:manage', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/codes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const codes = res.body.data ?? res.body;
    expect(codes).toContain('user:manage');
  });
});
