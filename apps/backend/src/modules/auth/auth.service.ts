import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { UsersService } from '../users/users.service';

interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly permissions: PermissionsService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.users.verifyPasswordByUsername(username, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const roleCodes = await this.permissions.resolveUserRoleCodes(user.id);
    return this.issueTokens(user.id, user.username, roleCodes);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!stored) throw new UnauthorizedException('Refresh token revoked');

    const ok = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!ok) throw new UnauthorizedException('Refresh token mismatch');

    const user = await this.users.findById(payload.sub);
    if (!user || user.status !== 'active')
      throw new UnauthorizedException('User inactive');

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    // Re-fetch role codes in case roles changed since token was issued
    const roleCodes = await this.permissions.resolveUserRoleCodes(user.id);
    return this.issueTokens(user.id, user.username, roleCodes);
  }

  private async issueTokens(userId: string, username: string, roles: string[]) {
    const payload: JwtPayload = { sub: userId, username, roles };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '8h',
    } as never);

    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    } as never);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshTokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
