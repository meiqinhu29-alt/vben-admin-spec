import type { INestApplication } from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestApp, truncateAll } from './test-helpers';

describe('auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await prisma.user.create({
      data: {
        username: 'testuser',
        passwordHash: await bcrypt.hash('test123', 10),
        displayName: 'Test User',
        role: 'staff',
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    await truncateAll(prisma);
    await app.close();
  });

  it('rejects login with bad credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('issues tokens on successful login', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'test123' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('rejects logout without auth', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('logs out successfully with valid token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'test123' });
    const token = login.body.data.accessToken;

    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it('refreshes tokens with valid refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'test123' });
    const refreshToken = login.body.data.refreshToken;

    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(res.status).toBe(200);
    const newRefresh = res.body.data.refreshToken;
    expect(newRefresh).toBeDefined();

    const stored = await prisma.refreshToken.findMany({
      orderBy: { createdAt: 'asc' },
    });
    expect(stored).toHaveLength(2);
    expect(stored[0]?.revokedAt).not.toBeNull();
    expect(stored[1]?.revokedAt).toBeNull();
  });
});
