import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DealsService } from './deals.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {  DealStatus } from './schemas/deal.schema';
import { CreateDealDto, UpdateDealDto } from './dto/create-deal.dto';

@Controller('api/v1/deals')
@UseGuards(JwtAuthGuard)
export class DealsController {
  constructor(private dealsService: DealsService) {}

  @Post()
  async create(@Body() dealData: CreateDealDto, @CurrentUser() user: any) {
    console.log('received create deal body', dealData);
    console.log('leadId typeof', typeof dealData.leadId, 'value:', dealData.leadId);
    return this.dealsService.create(dealData, user.tenantId, user._id);
  }

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
    @Query('stage') stage?: string,
    @Query('status') status?: DealStatus,
    @Query('assignedToMe') assignedToMe?: string,
    @Query('leadId') leadId?: string,
  ) {
    return this.dealsService.findAll(
      user.tenantId,
      Number(skip) || 0,
      Number(limit) || 100,
      stage,
      status,
      assignedToMe === 'true',
      user._id,
      user.role,
      leadId,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.dealsService.findOne(id, user.tenantId, user._id, user.role);
  }

  @Get(':id/activities')
  async getActivities(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
  ) {
    return this.dealsService.getActivities(id, user.tenantId, Number(skip) || 0, Number(limit) || 100);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: UpdateDealDto, @CurrentUser() user: any) {
    return this.dealsService.update(id, updateData, user.tenantId, user._id, user.role);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.dealsService.remove(id, user.tenantId, user._id, user.role);
  }
}
