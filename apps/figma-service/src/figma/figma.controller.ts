import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FigmaService } from './figma.service';

@ApiTags('figma')
@Controller('parse')
export class FigmaController {
  constructor(private readonly figmaService: FigmaService) {}

  @ApiOperation({ summary: 'Parse a Figma file and extract design schema' })
  @Post()
  async parseFile(@Body() body: any) {
    const schema = await this.figmaService.parseFile(body);
    return { success: true, data: schema };
  }

  @ApiOperation({ summary: 'Health check' })
  @Get('health')
  health() {
    return { status: 'ok', service: 'figma-service' };
  }
}
