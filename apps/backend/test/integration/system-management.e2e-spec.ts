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

describe('system management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let adminRoleId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    const adminRole = await createTestRole(prisma, 'admin', 'Admin');
    adminRoleId = adminRole.id;
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: await bcrypt.hash('admin123', 10),
        displayName: '管理员',
        status: 'active',
      },
    });
    await assignRole(prisma, admin.id, adminRole.id);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = login.body.data.accessToken;
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await app.close();
  });

  function auth() {
    return { Authorization: `Bearer ${adminToken}` };
  }

  // ─── Users CRUD ───────────────────────────────────────────────────────

  describe('users', () => {
    it('pOST /users - creates a user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/users')
        .set(auth())
        .send({
          username: 'testuser',
          password: 'Pass1234',
          displayName: '测试',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.username).toBe('testuser');
    });

    it('gET /users - lists users with pagination', async () => {
      await prisma.user.create({
        data: {
          username: 'u1',
          passwordHash: 'x',
          displayName: 'U1',
          status: 'active',
        },
      });
      const res = await request(app.getHttpServer())
        .get('/api/users?page=1&pageSize=10')
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    });

    it('pATCH /users/:id - updates user', async () => {
      const u = await prisma.user.create({
        data: {
          username: 'u2',
          passwordHash: 'x',
          displayName: 'Old',
          status: 'active',
        },
      });
      const res = await request(app.getHttpServer())
        .patch(`/api/users/${u.id}`)
        .set(auth())
        .send({ displayName: 'New' });
      expect(res.status).toBe(200);
      expect(res.body.data.displayName).toBe('New');
    });

    it('dELETE /users/:id - removes user', async () => {
      const u = await prisma.user.create({
        data: {
          username: 'u3',
          passwordHash: 'x',
          displayName: 'Del',
          status: 'active',
        },
      });
      const res = await request(app.getHttpServer())
        .delete(`/api/users/${u.id}`)
        .set(auth());
      expect(res.status).toBe(204);
    });

    it('pUT /users/:id/roles - assigns roles', async () => {
      const u = await prisma.user.create({
        data: {
          username: 'u4',
          passwordHash: 'x',
          displayName: 'R',
          status: 'active',
        },
      });
      const role = await createTestRole(prisma, 'finance', 'Finance');
      const res = await request(app.getHttpServer())
        .put(`/api/users/${u.id}/roles`)
        .set(auth())
        .send({ roleIds: [role.id] });
      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
      const rels = await prisma.userRoleRelation.findMany({
        where: { userId: u.id },
      });
      expect(rels).toHaveLength(1);
      expect(rels[0]!.roleId).toBe(role.id);
    });

    it('pUT /users/:id/shops - assigns shops', async () => {
      const u = await prisma.user.create({
        data: {
          username: 'u5',
          passwordHash: 'x',
          displayName: 'S',
          status: 'active',
        },
      });
      const brand = await prisma.brand.create({
        data: { code: 'B1', name: 'Brand1' },
      });
      const shop = await prisma.shop.create({
        data: { code: 'SH1', name: 'Shop1', brandId: brand.id },
      });
      const res = await request(app.getHttpServer())
        .put(`/api/users/${u.id}/shops`)
        .set(auth())
        .send({ shopIds: [shop.id] });
      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
      const access = await prisma.userShopAccess.findMany({
        where: { userId: u.id },
      });
      expect(access).toHaveLength(1);
    });

    it('pOST /users/:id/password - changes password', async () => {
      const u = await prisma.user.create({
        data: {
          username: 'u6',
          passwordHash: await bcrypt.hash('old123', 10),
          displayName: 'P',
          status: 'active',
        },
      });
      const res = await request(app.getHttpServer())
        .post(`/api/users/${u.id}/password`)
        .set(auth())
        .send({ newPassword: 'NewPass123' });
      expect(res.status).toBe(201);
      expect(res.body.data.success).toBe(true);
    });
  });

  // ─── Roles CRUD ───────────────────────────────────────────────────────

  describe('roles', () => {
    it('pOST /system/roles - creates a role', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/system/roles')
        .set(auth())
        .send({ code: 'editor', name: 'Editor', status: 'active' });
      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe('editor');
    });

    it('gET /system/roles - lists roles', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/system/roles?page=1&pageSize=10')
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('gET /system/roles/:id - returns role with menuIds', async () => {
      const menu = await prisma.menu.create({
        data: { name: 'Dashboard', path: '/dash', type: 'menu', sortOrder: 1 },
      });
      await prisma.roleMenu.create({
        data: { roleId: adminRoleId, menuId: menu.id },
      });
      const res = await request(app.getHttpServer())
        .get(`/api/system/roles/${adminRoleId}`)
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.menuIds).toContain(menu.id);
    });

    it('pATCH /system/roles/:id - updates role', async () => {
      const role = await createTestRole(prisma, 'viewer', 'Viewer');
      const res = await request(app.getHttpServer())
        .patch(`/api/system/roles/${role.id}`)
        .set(auth())
        .send({ name: 'Viewer Updated' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Viewer Updated');
    });

    it('pUT /system/roles/:id/menus - assigns menus', async () => {
      const role = await createTestRole(prisma, 'test', 'Test');
      const m1 = await prisma.menu.create({
        data: { name: 'M1', path: '/m1', type: 'menu', sortOrder: 1 },
      });
      const m2 = await prisma.menu.create({
        data: { name: 'M2', path: '/m2', type: 'menu', sortOrder: 2 },
      });
      const res = await request(app.getHttpServer())
        .put(`/api/system/roles/${role.id}/menus`)
        .set(auth())
        .send({ menuIds: [m1.id, m2.id] });
      expect(res.status).toBe(200);
      const rms = await prisma.roleMenu.findMany({
        where: { roleId: role.id },
      });
      expect(rms).toHaveLength(2);
    });

    it('dELETE /system/roles/:id - removes role', async () => {
      const role = await createTestRole(prisma, 'del', 'Del');
      const res = await request(app.getHttpServer())
        .delete(`/api/system/roles/${role.id}`)
        .set(auth());
      expect(res.status).toBe(204);
    });
  });

  // ─── Shops CRUD ───────────────────────────────────────────────────────

  describe('shops', () => {
    let brandId: string;

    beforeEach(async () => {
      const brand = await prisma.brand.create({
        data: { code: 'BR', name: 'TestBrand' },
      });
      brandId = brand.id;
    });

    it('pOST /shops - creates a shop', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/shops')
        .set(auth())
        .send({
          code: 'SHOP1',
          name: 'Shop One',
          brandId,
          initialBalance: '1000.00',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe('SHOP1');
      expect(res.body.data.initialBalance).toMatch(/^1000/);
    });

    it('pOST /shops - rejects non-string initialBalance', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/shops')
        .set(auth())
        .send({
          code: 'SHOP2',
          name: 'Shop Two',
          brandId,
          initialBalance: 500,
        });
      expect(res.status).toBe(400);
    });

    it('gET /shops - lists shops', async () => {
      await prisma.shop.create({ data: { code: 'S1', name: 'S1', brandId } });
      const res = await request(app.getHttpServer())
        .get('/api/shops?page=1&pageSize=10')
        .set(auth());
      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('pATCH /shops/:id - updates shop', async () => {
      const shop = await prisma.shop.create({
        data: { code: 'S2', name: 'Old', brandId },
      });
      const res = await request(app.getHttpServer())
        .patch(`/api/shops/${shop.id}`)
        .set(auth())
        .send({ name: 'New Name' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('New Name');
    });

    it('dELETE /shops/:id - removes shop', async () => {
      const shop = await prisma.shop.create({
        data: { code: 'S3', name: 'Del', brandId },
      });
      const res = await request(app.getHttpServer())
        .delete(`/api/shops/${shop.id}`)
        .set(auth());
      expect(res.status).toBe(204);
    });
  });
});
