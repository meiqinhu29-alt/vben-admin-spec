import { Module } from '@nestjs/common';

import { PermissionsService } from './permissions.service';

@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PermissionsModule {}
