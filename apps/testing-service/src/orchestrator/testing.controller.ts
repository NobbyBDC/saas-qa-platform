import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AccessibilityService } from '../accessibility/accessibility.service';
import { PerformanceService } from '../performance/performance.service';
import { FunctionalTestingService } from '../functional/functional-testing.service';

@ApiTags('testing')
@Controller('')
export class TestingController {
  constructor(
    private readonly accessibility: AccessibilityService,
    private readonly performance: PerformanceService,
    private readonly functional: FunctionalTestingService,
  ) {}

  @ApiOperation({ summary: 'Run accessibility tests' })
  @Post('accessibility')
  async runAccessibility(@Body() body: any) {
    const data = await this.accessibility.runTests(body);
    return { success: true, data };
  }

  @ApiOperation({ summary: 'Run performance tests (Lighthouse)' })
  @Post('performance')
  async runPerformance(@Body() body: any) {
    const data = await this.performance.runTests(body);
    return { success: true, data };
  }

  @ApiOperation({ summary: 'Run functional tests (Playwright)' })
  @Post('functional')
  async runFunctional(@Body() body: any) {
    const data = await this.functional.runTests(body);
    return { success: true, data };
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'testing-service' };
  }
}
