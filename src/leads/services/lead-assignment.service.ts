import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Lead, LeadDocument, LeadStatus } from '../schemas/lead.schema';

@Injectable()
export class LeadAssignmentService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
  ) {}

  async getSmartAssignment(tenantId: string): Promise<Types.ObjectId | null> {
    const availableUsers = await this.userModel.find({
      tenantId: new Types.ObjectId(tenantId),
      isAvailable: { $ne: false },
      isActive: { $ne: false },
      isDeleted: false,
    } as any).exec();

    if (!availableUsers.length) {
      return null;
    }

    const userWorkloads = await Promise.all(
      availableUsers.map(async (user) => {
        const openLeadsCount = await this.leadModel.countDocuments({
          tenantId: new Types.ObjectId(tenantId),
          assignedTo: user._id,
          status: LeadStatus.OPEN,
          isDeleted: false,
        } as any).exec();

        return {
          userId: user._id as Types.ObjectId,
          workload: openLeadsCount,
          lastAssigned: user.lastAssignedAt || new Date(0),
        };
      }),
    );

    // Sort by workload (ASC), then by lastAssigned (ASC)
    userWorkloads.sort((a, b) => {
      if (a.workload !== b.workload) {
        return a.workload - b.workload;
      }
      return a.lastAssigned.getTime() - b.lastAssigned.getTime();
    });

    const bestUserId = userWorkloads[0].userId;

    // Update the user's lastAssignedAt timestamp
    await this.userModel.findOneAndUpdate({ _id: bestUserId, isDeleted: false }, {
      lastAssignedAt: new Date(),
    }).exec();

    return bestUserId;
  }
}
