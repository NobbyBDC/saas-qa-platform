import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CodegenService } from './codegen.service';
import { StorageService } from './storage.service';

@ApiTags('codegen')
@Controller('')
export class CodegenController {
  constructor(
    private readonly codegenService: CodegenService,
    private readonly storage: StorageService,
  ) {}

  @ApiOperation({ summary: 'Generate React code from Figma design schema' })
  @Post('generate')
  async generate(@Body() body: any) {
    const data = await this.codegenService.generateProject(body);
    return { success: true, data };
  }

  @ApiOperation({ summary: 'Store generated project artifact and return preview URL' })
  @Post('deploy')
  async deploy(@Body() body: any) {
    const { runId, projectId, generatedProject, previewUrl } = body;

    // Store generated code as artifact in MinIO for reference
    try {
      await this.storage.uploadJson(
        `runs/${runId}/generated-project.json`,
        generatedProject,
      );
    } catch {
      // Non-fatal — pipeline continues even if artifact storage fails
    }

    // Return the project's configured previewUrl if present, otherwise null.
    // Downstream tests handle a null previewUrl by skipping URL-dependent checks.
    return {
      success: true,
      data: {
        previewUrl: previewUrl ?? null,
        projectId,
        runId,
        deployed: false,
        message: previewUrl
          ? 'Using project preview URL for testing'
          : 'No preview URL configured — URL-based tests will be skipped',
      },
    };
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'codegen-service' };
  }
}
