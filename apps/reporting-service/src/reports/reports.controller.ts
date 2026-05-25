import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReportService } from './report.service';

@ApiTags('reports')
@Controller('')
export class ReportsController {
  constructor(private readonly reportService: ReportService) {}

  @ApiOperation({ summary: 'Generate a QA report for a completed run' })
  @Post('generate')
  async generate(@Body() body: any) {
    const data = await this.reportService.generateReport(body);
    return { success: true, data };
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'reporting-service' };
  }
}
