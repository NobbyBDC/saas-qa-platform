import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('runs') private readonly runsQueue: Queue,
  ) {}

  async findAll(organizationId: string) {
    const projects = await this.prisma.project.findMany({
      where: { organizationId, status: { not: 'archived' } },
      orderBy: { updatedAt: 'desc' },
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { stages: true },
        },
      },
    });

    return projects.map((p) => ({
      ...p,
      figmaToken: undefined,   // never expose tokens
      sonarToken: undefined,
      latestRun: p.runs[0] ?? null,
    }));
  }

  async findOne(id: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId },
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { stages: true },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return { ...project, figmaToken: undefined, sonarToken: undefined };
  }

  async create(dto: CreateProjectDto, userId: string, organizationId: string) {
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        previewUrl: dto.previewUrl,
        repositoryUrl: dto.repositoryUrl,
        organizationId,
        createdById: userId,
        settings: {
          autoRunOnPush: false,
          enabledTests: {
            functional: true,
            accessibility: true,
            performance: true,
            security: true,
            codeQuality: true,
          },
          thresholds: {
            accessibilityScore: 85,
            performanceScore: 75,
            securityScore: 90,
            codeQualityRating: 'B',
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto, organizationId: string) {
    await this.findOne(id, organizationId);

    return this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.previewUrl !== undefined && { previewUrl: dto.previewUrl || null }),
        ...(dto.repositoryUrl !== undefined && { repositoryUrl: dto.repositoryUrl || null }),
        ...(dto.defaultBranch !== undefined && { defaultBranch: dto.defaultBranch || 'main' }),
        ...(dto.sonarProjectKey !== undefined && { sonarProjectKey: dto.sonarProjectKey || null }),
        ...(dto.sonarToken !== undefined && { sonarToken: dto.sonarToken || null }),
        ...(dto.settings && { settings: dto.settings as any }),
      },
    });
  }

  async archive(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.project.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  async triggerRun(projectId: string, userId: string, organizationId: string, enabledTestsOverride?: Record<string, boolean>) {
    // Use direct DB query to retain figmaToken (findOne strips it for API safety)
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });
    if (!project) throw new Error('Project not found');

    const run = await this.prisma.testRun.create({
      data: {
        projectId,
        organizationId,
        status: 'QUEUED',
        triggeredBy: 'manual',
        triggeredById: userId,
        stages: {
          create: [
            { type: 'functional', status: 'pending', logs: [] },
            { type: 'accessibility', status: 'pending', logs: [] },
            { type: 'performance', status: 'pending', logs: [] },
            { type: 'security', status: 'pending', logs: [] },
            { type: 'code_quality', status: 'pending', logs: [] },
            { type: 'report_generation', status: 'pending', logs: [] },
          ],
        },
      },
      include: { stages: true },
    });

    // Merge per-request enabledTests override with project settings
    const baseSettings = (project.settings as any) ?? {};
    const mergedSettings = enabledTestsOverride
      ? { ...baseSettings, enabledTests: enabledTestsOverride }
      : baseSettings;

    // Enqueue with all required context
    await this.runsQueue.add(
      'execute-run',
      {
        runId: run.id,
        projectId,
        previewUrl: project.previewUrl,
        repositoryUrl: project.repositoryUrl,
        defaultBranch: project.defaultBranch,
        sonarProjectKey: project.sonarProjectKey,
        sonarToken: project.sonarToken,
        settings: mergedSettings,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return run;
  }
}
