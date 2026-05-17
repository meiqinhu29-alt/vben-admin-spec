import { Module } from '@nestjs/common';

import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';

@Module({
  controllers: [ShopsController],
  providers: [ShopsService],
  exports: [ShopsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ShopsModule {}
