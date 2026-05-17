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

describe('shops (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let staffToken: string;
  let brandId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);

    const adminRole = await createTestRole(prisma, 'admin', 'Admin', true);
    const staffRole = await createTestRole(prisma, 'staff', 'Staff');

    const passwordHash = await bcrypt.hash('test123', 10);
    await prisma.user.createMany({
      data: [
        {
          username: 'admin1',
          passwordHash,
          displayName: 'Admin',
          status: 'active',
        },
        {
          username: 'staff1',
          passwordHash,
          displayName: 'Staff',
          status: 'active',
        },
      ],
    });

    const admin = await prisma.user.findUniqueOrThrow({
      where: { username: 'admin1' },
    });
    const staff = await prisma.user.findUniqueOrThrow({
      where: { username: 'staff1' },
    });

    await assignRole(prisma, admin.id, adminRole.id);
    await assignRole(prisma, staff.id, staffRole.id);

    // Create a brand for shop tests
    const brand = await prisma.brand.create({
      data: { code: 'BR1', name: 'Test Brand', status: 'active' },
    });
    brandId = brand.id;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin1', password: 'test123' });
    adminToken = adminLogin.body.data.accessToken;

    const staffLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'staff1', password: 'test123' });
    staffToken = staffLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await app.close();
  });

  it('rejects unauthenticated list (401)', async () => {
    const res = await request(app.getHttpServer()).get('/api/shops');
    expect(res.status).toBe(401);
  });

  it('staff can read but not create (403)', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/shops')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(listRes.status).toBe(200);

    const createRes = await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ code: 'SH1', name: 'Shop One', brandId });
    expect(createRes.status).toBe(403);
  });

  it('admin creates shop with brand association (201, includes brand info)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'SH1', name: 'Shop One', brandId });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('SH1');
    expect(res.body.data.brand).toBeDefined();
    expect(res.body.data.brand.code).toBe('BR1');
  });

  it('rejects shop with nonexistent brand (404)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'SH1',
        name: 'Shop One',
        brandId: '00000000-0000-0000-0000-000000000000',
      });
    expect(res.status).toBe(404);
  });

  it('updates shop', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'SH1', name: 'Shop One', brandId });
    const id = createRes.body.data.id;

    const updateRes = await request(app.getHttpServer())
      .patch(`/api/shops/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Shop' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Updated Shop');
  });

  it('deletes shop (204)', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'SH1', name: 'Shop One', brandId });
    const id = createRes.body.data.id;

    const res = await request(app.getHttpServer())
      .delete(`/api/shops/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });

  it('filters shops by brandId', async () => {
    const brand2 = await prisma.brand.create({
      data: { code: 'BR2', name: 'Brand Two', status: 'active' },
    });

    await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'SH1', name: 'Shop One', brandId });

    await request(app.getHttpServer())
      .post('/api/shops')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'SH2', name: 'Shop Two', brandId: brand2.id });

    const res = await request(app.getHttpServer())
      .get(`/api/shops?brandId=${brandId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].code).toBe('SH1');
  });
});
