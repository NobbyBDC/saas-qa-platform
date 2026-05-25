import { Controller, Get, Put, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences for the organization' })
  getPreferences(@Req() req: any) {
    return this.notifications.getPreferences(req.user.orgId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  updatePreferences(
    @Req() req: any,
    @Body() body: { prefs: Array<{ channel: string; event: string; enabled: boolean; config?: object }> },
  ) {
    return this.notifications.updatePreferences(req.user.orgId, body.prefs);
  }
}
