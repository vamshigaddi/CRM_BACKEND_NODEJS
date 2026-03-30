import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VirtualNumber, VirtualNumberDocument } from './schemas/virtual-number.schema';

@Injectable()
export class TelephonyService {
  constructor(
    @InjectModel(VirtualNumber.name)
    private virtualNumberModel: Model<VirtualNumberDocument>,
  ) {}

  async listNumbers(tenantId: string): Promise<VirtualNumberDocument[]> {
    return this.virtualNumberModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .populate('assignedTo', 'name email')
      .exec();
  }

  async assignNumber(numberId: string, tenantId: string, userId: string | null): Promise<VirtualNumberDocument> {
    const number = await this.virtualNumberModel.findOne({ 
        _id: new Types.ObjectId(numberId), 
        tenantId: new Types.ObjectId(tenantId) 
    });
    
    if (!number) {
      throw new NotFoundException('Virtual number not found or unauthorized');
    }

    if (userId) {
      number.assignedTo = new Types.ObjectId(userId) as any;
    } else {
      (number as any).assignedTo = null;
    }

    const saved = await number.save();
    return saved.populate('assignedTo', 'name email');
  }

  async provisionNumber(tenantId: string, data: Partial<VirtualNumber>): Promise<VirtualNumberDocument> {
    const newNumber = new this.virtualNumberModel({
      ...data,
      tenantId: new Types.ObjectId(tenantId),
    });
    return newNumber.save();
  }
}
