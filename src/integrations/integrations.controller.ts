import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Body, 
  Param, 
  UseGuards, 
  ForbiddenException, 
  UnauthorizedException 
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { IntegrationType } from './schemas/integrations.schema';
import { SaveIntegrationDto, PingIntegrationDto } from './dto/integration.dto';

@Controller('api/v1/integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    if (!user?.tenantId) throw new UnauthorizedException();
    return this.integrationsService.findAllByTenant(user.tenantId);
  }

  @Get(':type')
  async findOne(@Param('type') type: IntegrationType, @CurrentUser() user: any) {
    if (!user?.tenantId) throw new UnauthorizedException();
    return this.integrationsService.findOneByTenant(user.tenantId, type);
  }

  @Post()
  async save(@Body() dto: SaveIntegrationDto, @CurrentUser() user: any) {
    if (!user?.tenantId) throw new UnauthorizedException();
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can manage integrations');
    }
    return this.integrationsService.upsert(user.tenantId, dto);
  }

  // ─── Ping / Test connection ────────────────────────────────────────────────
  @Post('ping')
  async ping(@Body() dto: PingIntegrationDto, @CurrentUser() user: any) {
    if (!user?.tenantId) throw new UnauthorizedException();
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can test integrations');
    }
    return this.integrationsService.ping(dto);
  }

  @Delete(':type')
  async remove(@Param('type') type: IntegrationType, @CurrentUser() user: any) {
    if (!user?.tenantId) throw new UnauthorizedException();
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can manage integrations');
    }
    return this.integrationsService.remove(user.tenantId, type);
  }
}
