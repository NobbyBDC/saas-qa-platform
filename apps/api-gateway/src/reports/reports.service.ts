import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByRun(runId: string, organizationId: string) {
    const report = await this.prisma.qAReport.findFirst({
      where: { runId, run: { project: { organizationId } } },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async findByProject(projectId: string, organizationId: string, limit = 10) {
    return this.prisma.qAReport.findMany({
      where: { projectId, run: { project: { organizationId } } },
      orderBy: { generatedAt: 'desc' },
      take: limit,
    });
  }
}
