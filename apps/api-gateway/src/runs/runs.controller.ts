import { Controller, Get, Post, Param, Query, Request, Response, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RunsService } from './runs.service';
import { successResponse } from '@qa-platform/shared-utils';

@ApiTags('runs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @ApiOperation({ summary: 'List all runs across all projects' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get()
  async findAll(@Request() req: any, @Query('page') page = 1, @Query('limit') limit = 20) {
    const { runs, meta } = await this.runsService.findAll(req.user.organizationId, +page, +limit);
    return successResponse(runs, undefined, meta);
  }

  @ApiOperation({ summary: 'Get a specific run with stages and issues' })
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const data = await this.runsService.findOne(id, req.user.organizationId);
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Serve the HTML QA report for a run' })
  @Get(':id/report')
  async getReport(@Param('id') id: string, @Request() req: any, @Response() res: any) {
    const html = await this.runsService.getReportHtml(id, req.user.organizationId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @ApiOperation({ summary: 'Cancel a queued or running test run' })
  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Request() req: any) {
    const data = await this.runsService.cancelRun(id, req.user.organizationId);
    return successResponse(data, 'Run cancelled');
  }
}
