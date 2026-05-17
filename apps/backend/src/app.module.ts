import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaService } from './prisma/prisma.service';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), UsersModule, AuthModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
