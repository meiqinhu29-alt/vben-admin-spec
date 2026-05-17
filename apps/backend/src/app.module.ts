import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { UsersModule } from './modules/users/users.module';
import { PrismaService } from './prisma/prisma.service';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), UsersModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
