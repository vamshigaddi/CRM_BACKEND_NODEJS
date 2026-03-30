import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@CurrentUser() user: any, @Query('months') months?: number) {
    return this.dashboardService.getStats(user, months ? Number(months) : undefined);
  }

  @Get('notifications')
  async getNotifications(@CurrentUser() user: any) {
    return this.dashboardService.getNotifications(user);
  }

  @Post('notifications/read')
  async markNotificationsRead(@CurrentUser() user: any) {
    return this.dashboardService.markNotificationsRead(user);
  }
}
