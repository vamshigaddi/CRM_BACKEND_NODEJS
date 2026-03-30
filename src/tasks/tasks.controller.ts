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
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TaskStatus, TaskPriority, TaskType } from './schemas/task.schema';
import { CreateTaskDto, UpdateTaskDto } from './dto/create-task.dto';

@Controller('api/v1/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Post()
  async create(@Body() taskData: CreateTaskDto, @CurrentUser() user: any) {
    return this.tasksService.create(taskData, user.tenantId, user._id, user.role);
  }

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('skip') skip?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: TaskStatus,
    @Query('priority') priority?: TaskPriority,
    @Query('taskType') taskType?: TaskType,
    @Query('assignedToMe') assignedToMe?: string,
    @Query('leadId') leadId?: string,
    @Query('dealId') dealId?: string,
  ) {
    return this.tasksService.findAll(
      user.tenantId,
      Number(skip) || 0,
      Number(limit) || 100,
      status,
      priority,
      taskType,
      assignedToMe === 'true',
      user._id,
      leadId,
      dealId,
      user.role,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.findOne(id, user.tenantId, user._id, user.role);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: UpdateTaskDto, @CurrentUser() user: any) {
    return this.tasksService.update(id, updateData, user.tenantId, user._id, user.role);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.remove(id, user.tenantId, user._id, user.role);
  }
}
