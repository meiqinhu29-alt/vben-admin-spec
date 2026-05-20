import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { DataScopeService } from './common/services/data-scope.service';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { AuthModule } from './modules/auth/auth.module';
import { BrandsModule } from './modules/brands/brands.module';
import { DailyReportsModule } from './modules/daily-reports/daily-reports.module';
import { MenusModule } from './modules/menus/menus.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { RolesModule } from './modules/roles/roles.module';
import { ShopsModule } from './modules/shops/shops.module';
import { SummaryModule } from './modules/summary/summary.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaService } from './prisma/prisma.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    AuthModule,
    RolesModule,
    MenusModule,
    PermissionsModule,
    BrandsModule,
    ShopsModule,
    DailyReportsModule,
    SummaryModule,
    AttachmentsModule,
  ],
  providers: [
    PrismaService,
    DataScopeService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [PrismaService, DataScopeService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
