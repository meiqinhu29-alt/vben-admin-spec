import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { MulterFile } from './attachments.service';

import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AttachmentsService } from './attachments.service';

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get(':reportId')
  list(@Param('reportId') reportId: string) {
    return this.attachments.listByReport(reportId);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.attachments.remove(id);
  }

  @Post(':reportId/:fieldName')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  upload(
    @Param('reportId') reportId: string,
    @Param('fieldName') fieldName: string,
    @UploadedFile() file: MulterFile,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attachments.upload(reportId, fieldName, file, user.userId);
  }
}
