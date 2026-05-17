import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';

const usersServiceMock = {
  verifyPasswordByUsername: vi.fn(),
  findById: vi.fn(),
};

const jwtServiceMock = {
  signAsync: vi.fn(),
  verifyAsync: vi.fn(),
};

const prismaMock = {
  refreshToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

const configServiceMock = {
  get: vi.fn((key: string) => {
    const map: Record<string, string> = {
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      JWT_ACCESS_SECRET: 'access-secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
    };
    return map[key];
  }),
};

describe('authService.login', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      usersServiceMock as any,
      jwtServiceMock as any,
      prismaMock as any,
      configServiceMock as any,
    );
  });

  it('throws UnauthorizedException when password incorrect', async () => {
    usersServiceMock.verifyPasswordByUsername.mockResolvedValue(null);
    await expect(service.login('alice', 'bad')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('returns tokens when login succeeds', async () => {
    usersServiceMock.verifyPasswordByUsername.mockResolvedValue({
      id: 'u-1',
      username: 'alice',
      role: 'staff',
    });
    jwtServiceMock.signAsync
      .mockResolvedValueOnce('access-jwt')
      .mockResolvedValueOnce('refresh-jwt');
    prismaMock.refreshToken.create.mockResolvedValue({});

    const result = await service.login('alice', 'good');
    expect(result.accessToken).toBe('access-jwt');
    expect(result.refreshToken).toBe('refresh-jwt');
    expect(prismaMock.refreshToken.create).toHaveBeenCalledTimes(1);
  });
});
