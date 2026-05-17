import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async audit(reportId: string, operatorId: string, operatorRoles: string[]) {
    const report = await this.findOrThrow(reportId);
    if (report.status !== 'pending') {
      throw new ConflictException(
        `Cannot audit report with status '${report.status}'`,
      );
    }
    if (!operatorRoles.some((r) => ['finance', 'admin'].includes(r))) {
      throw new ForbiddenException('Only finance or admin can audit reports');
    }
    return this.transition(
      reportId,
      'pending',
      'audited',
      'audit',
      operatorId,
      {
        auditedBy: operatorId,
        auditedAt: new Date(),
      },
    );
  }

  async lock(reportId: string, operatorId: string, operatorRoles: string[]) {
    const report = await this.findOrThrow(reportId);
    if (report.status !== 'audited') {
      throw new ConflictException(
        `Cannot lock report with status '${report.status}'`,
      );
    }
    if (!operatorRoles.some((r) => ['boss', 'admin'].includes(r))) {
      throw new ForbiddenException('Only boss or admin can lock reports');
    }
    return this.transition(reportId, 'audited', 'locked', 'lock', operatorId, {
      lockedBy: operatorId,
      lockedAt: new Date(),
    });
  }

  async reject(
    reportId: string,
    operatorId: string,
    operatorRoles: string[],
    comment?: string,
  ) {
    const report = await this.findOrThrow(reportId);
    if (report.status !== 'audited') {
      throw new ConflictException(
        `Cannot reject report with status '${report.status}'`,
      );
    }
    if (!operatorRoles.some((r) => ['finance', 'admin'].includes(r))) {
      throw new ForbiddenException('Only finance or admin can reject reports');
    }
    return this.transition(
      reportId,
      'audited',
      'pending',
      'reject',
      operatorId,
      {
        auditedBy: null,
        auditedAt: null,
      },
      comment,
    );
  }

  async unlock(reportId: string, operatorId: string, operatorRoles: string[]) {
    const report = await this.findOrThrow(reportId);
    if (report.status !== 'locked') {
      throw new ConflictException(
        `Cannot unlock report with status '${report.status}'`,
      );
    }
    if (!operatorRoles.includes('admin')) {
      throw new ForbiddenException('Only admin can unlock reports');
    }
    return this.transition(
      reportId,
      'locked',
      'audited',
      'unlock',
      operatorId,
      {
        lockedBy: null,
        lockedAt: null,
      },
    );
  }

  private async findOrThrow(reportId: string) {
    const report = await this.prisma.dailyFundsReport.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException(`Report ${reportId} not found`);
    return report;
  }

  private async transition(
    reportId: string,
    fromStatus: string,
    toStatus: string,
    action: string,
    operatorId: string,
    extraData: Record<string, any>,
    comment?: string,
  ) {
    const [updated] = await this.prisma.$transaction([
      this.prisma.dailyFundsReport.update({
        where: { id: reportId, status: fromStatus as any },
        data: { status: toStatus as any, ...extraData },
      }),
      this.prisma.auditLog.create({
        data: {
          reportId,
          operatorId,
          action: action as any,
          fromStatus,
          toStatus,
          comment: comment ?? null,
        },
      }),
    ]);
    return updated;
  }
}
