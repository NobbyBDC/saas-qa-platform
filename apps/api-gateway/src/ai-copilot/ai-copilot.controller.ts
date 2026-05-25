import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AiCopilotService } from './ai-copilot.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('ai-copilot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-copilot')
export class AiCopilotController {
  constructor(private readonly copilot: AiCopilotService) {}

  @Get('projects/:projectId/suggestions')
  @ApiOperation({ summary: 'Get AI suggestions for a project' })
  getSuggestions(@Param('projectId') projectId: string) {
    return this.copilot.getSuggestions(projectId);
  }

  @Post('issues/:issueId/analyze')
  @ApiOperation({ summary: 'Analyze an issue and generate an AI fix' })
  analyzeIssue(@Param('issueId') issueId: string, @Req() req: any) {
    return this.copilot.analyzeAndSuggestFix(issueId, req.user.sub);
  }

  @Post('actions/:actionId/apply')
  @ApiOperation({ summary: 'Apply an AI-generated fix patch' })
  applyFix(@Param('actionId') actionId: string, @Req() req: any) {
    return this.copilot.applyFix(actionId, req.user.sub);
  }

  @Post('runs/:runId/self-heal')
  @ApiOperation({ summary: 'Trigger self-healing for a failed pipeline run' })
  selfHeal(@Param('runId') runId: string) {
    return this.copilot.selfHealPipeline(runId);
  }

  @Get('actions/:actionId')
  @ApiOperation({ summary: 'Get AI action status and output' })
  getAction(@Param('actionId') actionId: string) {
    return this.copilot.getActionStatus(actionId);
  }
}
