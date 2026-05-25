import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { successResponse } from '@qa-platform/shared-utils';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiOperation({ summary: 'List all projects in the organization' })
  @Get()
  async findAll(@Request() req: any) {
    const data = await this.projectsService.findAll(req.user.organizationId);
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Get project by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const data = await this.projectsService.findOne(id, req.user.organizationId);
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Create a new project' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProjectDto, @Request() req: any) {
    const data = await this.projectsService.create(dto, req.user.id, req.user.organizationId);
    return successResponse(data, 'Project created');
  }

  @ApiOperation({ summary: 'Update project settings' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @Request() req: any) {
    const data = await this.projectsService.update(id, dto, req.user.organizationId);
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Archive a project' })
  @Delete(':id')
  async archive(@Param('id') id: string, @Request() req: any) {
    const data = await this.projectsService.archive(id, req.user.organizationId);
    return successResponse(data, 'Project archived');
  }

  @ApiOperation({ summary: 'Trigger a new test run for a project' })
  @Post(':id/runs')
  @HttpCode(HttpStatus.CREATED)
  async triggerRun(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const data = await this.projectsService.triggerRun(
      id, req.user.id, req.user.organizationId, body?.enabledTests,
    );
    return successResponse(data, 'Test run queued');
  }
}
