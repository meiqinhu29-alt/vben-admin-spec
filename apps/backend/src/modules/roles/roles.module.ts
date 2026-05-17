import { Module } from '@nestjs/common';

import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class RolesModule {}
