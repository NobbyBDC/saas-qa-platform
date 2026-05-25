import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SecurityScannerService } from './security-scanner.service';
import { CodeQualityService } from './code-quality.service';

@ApiTags('security')
@Controller('')
export class SecurityController {
  constructor(
    private readonly scanner: SecurityScannerService,
    private readonly codeQuality: CodeQualityService,
  ) {}

  @ApiOperation({ summary: 'Run OWASP ZAP security scan' })
  @Post('scan')
  async scan(@Body() body: any) {
    const data = await this.scanner.runScan(body);
    return { success: true, data };
  }

  @ApiOperation({ summary: 'Run code quality analysis' })
  @Post('code-quality')
  async codeQualityScan(@Body() body: any) {
    const data = await this.codeQuality.runAnalysis(body);
    return { success: true, data };
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'security-service' };
  }
}
