import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { RunsGateway } from '../websocket/runs.gateway';
import { createLogger } from '@qa-platform/shared-utils/logger';

const logger = createLogger('runs-processor');

interface RunJobData {
  runId: string;
  projectId: string;
  previewUrl?: string;
  repositoryUrl?: string;
  defaultBranch?: string;
  sonarProjectKey?: string;
  sonarToken?: string;
  settings: Record<string, unknown>;
}

@Injectable()
@Processor('runs')
export class RunsProcessor {
  private readonly testingServiceUrl: string;
  private readonly securityServiceUrl: string;
  private readonly reportingServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ws: RunsGateway,
    private readonly config: ConfigService,
  ) {
    this.testingServiceUrl = config.get('TESTING_SERVICE_URL', 'http://testing-service:4003');
    this.securityServiceUrl = config.get('SECURITY_SERVICE_URL', 'http://security-service:4004');
    this.reportingServiceUrl = config.get('REPORTING_SERVICE_URL', 'http://reporting-service:4005');
  }

  @Process('execute-run')
  async executeRun(job: Job<RunJobData>) {
    const {
      runId, projectId,
      previewUrl, repositoryUrl, defaultBranch,
      sonarProjectKey, sonarToken, settings,
    } = job.data;
    logger.info('Starting run', { runId });

    await this.updateRunStatus(runId, 'RUNNING');

    try {
      const enabledTests = (settings as any)?.enabledTests ?? {};
      const testPromises = [];

      if (enabledTests.functional !== false) {
        testPromises.push(
          this.executeStage(runId, 'functional', () =>
            axios.post(`${this.testingServiceUrl}/testing/functional`, {
              runId, previewUrl,
            }).then(r => r.data.data),
          ),
        );
      }

      if (enabledTests.accessibility !== false) {
        testPromises.push(
          this.executeStage(runId, 'accessibility', () =>
            axios.post(`${this.testingServiceUrl}/testing/accessibility`, {
              runId, previewUrl,
            }).then(r => r.data.data),
          ),
        );
      }

      if (enabledTests.performance !== false) {
        testPromises.push(
          this.executeStage(runId, 'performance', () =>
            axios.post(`${this.testingServiceUrl}/testing/performance`, {
              runId, previewUrl,
            }).then(r => r.data.data),
          ),
        );
      }

      if (enabledTests.security !== false) {
        testPromises.push(
          this.executeStage(runId, 'security', () =>
            axios.post(`${this.securityServiceUrl}/security/scan`, {
              runId, previewUrl,
            }).then(r => r.data.data),
          ),
        );
      }

      if (enabledTests.codeQuality !== false && repositoryUrl) {
        testPromises.push(
          this.executeStage(runId, 'code_quality', () =>
            axios.post(`${this.securityServiceUrl}/security/code-quality`, {
              runId,
              repositoryUrl,
              defaultBranch,
              sonarProjectKey,
              sonarToken,
            }).then(r => r.data.data),
          ),
        );
      }

      const testResults = await Promise.allSettled(testPromises);

      // 9. Report generation
      const reportResult = await this.executeStage(runId, 'report_generation', () =>
        axios.post(`${this.reportingServiceUrl}/reports/generate`, {
          runId, projectId, testResults: testResults.map(r => r.status === 'fulfilled' ? r.value : null),
        }).then(r => r.data.data),
      );

      // Persist the QAReport record so the UI can access htmlUrl/jsonUrl
      if (reportResult) {
        const runRecord = await this.prisma.testRun.findUnique({ where: { id: runId }, select: { organizationId: true } });
        await this.prisma.qAReport.upsert({
          where: { runId },
          create: {
            runId,
            projectId,
            organizationId: runRecord?.organizationId ?? '',
            summary: (reportResult.summary ?? {}) as any,
            htmlUrl: reportResult.htmlUrl ?? null,
            jsonUrl: reportResult.jsonUrl ?? null,
          },
          update: {
            summary: (reportResult.summary ?? {}) as any,
            htmlUrl: reportResult.htmlUrl ?? null,
            jsonUrl: reportResult.jsonUrl ?? null,
          },
        });
      }

      // Mark complete
      await this.updateRunStatus(runId, 'PASSED');
      const run = await this.prisma.testRun.findUnique({ where: { id: runId }, include: { report: true } });
      this.ws.emitRunCompleted(projectId, runId, { summary: run?.summary });

      logger.info('Run completed', { runId });
    } catch (error: any) {
      logger.error('Run failed', { runId, error: error.message });
      await this.updateRunStatus(runId, 'FAILED');
      this.ws.emitRunUpdate(runId, { status: 'failed', error: error.message });
    }
  }

  private async executeStage<T>(
    runId: string,
    stageType: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const stage = await this.prisma.runStage.findFirst({
      where: { runId, type: stageType },
    });

    await this.prisma.runStage.update({
      where: { id: stage!.id },
      data: { status: 'running', startedAt: new Date() },
    });

    this.ws.emitStageUpdate(runId, { stageType, status: 'running' });

    const startTime = Date.now();
    try {
      const result = await fn();
      const durationMs = Date.now() - startTime;

      await this.prisma.runStage.update({
        where: { id: stage!.id },
        data: {
          status: 'passed',
          completedAt: new Date(),
          durationMs,
          result: result as any,
        },
      });

      this.ws.emitStageUpdate(runId, { stageType, status: 'passed', durationMs });
      return result;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      // Extract the real message from axios response body when available
      const msg: string =
        error.response?.data?.message ??
        error.response?.data?.error ??
        error.message ??
        'Unknown error';
      await this.prisma.runStage.update({
        where: { id: stage!.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          durationMs,
          logs: { push: `Error: ${msg}` },
        },
      });
      this.ws.emitStageUpdate(runId, { stageType, status: 'failed', error: msg });
      // Re-throw with enriched message so the run-level catch also shows it
      const enriched = new Error(msg);
      (enriched as any).originalError = error;
      throw enriched;
    }
  }

  private async updateRunStatus(runId: string, status: string) {
    await this.prisma.testRun.update({
      where: { id: runId },
      data: {
        status: status as any,
        ...(status === 'RUNNING' && { startedAt: new Date() }),
        ...(['PASSED', 'FAILED', 'CANCELLED'].includes(status) && { completedAt: new Date() }),
      },
    });
    this.ws.emitRunUpdate(runId, { status });
  }
}
