import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Deal, DealDocument,  DealStatus } from './schemas/deal.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Tenant } from '../tenants/schemas/tenant.schema';
import { ActivitiesService } from '../activities/activities.service';
import { ActivityType } from '../activities/schemas/activity.schema';
import { Activity, ActivityDocument } from '../activities/schemas/activity.schema';

@Injectable()
export class DealsService {
  constructor(
    @InjectModel(Deal.name) private dealModel: Model<DealDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
    private activitiesService: ActivitiesService,
  ) {}

  async create(dealData: any, tenantId: string, userId: string) {
    const data: any = {
      ...dealData,
      tenantId: new Types.ObjectId(tenantId),
      createdBy: new Types.ObjectId(userId),
    };

    // if status comes in as WON but stage isn't provided, auto-set stage so frontend
    // pipeline reflects closing stage immediately
    if (data.status === DealStatus.WON && !data.stage) {
      data.stage = 'WON';
    }

    // If no owner is explicitly chosen, inherit from the lead's assignee
    if (!data.assignedTo && data.leadId) {
      const lead = await this.leadModel
        .findOne({
          _id: new Types.ObjectId(data.leadId),
          tenantId: new Types.ObjectId(tenantId),
        } as any)
        .select('assignedTo')
        .exec();

      if (lead?.assignedTo) {
        data.assignedTo = lead.assignedTo;
      }
    }
    const deal = new this.dealModel(data);
    await deal.save();
    
    // Log creation activity with actor name
    const actorForCreate = await this.userModel.findById(userId).select('name email').lean().exec() as any;
    const actorNameCreate = actorForCreate?.name || actorForCreate?.email || 'Someone';
    await this.activitiesService.create({
      type: ActivityType.SYSTEM,
      leadId: deal.leadId,
      dealId: deal._id,
      content: `${actorNameCreate} created deal "${deal.title}" — ₹${deal.value || 0}`,
      activity_time: new Date(),
    }, tenantId, userId);

    return deal.populate(['leadId', 'assignedTo']);
  }

