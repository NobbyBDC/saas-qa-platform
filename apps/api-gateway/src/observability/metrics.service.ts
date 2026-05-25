import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as client from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly registry: client.Registry;

  // Prometheus counters / histograms
  readonly pipelineRuns: client.Counter;
  readonly pipelineDuration: client.Histogram;
  readonly pipelineFailures: client.Counter;
  readonly apiRequestDuration: client.Histogram;
  readonly activeWebsockets: client.Gauge;

  constructor(private readonly prisma: PrismaService) {
    this.registry = new client.Registry();
    client.collectDefaultMetrics({ register: this.registry, prefix: 'qaplatform_' });

    this.pipelineRuns = new client.Counter({
      name: 'qaplatform_pipeline_runs_total',
      help: 'Total number of pipeline runs',
      labelNames: ['status', 'trigger', 'org_id'],
      registers: [this.registry],
    });

    this.pipelineDuration = new client.Histogram({
      name: 'qaplatform_pipeline_duration_seconds',
      help: 'Pipeline run duration in seconds',
      buckets: [10, 30, 60, 120, 300, 600, 1200],
      labelNames: ['status', 'org_id'],
      registers: [this.registry],
    });

    this.pipelineFailures = new client.Counter({
      name: 'qaplatform_pipeline_failures_total',
      help: 'Total pipeline failures',
      labelNames: ['org_id', 'project_id'],
      registers: [this.registry],
    });

    this.apiRequestDuration = new client.Histogram({
      name: 'qaplatform_http_request_duration_seconds',
      help: 'HTTP request duration',
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.activeWebsockets = new client.Gauge({
      name: 'qaplatform_active_websocket_connections',
      help: 'Number of active WebSocket connections',
      registers: [this.registry],
    });
  }

  async recordRunComplete(runId: string) {
    const run = await this.prisma.testRun.findUnique({ where: { id: runId } });
    if (!run) return;

    this.pipelineRuns.inc({ status: run.status, trigger: run.triggeredBy, org_id: run.organizationId });

    if (run.durationMs) {
      this.pipelineDuration.observe(
        { status: run.status, org_id: run.organizationId },
        run.durationMs / 1000,
      );
    }

    if (run.status === 'FAILED') {
      this.pipelineFailures.inc({ org_id: run.organizationId, project_id: run.projectId });
    }

    await this.prisma.metricSnapshot.create({
      data: {
        organizationId: run.organizationId,
        projectId: run.projectId,
        metricName: 'pipeline_duration',
        value: run.durationMs ? run.durationMs / 1000 : 0,
        labels: { status: run.status, trigger: run.triggeredBy },
      },
    });
  }

  async getPrometheusMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  async getDashboardMetrics(organizationId: string, days = 30) {
    const since = new Date(Date.now() - days * 86400_000);

    const [runs, failureRate, avgDuration, deployFreq] = await Promise.all([
      this.prisma.testRun.groupBy({
        by: ['status'],
        where: { organizationId, createdAt: { gte: since } },
        _count: { id: true },
      }),
      this.prisma.metricSnapshot.aggregate({
        where: {
          organizationId,
          metricName: 'pipeline_duration',
          recordedAt: { gte: since },
        },
        _avg: { value: true },
        _count: { id: true },
      }),
      this.prisma.metricSnapshot.aggregate({
        where: { organizationId, metricName: 'pipeline_duration', recordedAt: { gte: since } },
        _avg: { value: true },
      }),
      this.prisma.testRun.count({
        where: { organizationId, status: 'PASSED', createdAt: { gte: since } },
      }),
    ]);

    const total = runs.reduce((s, r) => s + r._count.id, 0);
    const failed = runs.find(r => r.status === 'FAILED')?._count.id ?? 0;

    const dailyRuns = await this.prisma.$queryRaw<Array<{ date: Date; count: bigint; failed: bigint }>>`
      SELECT DATE_TRUNC('day', "createdAt") as date,
             COUNT(*) as count,
             COUNT(*) FILTER (WHERE status = 'FAILED') as failed
      FROM "TestRun"
      WHERE "organizationId" = ${organizationId}
        AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `;

    return {
      summary: {
        totalRuns: total,
        passRate: total > 0 ? Math.round(((total - failed) / total) * 100) : 0,
        avgDurationSeconds: Math.round(avgDuration._avg.value ?? 0),
        deployFrequency: deployFreq,
      },
      byStatus: runs.map(r => ({ status: r.status, count: r._count.id })),
      daily: dailyRuns.map(d => ({
        date: d.date,
        total: Number(d.count),
        failed: Number(d.failed),
      })),
    };
  }

  async getProjectMetrics(projectId: string, days = 7) {
    const since = new Date(Date.now() - days * 86400_000);

    const runs = await this.prisma.testRun.findMany({
      where: { projectId, createdAt: { gte: since } },
      select: { id: true, status: true, durationMs: true, createdAt: true, summary: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      runs: runs.map(r => ({
        id: r.id,
        status: r.status,
        durationSeconds: r.durationMs ? r.durationMs / 1000 : null,
        score: (r.summary as any)?.overallScore ?? 0,
        createdAt: r.createdAt,
      })),
      avgScore: runs.length
        ? Math.round(runs.reduce((s, r) => s + ((r.summary as any)?.overallScore ?? 0), 0) / runs.length)
        : 0,
    };
  }
}
