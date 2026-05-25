import { Controller, Get, Post, Body, Query, Req, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GitHubService } from './github.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response } from 'express';

@ApiTags('integrations/github')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations/github')
export class GitHubController {
  constructor(private readonly github: GitHubService) {}

  @Get('auth')
  @ApiOperation({ summary: 'Get GitHub OAuth authorization URL' })
  getAuthUrl(@Req() req: any) {
    const url = this.github.getAuthUrl(req.user.orgId);
    return { url };
  }

  @Get('callback')
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    await this.github.handleCallback(code, state, req.user.sub);
    res.redirect('/dashboard/integrations?github=connected');
  }

  @Post('disconnect')
  @ApiOperation({ summary: 'Disconnect GitHub integration' })
  disconnect(@Req() req: any) {
    return this.github.disconnect(req.user.orgId, req.user.sub);
  }

  @Get('repos')
  @ApiOperation({ summary: 'List accessible GitHub repositories' })
  listRepos(@Req() req: any) {
    return this.github.listRepos(req.user.orgId);
  }

  @Post('repos/connect')
  @ApiOperation({ summary: 'Connect a GitHub repo and install webhook' })
  connectRepo(@Req() req: any, @Body() body: { repoFullName: string }) {
    const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001/api';
    return this.github.connectRepo(req.user.orgId, body.repoFullName, baseUrl);
  }
}
