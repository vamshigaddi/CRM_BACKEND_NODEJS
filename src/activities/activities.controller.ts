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
  ForbiddenException,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ActivityType } from './schemas/activity.schema';
import { CreateActivityDto, UpdateActivityDto } from './dto/create-activity.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { StorageService } from '../common/services/storage.service';

@Controller('api/v1/activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(
    private activitiesService: ActivitiesService,
    private storageService: StorageService,
  ) {}

  @Post('upload-recording')
  @UseInterceptors(FileInterceptor('file'))
  async uploadRecording(
    @UploadedFile() file: Express.Multer.File,
    @Body('leadId') leadId: string,
    @Body('dealId') dealId: string,
    @CurrentUser() user: any,
  ) {
    const url = await this.storageService.uploadFile(file, 'recordings');
    
    // Create activity record
    const activity = await this.activitiesService.create({
      type: ActivityType.CALL,
      leadId,
      dealId,
      content: `Call recording uploaded: ${file.originalname}`,
      meta: {
        recordingUrl: url,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      },
    }, user.tenantId, user._id);

    return {
      success: true,
      url,
      activityId: activity._id,
    };
  }

  @Post(':id/analyze')
  async analyzeRecording(
    @Param('id') id: string, 
    @CurrentUser() user: any,
    @Body() payload: { transcript?: string, current_stage?: string, allowed_stages?: string[] }
  ) {
    return this.activitiesService.analyzeRecording(id, user.tenantId, payload);
  }

  @Post()
  async create(@Body() activityData: CreateActivityDto, @CurrentUser() user: any) {
    return this.activitiesService.create(activityData, user.tenantId, user._id);
  }

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: ActivityType,
    @Query('leadId') leadId?: string,
    @Query('dealId') dealId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.activitiesService.findAll(
      user.tenantId,
      Number(skip) || 0,
      Number(limit) || 100,
      type,
      leadId,
      dealId,
      userId,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.activitiesService.findOne(id, user.tenantId);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: UpdateActivityDto, @CurrentUser() user: any) {
    try {
      return await this.activitiesService.update(id, updateData, user.tenantId, user._id.toString());
    } catch (e) {
      throw new ForbiddenException(e.message);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    try {
      return await this.activitiesService.remove(id, user.tenantId, user._id.toString());
    } catch (e) {
      throw new ForbiddenException(e.message);
    }
  }
}
