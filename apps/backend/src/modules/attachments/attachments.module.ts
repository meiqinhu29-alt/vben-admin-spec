import { Module } from '@nestjs/common';

import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AttachmentsModule {}
