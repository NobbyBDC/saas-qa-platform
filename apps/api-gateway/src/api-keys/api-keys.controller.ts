import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List API keys for the organization' })
  list(@Req() req: any) {
    return this.apiKeys.list(req.user.orgId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new API key' })
  create(
    @Req() req: any,
    @Body() body: { name: string; scopes: string[]; projectId?: string; expiresAt?: string },
  ) {
    return this.apiKeys.create({
      organizationId: req.user.orgId,
      createdById: req.user.sub,
      name: body.name,
      scopes: body.scopes,
      projectId: body.projectId,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key' })
  revoke(@Param('id') id: string, @Req() req: any) {
    return this.apiKeys.revoke(id, req.user.orgId, req.user.sub);
  }
}
