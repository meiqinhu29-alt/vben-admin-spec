import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DataScopeService } from '../../common/services/data-scope.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  async audit(reportId: string, operatorId: string, _operatorRoles: string[]) {
    const report = await this.findOrThrow(reportId);
    if (report.status !== 'pending') {
      throw new ConflictException(
        `Cannot audit report with status '${report.status}'`,
      );
    }
    await this.checkScopeAccess(report, operatorId);
    return this.transition(reportId, 'pending', 'audited', 'audit', operatorId, {
      auditedBy: operatorId,
      auditedAt: new Date(),
    });
  }

  async lock(reportId: string, operatorId: string, _operatorRoles: string[]) {
    const report = await this.findOrThrow(reportId);
    if (report.status !== 'audited') {
      throw new ConflictException(
        `Cannot lock report with status '${report.status}'`,
      );
    }
    await this.checkScopeAccess(report, operatorId);
    return this.transition(reportId, 'audited', 'locked', 'lock', operatorId, {
      lockedBy: operatorId,
      lockedAt: new Date(),
    });
  }

  async reject(
    reportId: string,
    operatorId: string,
    _operatorRoles: string[],
    comment?: string,
  ) {
    const report = await this.findOrThrow(reportId);
    if (report.status !== 'audited') {
      throw new ConflictException(
        `Cannot reject report with status '${report.status}'`,
      );
    }
    await this.checkScopeAccess(report, operatorId);
    return this.transition(
      reportId,
      'audited',
      'pending',
      'reject',
      operatorId,
      { auditedBy: null, auditedAt: null },
      comment,
    );
  }

  async unlock(reportId: string, operatorId: string, _operatorRoles: string[]) {
    const report = await this.findOrThrow(reportId);
    if (report.status !== 'locked') {
      throw new ConflictException(
        `Cannot unlock report with status '${report.status}'`,
      );
    }
    await this.checkScopeAccess(report, operatorId);
    return this.transition(reportId, 'locked', 'audited', 'unlock', operatorId, {
      lockedBy: null,
      lockedAt: null,
    });
  }

  private async checkScopeAccess(
    report: { createdBy: string; shopId: string },
    userId: string,
  ) {
    const scope = await this.dataScope.resolveUserScope(userId);
    if (scope.scope === 'all') return;
    if (scope.scope === 'shop' && !scope.shopIds.includes(report.shopId)) {
      throw new ForbiddenException('无权操作该店铺的日报');
    }
    if (scope.scope === 'self' && report.createdBy !== userId) {
      throw new ForbiddenException('只能操作自己创建的日报');
    }
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
