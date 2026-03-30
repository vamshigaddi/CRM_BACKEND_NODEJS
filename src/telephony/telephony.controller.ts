import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { TelephonyService } from './telephony.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { Request } from 'express';

@Controller('telephony')
@UseGuards(JwtAuthGuard)
export class TelephonyController {
  constructor(private readonly telephonyService: TelephonyService) {}

  @Get('numbers')
  async listNumbers(@Req() req: Request) {
    return this.telephonyService.listNumbers((req.user as any).tenantId);
  }

  @Put('numbers/:id/assign')
  async assignNumber(
    @Param('id') id: string,
    @Body('userId') userId: string | null,
    @Req() req: Request,
  ) {
    return this.telephonyService.assignNumber(id, (req.user as any).tenantId, userId);
  }

  @Post('numbers/provision')
  async provisionNumber(@Body() data: any, @Req() req: Request) {
    return this.telephonyService.provisionNumber((req.user as any).tenantId, data);
  }
}
