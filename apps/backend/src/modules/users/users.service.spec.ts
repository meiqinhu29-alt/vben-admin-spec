import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersService } from './users.service';

describe('usersService.verifyPasswordByUsername', () => {
  let service: UsersService;
  let prismaMock: { user: { findUnique: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    prismaMock = { user: { findUnique: vi.fn() } };
    service = new UsersService(prismaMock as any, { resolveUserScope: vi.fn().mockResolvedValue({ scope: 'all', shopIds: [] }) } as any);
  });

  it('returns null when user not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    expect(await service.verifyPasswordByUsername('nope', 'pwd')).toBeNull();
  });

  it('returns null when password mismatch', async () => {
    const passwordHash = await bcrypt.hash('correct', 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      username: 'alice',
      passwordHash,
      status: 'active',
    });
    expect(await service.verifyPasswordByUsername('alice', 'wrong')).toBeNull();
  });

  it('returns user when password matches and status active', async () => {
    const passwordHash = await bcrypt.hash('correct', 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      username: 'alice',
      passwordHash,
      status: 'active',
      role: 'staff',
      displayName: 'Alice',
    });
    const user = await service.verifyPasswordByUsername('alice', 'correct');
    expect(user?.id).toBe('u-1');
  });

  it('returns null when status disabled even if password correct', async () => {
    const passwordHash = await bcrypt.hash('correct', 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      username: 'alice',
      passwordHash,
      status: 'disabled',
    });
    expect(
      await service.verifyPasswordByUsername('alice', 'correct'),
    ).toBeNull();
  });
});
