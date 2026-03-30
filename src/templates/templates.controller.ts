import { 
  Controller, 
  Get, 
  UseGuards, 
  UnauthorizedException 
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  async getTemplates(@CurrentUser() user: any) {
    if (!user?.tenantId) throw new UnauthorizedException();
    return this.templatesService.getTenantTemplates(user.tenantId);
  }
}
