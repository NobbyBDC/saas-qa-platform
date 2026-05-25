import {
  Controller, Get, Put, Delete, Post, Param, Query, Body,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Platform stats ────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Platform-wide statistics' })
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  // ── Organizations ────────────────────────────────────────────────────────

  @Get('organizations')
  @ApiOperation({ summary: 'List all organizations' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  listOrganizations(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.adminService.listOrganizations(+page, +limit, search);
  }

  @Get('organizations/:id')
  @ApiOperation({ summary: 'Get organization detail' })
  getOrganization(@Param('id') id: string) {
    return this.adminService.getOrganization(id);
  }

  @Put('organizations/:id/plan')
  @ApiOperation({ summary: 'Override plan and limits for an organization' })
  updateOrganizationPlan(
    @Param('id') id: string,
    @Body() body: {
      plan: string;
      projectsLimit?: number;
      runsPerMonth?: number;
      storageGb?: number;
      apiAccessEnabled?: boolean;
      ssoEnabled?: boolean;
    },
  ) {
    const { plan, ...overrides } = body;
    return this.adminService.updateOrganizationPlan(id, plan, overrides);
  }

  @Put('organizations/:id/suspend')
  @ApiOperation({ summary: 'Suspend an organization' })
  suspendOrganization(@Param('id') id: string) {
    return this.adminService.suspendOrganization(id);
  }

  @Delete('organizations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete an organization and all its data' })
  deleteOrganization(@Param('id') id: string) {
    return this.adminService.deleteOrganization(id);
  }

  // ── Users ────────────────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List all users across all organizations' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  listUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers(+page, +limit, search);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // ── Runs ─────────────────────────────────────────────────────────────────

  @Get('runs')
  @ApiOperation({ summary: 'List all test runs across all organizations' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listRuns(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.listRuns(+page, +limit);
  }

  // ── Impersonation ────────────────────────────────────────────────────────

  @Post('organizations/:id/impersonate')
  @ApiOperation({
    summary: 'Issue a 1-hour token scoped to a specific organization',
    description: 'Returns an access token that behaves as the org owner. All actions appear as that user. Audit logged.',
  })
  impersonate(
    @Param('id') organizationId: string,
    @Body('requestingAdminId') requestingAdminId: string,
  ) {
    return this.adminService.impersonate(organizationId, requestingAdminId);
  }
}
