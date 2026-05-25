import { Controller, Post, Req, Headers, HttpCode, HttpStatus, Logger, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { GitHubService } from './github.service';
import { GitHubOAuthService } from './github-oauth.service';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

@Controller('github/webhook')
export class GitHubWebhookController {
  private readonly logger = new Logger(GitHubWebhookController.name);

  constructor(
    private readonly github: GitHubService,
    private readonly oauth: GitHubOAuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-github-event') event: string,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-delivery') delivery: string,
  ) {
    const rawBody = (req as any).rawBody as Buffer;
    if (!rawBody) return { error: 'No raw body' };

    // Find organization by repo URL match — we need to locate the right integration
    const payload = JSON.parse(rawBody.toString());
    const repoFullName = payload?.repository?.full_name;
    if (!repoFullName) return { skipped: true };

    const project = await this.prisma.project.findFirst({
      where: { repositoryUrl: { contains: repoFullName } },
      select: { organizationId: true },
    });
    if (!project) return { skipped: true, reason: 'no matching project' };

    const integration = await this.prisma.gitHubIntegration.findUnique({
      where: { organizationId: project.organizationId },
    });
    if (!integration?.isActive) return { skipped: true };

    const valid = this.oauth.verifyWebhookSignature(rawBody, signature, integration.webhookSecret);
    if (!valid) throw new UnauthorizedException('Invalid webhook signature');

    this.logger.log(`GitHub webhook: ${event} [${delivery}] for ${repoFullName}`);

    switch (event) {
      case 'push':
        return this.github.handlePushEvent(project.organizationId, payload);
      case 'pull_request':
        return this.github.handlePullRequestEvent(project.organizationId, payload);
      default:
        return { skipped: true, event };
    }
  }
}
