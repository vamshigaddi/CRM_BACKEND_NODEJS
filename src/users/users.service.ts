import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Deal, DealDocument } from '../deals/schemas/deal.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Deal.name) private dealModel: Model<DealDocument>,
  ) {}

  async create(userData: any, tenantId: string) {
    const existing = await this.userModel.findOne({ email: userData.email, isDeleted: false });
    if (existing) {
      throw new BadRequestException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = new this.userModel({
      ...userData,
      password: hashedPassword,
      tenantId: tenantId,
    });

    return user.save();
  }

  async findAll(tenantId: string, role?: string, skip = 0, limit = 100) {
    const query: any = { tenantId, isDeleted: false };
    if (role) {
      query.role = role;
    }
    return this.userModel.find(query)
      .populate('tenantId')
      .populate('reportingTo')
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.userModel.findOne({ _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), isDeleted: false } as any)
      .populate('tenantId')
      .populate('reportingTo')
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, updateData: any, tenantId: string) {
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    const user = await this.userModel
      .findOneAndUpdate({ _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), isDeleted: false } as any, updateData, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async remove(id: string, tenantId: string) {
    const userId = new Types.ObjectId(id);
    const tenantObjectId = new Types.ObjectId(tenantId);

    // Check for lead assignments
    const assignedLeads = await this.leadModel.countDocuments({
      tenantId: tenantObjectId,
      assignedTo: userId,
    } as any);
    if (assignedLeads > 0) {
      throw new BadRequestException(`Cannot delete user: ${assignedLeads} leads are currently assigned to them. Reassign them first.`);
    }

    // Check for deal assignments
    const assignedDeals = await this.dealModel.countDocuments({
      tenantId: tenantObjectId,
      assignedTo: userId,
    } as any);
    if (assignedDeals > 0) {
      throw new BadRequestException(`Cannot delete user: ${assignedDeals} deals are currently assigned to them. Reassign them first.`);
    }

    const user = await this.userModel.findOne({ _id: userId, tenantId: tenantObjectId, isDeleted: false } as any).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.isDeleted = true;
    user.isActive = false;
    await user.save();
    return { message: 'User deleted successfully' };
  }
}
