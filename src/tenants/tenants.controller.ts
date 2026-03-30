import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTenantDto, UpdateTenantDto, OnboardingDto } from './dto/create-tenant.dto';

@Controller('api/v1/tenants')
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Post('onboarding')
  async onboarding(@Body() data: OnboardingDto) {
    console.log("data",data)
    return this.tenantsService.onboarding(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUser() user: any, @Query('skip') skip?: number, @Query('limit') limit?: number) {
    // Users can only see their own tenant in this list (simplified logic from Python)
    return this.tenantsService.findAll(user.tenantId.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: any) {
    // Return the single tenant for the authenticated user's token
    return this.tenantsService.findOne(user.tenantId.toString());
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    if (id !== user.tenantId.toString()) {
      throw new ForbiddenException('Access denied');
    }
    return this.tenantsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto, @CurrentUser() user: any) {
    if (id !== user.tenantId.toString() || user.role !== 'ADMIN') {
      throw new ForbiddenException('Access denied');
    }
    return this.tenantsService.update(id, updateTenantDto);
  }
}
