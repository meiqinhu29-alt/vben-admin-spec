import { Buffer } from 'node:buffer';
import process from 'node:process';

import { Injectable, NotFoundException } from '@nestjs/common';
import * as Minio from 'minio';

import { PrismaService } from '../../prisma/prisma.service';

export interface MulterFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class AttachmentsService {
  private readonly bucket = 'vouchers';
  private readonly minio: Minio.Client;

  constructor(private readonly prisma: PrismaService) {
    this.minio = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: false,
      accessKey: process.env.MINIO_ROOT_USER ?? 'minio',
      secretKey: process.env.MINIO_ROOT_PASSWORD ?? 'minio_dev_pwd',
    });
    this.ensureBucket();
  }

  async listByReport(reportId: string) {
    return this.prisma.reportAttachment.findMany({
      where: { reportId, deletedAt: null },
      orderBy: { uploadedAt: 'asc' },
    });
  }

  async remove(id: string) {
    const att = await this.prisma.reportAttachment.findUnique({
      where: { id },
    });
    if (!att) throw new NotFoundException(`Attachment ${id} not found`);
    await this.prisma.reportAttachment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async upload(
    reportId: string,
    fieldName: string,
    file: MulterFile,
    uploadedBy: string,
  ) {
    const ext = file.originalname.split('.').pop() ?? 'bin';
    const objectName = `${reportId}/${fieldName}/${Date.now()}.${ext}`;

    await this.minio.putObject(
      this.bucket,
      objectName,
      file.buffer,
      file.size,
      {
        'Content-Type': file.mimetype,
      },
    );

    const url = `http://${process.env.MINIO_ENDPOINT ?? 'localhost'}:${process.env.MINIO_PORT ?? 9000}/${this.bucket}/${objectName}`;

    return this.prisma.reportAttachment.create({
      data: {
        reportId,
        fieldName,
        url,
        fileName: file.originalname,
        fileSize: file.size,
        uploadedBy,
      },
    });
  }

  private async ensureBucket() {
    try {
      const exists = await this.minio.bucketExists(this.bucket);
      if (!exists) {
        await this.minio.makeBucket(this.bucket);
        await this.minio.setBucketPolicy(
          this.bucket,
          JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { AWS: ['*'] },
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${this.bucket}/*`],
              },
            ],
          }),
        );
      }
    } catch {
      // MinIO may not be available in test env
    }
  }
}