  async findAll(
    tenantId: string,
    skip = 0,
    limit = 100,
    stage?: string,
    status?: DealStatus,
    assignedToMe?: boolean,
    userId?: string,
    userRole?: string,
    leadId?: string,
  ) {
    const query: any = { tenantId: new Types.ObjectId(tenantId), isDeleted: false };

    if (userRole === 'SALES') {
      query.assignedTo = new Types.ObjectId(userId);
    } else if (assignedToMe) {
      query.assignedTo = new Types.ObjectId(userId);
    }

    if (stage) query.stage = stage;
    if (status) query.status = status;
    if (leadId) query.leadId = new Types.ObjectId(leadId);

    // tenantId field is already known from the request context; no need to
    // populate it on every deal.  this keeps payloads smaller and avoids
    // sending the whole tenant document back to the client.
    return this.dealModel
      .find(query)
      // .populate('tenantId')
      .populate('leadId')
      .populate('assignedTo')
      .populate('createdBy')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string, tenantId: string, userId?: string, userRole?: string) {
    const query: any = { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), isDeleted: false };
    if (userRole === 'SALES') {
      query.assignedTo = new Types.ObjectId(userId);
    }
    const deal = await this.dealModel.findOne(query)
      // .populate('tenantId')
      .populate('leadId')
      .populate('assignedTo')
      .populate('createdBy')
      .exec();
    if (!deal) {
      throw new NotFoundException('Deal not found');
    }
    return deal;
  }

  async update(id: string, updateData: any, tenantId: string, userId: string, userRole?: string) {
    const query: any = { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), isDeleted: false };
    if (userRole === 'SALES') {
      query.assignedTo = new Types.ObjectId(userId);
    }
    const oldDeal = await this.dealModel.findOne(query).exec();
    if (!oldDeal) {
      throw new NotFoundException('Deal not found');
    }

    // if marking won and stage not already set to won, force stage update so
    // frontend displays correctly and pipeline stats reflect closing stage
    if (updateData.status === DealStatus.WON && !updateData.stage) {
      updateData.stage = 'WON';
    }

    const deal = await this.dealModel
      .findOneAndUpdate({ _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) } as any, updateData, { new: true })
      .exec();

    if (deal) {
      // Handle closing timestamp
      if (updateData.status && updateData.status !== oldDeal.status) {
        if (updateData.status !== DealStatus.OPEN && !deal.closedAt) {
          await this.dealModel.updateOne({ _id: deal._id }, { closedAt: new Date() });
        } else if (updateData.status === DealStatus.OPEN) {
          await this.dealModel.updateOne({ _id: deal._id }, { closedAt: null });
        }
      }

      const actorUser = await this.userModel.findById(userId).select('name email').lean().exec() as any;
      const actorName = actorUser?.name || actorUser?.email || 'Someone';

      // Build stage name lookup map for this tenant
      const tenantDoc = await this.tenantModel.findById(tenantId).select('pipelineStages').lean().exec() as any;
      const stageNameMap = new Map<string, string>();
      if (tenantDoc?.pipelineStages) {
        for (const s of tenantDoc.pipelineStages) {
          if (s.id) stageNameMap.set(s.id, s.name);
          stageNameMap.set(s.name, s.name);
        }
      }
      const resolveStageName = (stageId: string) => stageNameMap.get(stageId) || stageId;

      let content = ``;
      const changes: string[] = [];
      if (updateData.title && updateData.title !== oldDeal.title) {
        changes.push(`renamed to "${updateData.title}"`);
      }
      if (updateData.stage && updateData.stage !== oldDeal.stage) {
        const toStage = resolveStageName(updateData.stage);
        changes.push(`moved deal "${deal?.title || ''}" → ${toStage}`);
      }
      if (updateData.status && updateData.status !== oldDeal.status) {
        const statusVerb = updateData.status === 'WON' ? 'marked deal WON 🎉' : updateData.status === 'LOST' ? 'marked deal LOST' : `changed status to ${updateData.status}`;
        changes.push(statusVerb);
      }
      if (updateData.value !== undefined && Number(updateData.value) !== oldDeal.value) {
        changes.push(`updated value to ₹${updateData.value}`);
      }
      if (updateData.probability !== undefined && Number(updateData.probability) !== oldDeal.probability) {
        changes.push(`set probability to ${updateData.probability}%`);
      }
      if (updateData.assignedTo && updateData.assignedTo.toString() !== oldDeal.assignedTo?.toString()) {
        changes.push(`reassigned deal`);
      }
      if (updateData.reason) {
        changes.push(`reason: ${updateData.reason}`);
      }
      if (updateData.note) {
        changes.push(`note: ${updateData.note}`);
      }

      if (changes.length > 0) {
        content = `${actorName} ${changes.join('; ')}`;
        await this.activitiesService.create(
          {
            type: updateData.stage ? ActivityType.STAGE_CHANGE : ActivityType.SYSTEM,
            leadId: deal.leadId,
            dealId: deal._id,
            content: content,
            activity_time: new Date(),
          },
          tenantId,
          userId,
        );
      }
    }
    return deal;
  }

  async remove(id: string, tenantId: string, userId: string, userRole?: string) {
    const query: any = { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), isDeleted: false };
    if (userRole === 'SALES') {
      query.assignedTo = new Types.ObjectId(userId);
    }
    const deal = await this.dealModel.findOne(query).exec();
    if (!deal) {
      throw new NotFoundException('Deal not found');
    }
    deal.isDeleted = true;
    return deal.save();
  }

  async getActivities(dealId: string, tenantId: string, skip = 0, limit = 100) {
    // build a properly typed filter to keep TypeScript happy with mongoose overloads
    const filter: any = {
      dealId: new Types.ObjectId(dealId),
      tenantId: new Types.ObjectId(tenantId),
    };

    return this.activityModel
      .find(filter)
      .populate('userId')
      .populate('leadId')
      .skip(skip)
      .limit(limit)
      .sort({ activityTime: -1 })
      .exec();
  }
}
