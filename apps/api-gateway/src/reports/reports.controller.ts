import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { successResponse } from '@qa-platform/shared-utils';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Get report for a specific run' })
  @Get('runs/:runId')
  async findByRun(@Param('runId') runId: string, @Request() req: any) {
    const data = await this.reportsService.findByRun(runId, req.user.organizationId);
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Get reports for a project' })
  @Get('projects/:projectId')
  async findByProject(@Param('projectId') projectId: string, @Request() req: any) {
    const data = await this.reportsService.findByProject(projectId, req.user.organizationId);
    return successResponse(data);
  }
}
