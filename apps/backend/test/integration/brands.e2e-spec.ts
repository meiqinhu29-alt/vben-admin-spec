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

describe('brands (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let staffToken: string;

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
        { username: 'admin1', passwordHash, displayName: 'Admin', status: 'active' },
        { username: 'staff1', passwordHash, displayName: 'Staff', status: 'active' },
      ],
    });

    const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin1' } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { username: 'staff1' } });

    await assignRole(prisma, admin.id, adminRole.id);
    await assignRole(prisma, staff.id, staffRole.id);

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
    const res = await request(app.getHttpServer()).get('/api/brands');
    expect(res.status).toBe(401);
  });

  it('staff can read but not write (200 list, 403 create)', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/brands')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(listRes.status).toBe(200);

    const createRes = await request(app.getHttpServer())
      .post('/api/brands')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ code: 'BR1', name: 'Brand One' });
    expect(createRes.status).toBe(403);
  });

  it('admin creates brand and lists it', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'BR1', name: 'Brand One' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.code).toBe('BR1');

    const listRes = await request(app.getHttpServer())
      .get('/api/brands')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items).toHaveLength(1);
    expect(listRes.body.data.items[0].code).toBe('BR1');
  });

  it('rejects duplicated brand code (409)', async () => {
    await request(app.getHttpServer())
      .post('/api/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'BR1', name: 'Brand One' });

    const res = await request(app.getHttpServer())
      .post('/api/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'BR1', name: 'Brand Duplicate' });
    expect(res.status).toBe(409);
  });

  it('updates an existing brand', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'BR1', name: 'Brand One' });
    const id = createRes.body.data.id;

    const updateRes = await request(app.getHttpServer())
      .patch(`/api/brands/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Brand' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Updated Brand');
  });

  it('returns 404 when updating nonexistent brand', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/brands/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });

  it('refuses to delete brand with shops (409)', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'BR1', name: 'Brand One' });
    const brandId = createRes.body.data.id;

    await prisma.shop.create({
      data: { code: 'SH1', name: 'Shop One', brandId, status: 'active' },
    });

    const res = await request(app.getHttpServer())
      .delete(`/api/brands/${brandId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });

  it('deletes brand without shops (204)', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'BR1', name: 'Brand One' });
    const id = createRes.body.data.id;

    const res = await request(app.getHttpServer())
      .delete(`/api/brands/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });
});
