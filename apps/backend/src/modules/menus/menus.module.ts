import { Module } from '@nestjs/common';

import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';

@Module({
  controllers: [MenusController],
  providers: [MenusService],
  exports: [MenusService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MenusModule {}
