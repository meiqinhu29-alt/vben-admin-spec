import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { BalanceCalculatorService } from './balance-calculator.service';
import { DailyReportsController } from './daily-reports.controller';
import { DailyReportsService } from './daily-reports.service';

@Module({
  controllers: [DailyReportsController],
  providers: [BalanceCalculatorService, DailyReportsService, AuditService],
  exports: [DailyReportsService, BalanceCalculatorService, AuditService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class DailyReportsModule {}
