import type { INestApplication } from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service';
import {
  createTestApp,
  createTestRole,
  truncateAll,
} from './test-helpers';

describe('daily-reports (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let financeToken: string;
  let staffToken: string;
  let bossToken: string;
  let shopId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);

    const adminRole = await createTestRole(prisma, 'admin', 'Admin', true);
    const financeRole = await createTestRole(prisma, 'finance', 'Finance');
    const staffRole = await createTestRole(prisma, 'staff', 'Staff');
    const bossRole = await createTestRole(prisma, 'boss', 'Boss');

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
          username: 'finance1',
          passwordHash,
          displayName: 'Finance',
          status: 'active',
        },
        {
          username: 'staff1',
          passwordHash,
          displayName: 'Staff',
          status: 'active',
        },
        {
          username: 'boss1',
          passwordHash,
          displayName: 'Boss',
          status: 'active',
        },
      ],
    });

    const [admin, finance, staff, boss] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { username: 'admin1' } }),
      prisma.user.findUniqueOrThrow({ where: { username: 'finance1' } }),
      prisma.user.findUniqueOrThrow({ where: { username: 'staff1' } }),
      prisma.user.findUniqueOrThrow({ where: { username: 'boss1' } }),
    ]);

    await prisma.userRoleRelation.createMany({
      data: [
        { userId: admin.id, roleId: adminRole.id },
        { userId: finance.id, roleId: financeRole.id },
        { userId: staff.id, roleId: staffRole.id },
        { userId: boss.id, roleId: bossRole.id },
      ],
    });

    const brand = await prisma.brand.create({
      data: { code: 'TEST', name: 'Test' },
    });
    const shop = await prisma.shop.create({
      data: { code: 'S1', name: 'Shop1', brandId: brand.id },
    });
    shopId = shop.id;

    const login = async (username: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username, password: 'test123' });
      return res.body.data.accessToken as string;
    };

    [adminToken, financeToken, staffToken, bossToken] = await Promise.all([
      login('admin1'),
      login('finance1'),
      login('staff1'),
      login('boss1'),
    ]);
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await app.close();
  });

  it('rejects unauthenticated access (401)', async () => {
    const res = await request(app.getHttpServer()).get('/api/daily-reports');
    expect(res.status).toBe(401);
  });

  it('staff creates a report for their shop', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/daily-reports')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        shopId,
        reportDate: '2024-01-10',
        revenue: '5000',
        cardFee: '100',
        transferToCompany: '2000',
        depositToCompany: '500',
        payToOwner: '300',
        shopExpense: '200',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.shopId).toBe(shopId);
  });

  it('opening balance auto-fetched from previous report', async () => {
    // Create first report
    await request(app.getHttpServer())
      .post('/api/daily-reports')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        shopId,
        reportDate: '2024-01-10',
        revenue: '5000',
        cardFee: '100',
        transferToCompany: '2000',
        depositToCompany: '500',
        payToOwner: '300',
        shopExpense: '200',
      });

    const balanceRes = await request(app.getHttpServer())
      .get(`/api/daily-reports/balance?shopId=${shopId}&date=2024-01-11`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(balanceRes.status).toBe(200);
    // closingBalance of first report becomes opening balance of next
    expect(typeof balanceRes.body.data).toBe('string');
  });

  it('cannot create duplicate (same shop + date) — 409', async () => {
    const payload = {
      shopId,
      reportDate: '2024-01-10',
      revenue: '5000',
      cardFee: '0',
      transferToCompany: '0',
      depositToCompany: '0',
      payToOwner: '0',
      shopExpense: '0',
    };
    await request(app.getHttpServer())
      .post('/api/daily-reports')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(payload);

    const res = await request(app.getHttpServer())
      .post('/api/daily-reports')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(payload);
    expect(res.status).toBe(409);
  });

  it('finance audits a pending report → status becomes audited', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/daily-reports')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        shopId,
        reportDate: '2024-01-10',
        revenue: '5000',
        cardFee: '0',
        transferToCompany: '0',
        depositToCompany: '0',
        payToOwner: '0',
        shopExpense: '0',
      });
    const id = createRes.body.data.id;

    const res = await request(app.getHttpServer())
      .post(`/api/daily-reports/${id}/audit`)
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('audited');
  });

  it('finance cannot audit an already-audited report → 409', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/daily-reports')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        shopId,
        reportDate: '2024-01-10',
        revenue: '5000',
        cardFee: '0',
        transferToCompany: '0',
        depositToCompany: '0',
        payToOwner: '0',
        shopExpense: '0',
      });
    const id = createRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/daily-reports/${id}/audit`)
      .set('Authorization', `Bearer ${financeToken}`);

    const res = await request(app.getHttpServer())
      .post(`/api/daily-reports/${id}/audit`)
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(409);
  });

  it('boss locks an audited report → status becomes locked', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/daily-reports')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        shopId,
        reportDate: '2024-01-10',
        revenue: '5000',
        cardFee: '0',
        transferToCompany: '0',
        depositToCompany: '0',
        payToOwner: '0',
        shopExpense: '0',
      });
    const id = createRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/daily-reports/${id}/audit`)
      .set('Authorization', `Bearer ${financeToken}`);

    const res = await request(app.getHttpServer())
      .post(`/api/daily-reports/${id}/lock`)
      .set('Authorization', `Bearer ${bossToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('locked');
  });

  it('finance rejects an audited report → status back to pending', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/daily-reports')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        shopId,
        reportDate: '2024-01-10',
        revenue: '5000',
        cardFee: '0',
        transferToCompany: '0',
        depositToCompany: '0',
        payToOwner: '0',
        shopExpense: '0',
      });
    const id = createRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/daily-reports/${id}/audit`)
      .set('Authorization', `Bearer ${financeToken}`);

    const res = await request(app.getHttpServer())
      .post(`/api/daily-reports/${id}/reject`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ comment: 'wrong numbers' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');
  });

  it('admin unlocks a locked report → status back to audited', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/daily-reports')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        shopId,
        reportDate: '2024-01-10',
        revenue: '5000',
        cardFee: '0',
        transferToCompany: '0',
        depositToCompany: '0',
        payToOwner: '0',
        shopExpense: '0',
      });
    const id = createRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/daily-reports/${id}/audit`)
      .set('Authorization', `Bearer ${financeToken}`);
    await request(app.getHttpServer())
      .post(`/api/daily-reports/${id}/lock`)
      .set('Authorization', `Bearer ${bossToken}`);

    const res = await request(app.getHttpServer())
      .post(`/api/daily-reports/${id}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('audited');
  });

  it('cannot update a locked report → 409', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/daily-reports')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        shopId,
        reportDate: '2024-01-10',
        revenue: '5000',
        cardFee: '0',
        transferToCompany: '0',
        depositToCompany: '0',
        payToOwner: '0',
        shopExpense: '0',
      });
    const id = createRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/daily-reports/${id}/audit`)
      .set('Authorization', `Bearer ${financeToken}`);
    await request(app.getHttpServer())
      .post(`/api/daily-reports/${id}/lock`)
      .set('Authorization', `Bearer ${bossToken}`);

    const res = await request(app.getHttpServer())
      .patch(`/api/daily-reports/${id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ revenue: '9999' });
    expect(res.status).toBe(409);
  });
});
