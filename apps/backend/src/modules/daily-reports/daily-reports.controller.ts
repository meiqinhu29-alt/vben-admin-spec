import type { AuthUser } from '../../common/decorators/current-user.decorator';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from './audit.service';
import { DailyReportsService } from './daily-reports.service';
import { CreateDailyReportDto } from './dto/create-daily-report.dto';
import { UpdateDailyReportDto } from './dto/update-daily-report.dto';

@Controller('daily-reports')
export class DailyReportsController {
  constructor(
    private readonly reports: DailyReportsService,
    private readonly audit: AuditService,
  ) {}

  @HttpCode(200)
  @Post(':id/audit')
  auditReport(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.audit.audit(id, user.userId, user.roles);
  }

  @Post()
  create(@Body() dto: CreateDailyReportDto, @CurrentUser() user: AuthUser) {
    return this.reports.create(dto, user.userId);
  }

  @Get('opening-balance')
  async getBalance(
    @Query('shopId') shopId: string,
    @Query('date') date: string,
  ) {
    const openingBalance = await this.reports.getOpeningBalance(
      shopId,
      new Date(date),
    );
    return { openingBalance };
  }

  @Get(':id')
  getById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.getById(id, user.userId);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('shopId') shopId?: string,
    @Query('shopIds') shopIds?: string,
    @Query('status') status?: string,
    @Query('statuses') statuses?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.reports.list({
      shopId,
      shopIds: shopIds ? shopIds.split(',').filter(Boolean) : undefined,
      status,
      statuses: statuses ? statuses.split(',').filter(Boolean) : undefined,
      dateFrom,
      dateTo,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      userId: user.userId,
    });
  }

  @HttpCode(200)
  @Post(':id/lock')
  lockReport(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.audit.lock(id, user.userId, user.roles);
  }

  @HttpCode(200)
  @Post(':id/reject')
  rejectReport(
    @Param('id') id: string,
    @Body('comment') comment: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.audit.reject(id, user.userId, user.roles, comment);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.reports.remove(id);
  }

  @HttpCode(200)
  @Post(':id/unlock')
  unlockReport(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.audit.unlock(id, user.userId, user.roles);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDailyReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.update(id, dto, user.userId);
  }
}
