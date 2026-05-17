import { Module } from '@nestjs/common';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

@Module({
  controllers: [SummaryController],
  providers: [SummaryService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SummaryModule {}
