import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { successResponse, paginationMeta } from '@qa-platform/shared-utils';

@Injectable()
export class RunsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [runs, total] = await Promise.all([
      this.prisma.testRun.findMany({
        where: { project: { organizationId } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { stages: true },
      }),
      this.prisma.testRun.count({ where: { project: { organizationId } } }),
    ]);

    return { runs, meta: paginationMeta(total, page, limit) };
  }

  async findOne(id: string, organizationId: string) {
    const run = await this.prisma.testRun.findFirst({
      where: { id, project: { organizationId } },
      include: { stages: true, issues: true, report: true },
    });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }

  async getReportHtml(id: string, organizationId: string): Promise<string> {
    const run = await this.findOne(id, organizationId);

    const htmlUrl: string | undefined =
      (run as any).report?.htmlUrl ??
      ((run as any).stages?.find((s: any) => s.type === 'report_generation')?.result as any)?.htmlUrl;

    if (!htmlUrl) return '<p style="font-family:sans-serif;padding:40px;color:#94a3b8">Report not yet generated for this run.</p>';

    // Replace the public-facing localhost URL with the internal Docker MinIO URL
    const internalUrl = htmlUrl
      .replace('http://localhost:9000', 'http://minio:9000')
      .replace('https://localhost:9000', 'http://minio:9000');

    const { data } = await axios.get<string>(internalUrl, { responseType: 'text', timeout: 10000 });
    return data;
  }

  async cancelRun(id: string, organizationId: string) {
    const run = await this.findOne(id, organizationId);
    if (!['QUEUED', 'RUNNING'].includes(run.status)) {
      throw new Error('Run cannot be cancelled in its current state');
    }
    return this.prisma.testRun.update({
      where: { id },
      data: { status: 'CANCELLED' as any, completedAt: new Date() },
    });
  }
}
