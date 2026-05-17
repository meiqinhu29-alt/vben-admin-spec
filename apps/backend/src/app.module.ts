import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaService } from './prisma/prisma.service';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), UsersModule, AuthModule],
  providers: [PrismaService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [PrismaService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
