import { Module } from '@nestjs/common';

import { BalanceCalculatorService } from './balance-calculator.service';
import { DailyReportsService } from './daily-reports.service';

@Module({
  providers: [BalanceCalculatorService, DailyReportsService],
  exports: [DailyReportsService, BalanceCalculatorService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class DailyReportsModule {}
