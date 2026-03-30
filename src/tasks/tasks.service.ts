import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument, TaskPriority, TaskStatus, TaskType } from './schemas/task.schema';

@Injectable()
export class TasksService {
  constructor(@InjectModel(Task.name) private taskModel: Model<TaskDocument>) {}

  async create(taskData: any, tenantId: string, userId: string, userRole: string) {
    if (userRole === 'SALES' && taskData.assignedTo && taskData.assignedTo !== userId) {
      throw new Error('Sales executives can only assign tasks to themselves');
    }
    const data = {
      ...taskData,
      tenantId: new Types.ObjectId(tenantId),
      createdBy: new Types.ObjectId(userId),
    };
    if (!data.assignedTo) {
      data.assignedTo = new Types.ObjectId(userId);
    }
    const task = new this.taskModel(data);
    return task.save();
  }
  async findAll(
    tenantId: string,
    skip = 0,
    limit = 100,
    status?: TaskStatus,
    priority?: TaskPriority,
    taskType?: TaskType,
    assignedToMe?: boolean,
    userId?: string,
    leadId?: string,
    dealId?: string,
    userRole?: string,
  ) {
    const query: any = { tenantId: new Types.ObjectId(tenantId), isDeleted: false };

    if (userRole === 'SALES') {
      query.assignedTo = new Types.ObjectId(userId);
    } else if (assignedToMe) {
      query.assignedTo = new Types.ObjectId(userId);
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (taskType) query.taskType = taskType;
    if (leadId) query.leadId = new Types.ObjectId(leadId);
    if (dealId) query.dealId = new Types.ObjectId(dealId);

    return this.taskModel
      .find(query)
      .populate('tenantId')
      .populate('createdBy')
      .populate('leadId')
      .populate('dealId')
      .populate('assignedTo')
      .skip(skip)
      .limit(limit)
      .sort({ dueDate: 1 })
      .exec();
  }

  async findOne(id: string, tenantId: string, userId?: string, userRole?: string) {
    const query: any = { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), isDeleted: false };
    if (userRole === 'SALES') {
      query.assignedTo = new Types.ObjectId(userId);
    }
    const task = await this.taskModel.findOne(query)
      .populate('tenantId')
      .populate('createdBy')
      .populate('leadId')
      .populate('dealId')
      .populate('assignedTo')
      .exec();
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(id: string, updateData: any, tenantId: string, userId?: string, userRole?: string) {
    const query: any = { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), isDeleted: false };
    if (userRole === 'SALES') {
      query.assignedTo = new Types.ObjectId(userId);
      if (updateData.assignedTo && updateData.assignedTo !== userId) {
        throw new Error('Sales executives can only assign tasks to themselves');
      }
    }
    if (updateData.status === TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }
    const task = await this.taskModel
      .findOneAndUpdate(query, updateData, { new: true })
      .exec();

    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async remove(id: string, tenantId: string, userId?: string, userRole?: string) {
    const query: any = { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), isDeleted: false };
    if (userRole === 'SALES') {
      query.assignedTo = new Types.ObjectId(userId);
    }
    const task = await this.taskModel.findOne(query).exec();
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    task.isDeleted = true;
    return task.save();
  }
}
