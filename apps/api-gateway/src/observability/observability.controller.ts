import { Controller, Get, Param, Query, Req, UseGuards, Res, Header } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response } from 'express';

@ApiTags('observability')
@Controller('observability')
export class ObservabilityController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async prometheusMetrics(@Res() res: Response) {
    const data = await this.metrics.getPrometheusMetrics();
    res.send(data);
  }

  @Get('dashboard')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get organization-level metrics for the observability dashboard' })
  getDashboard(@Req() req: any, @Query('days') days?: string) {
    return this.metrics.getDashboardMetrics(req.user.orgId, days ? parseInt(days) : 30);
  }

  @Get('projects/:projectId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get project-level run metrics' })
  getProjectMetrics(@Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.metrics.getProjectMetrics(projectId, days ? parseInt(days) : 7);
  }
}
