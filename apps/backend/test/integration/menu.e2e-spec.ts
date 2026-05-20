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

describe('menu (e2e)', () => {
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

    // Create roles
    const adminRole = await createTestRole(prisma, 'admin', 'Admin', true);
    const staffRole = await createTestRole(prisma, 'staff', 'Staff');

    // Create users without role field
    await prisma.user.createMany({
      data: [
        {
          username: 'staff1',
          passwordHash,
          displayName: 'Staff One',
          status: 'active',
        },
        {
          username: 'admin1',
          passwordHash,
          displayName: 'Admin One',
          status: 'active',
        },
      ],
    });

    const staff = await prisma.user.findUniqueOrThrow({
      where: { username: 'staff1' },
    });
    const admin = await prisma.user.findUniqueOrThrow({
      where: { username: 'admin1' },
    });

    await assignRole(prisma, staff.id, staffRole.id);
    await assignRole(prisma, admin.id, adminRole.id);

    // Create menus
    const dashboard = await prisma.menu.create({
      data: {
        type: 'menu',
        name: 'Dashboard',
        path: '/dashboard',
        sortOrder: 1,
        status: 'active',
      },
    });
    const reports = await prisma.menu.create({
      data: {
        type: 'menu',
        name: 'Reports',
        path: '/reports',
        authCode: 'report:create',
        sortOrder: 2,
        status: 'active',
      },
    });
    const system = await prisma.menu.create({
      data: {
        type: 'menu',
        name: 'System',
        path: '/system',
        authCode: 'user:manage',
        sortOrder: 3,
        status: 'active',
      },
    });

    // Assign menus to roles via role_menus
    await prisma.roleMenu.createMany({
      data: [
        { roleId: staffRole.id, menuId: dashboard.id },
        { roleId: staffRole.id, menuId: reports.id },
        { roleId: adminRole.id, menuId: dashboard.id },
        { roleId: adminRole.id, menuId: reports.id },
        { roleId: adminRole.id, menuId: system.id },
      ],
    });

    const staffLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'staff1', password: 'test123' });
    staffToken = staffLogin.body.data.accessToken;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin1', password: 'test123' });
    adminToken = adminLogin.body.data.accessToken;
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
    const menus = res.body.data;
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
    const menus = res.body.data;
    expect(menus).toHaveLength(3);
    expect(menus.map((m: { name: string }) => m.name)).toContain('System');
  });

  it('staff codes include report:create', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/codes')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    const codes = res.body.data;
    expect(codes).toContain('report:create');
  });

  it('admin codes include user:manage', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/codes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const codes = res.body.data;
    expect(codes).toContain('user:manage');
  });
});
