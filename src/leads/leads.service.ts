import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument, LeadStatus } from './schemas/lead.schema';
import { Deal, DealDocument } from '../deals/schemas/deal.schema';
import { Tenant } from '../tenants/schemas/tenant.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LeadScoringService } from './services/lead-scoring.service';
import { LeadAssignmentService } from './services/lead-assignment.service';
import { ActivitiesService } from '../activities/activities.service';
import { ActivityType } from '../activities/schemas/activity.schema';
import { IntegrationsService } from '../integrations/integrations.service';

@Injectable()
export class LeadsService {
  constructor(
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Deal.name) private dealModel: Model<DealDocument>,
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private leadScoringService: LeadScoringService,
    private leadAssignmentService: LeadAssignmentService,
    private activitiesService: ActivitiesService,
    private integrationsService: IntegrationsService,
  ) {}

  async create(leadData: any, tenantId: string, userId: string, userRole?: string) {
    const data = {
      ...leadData,
      tenantId: new Types.ObjectId(tenantId),
      createdBy: new Types.ObjectId(userId),
    };

    // 1. Lead Scoring
    if (data.leadScore === undefined || data.leadScore === null) {
      data.leadScore = this.leadScoringService.calculateLeadScore(data);
    }

    // 2. Smart Assignment / Role-based default
    if (userRole === 'SALES') {
      data.assignedTo = new Types.ObjectId(userId);
      data.assignedBy = new Types.ObjectId(userId);
    } else if (!data.assignedTo) {
      const assignedToId = await this.leadAssignmentService.getSmartAssignment(tenantId);
      if (assignedToId) {
        data.assignedTo = assignedToId;
        data.assignedBy = new Types.ObjectId(userId);
      }
    }

    data.lastActivityAt = new Date();

    const lead = new this.leadModel(data);
    const savedLead = await lead.save();

    // Create initial activity — use the actor's name in the content
    const actorUser = await this.userModel.findById(userId).select('name email').lean().exec() as any;
    const actorName = actorUser?.name || actorUser?.email || 'A user';
    const leadIdentifier = savedLead.name || savedLead.email || savedLead.phoneNumber || 'a lead';
    await this.activitiesService.create({
      type: ActivityType.SYSTEM,
      leadId: savedLead._id,
      content: `${actorName} created lead "${leadIdentifier}"`,
      activity_time: new Date(),
    }, tenantId, userId);

    if (savedLead.hasWhatsapp && savedLead.phoneNumber) {
      await this.integrationsService.createConversation(
        tenantId,
        savedLead._id.toString(),
        data.assignedTo?.toString() || userId
      );
    }

    return savedLead;
  }

  async findAll(
    tenantId: string,
    skip = 0,
    limit = 100,
    status?: LeadStatus,
    assignedToMe?: boolean,
    userId?: string,
    search?: string,
    userRole?: string,
  ) {
    const query: any = { tenantId: new Types.ObjectId(tenantId), isDeleted: false };

    if (userRole === 'SALES') {
      query.assignedTo = new Types.ObjectId(userId);
    } else if (assignedToMe) {
      query.assignedTo = new Types.ObjectId(userId);
    }

    if (status) query.status = status;

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { 'company.name': searchRegex },
        { organization: searchRegex },
      ];
    }

    const leads = await this.leadModel
      .find(query)
      .populate('tenantId')
      .populate('assignedTo')
      .populate('assignedBy')
      .populate('createdBy')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    // Attach latest deal status and stage per lead (if any)
    const leadIds = leads.map((l) => l._id);
    if (leadIds.length === 0) {
      return leads;
    }

    const deals = await this.dealModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        leadId: { $in: leadIds },
      } as any)
      .select('leadId status stage createdAt')
      .sort({ createdAt: -1 })
      .exec();

    const latestStatusByLead = new Map<string, string>();
    const latestStageByLead = new Map<string, string>();
    for (const deal of deals) {
      const key = deal.leadId.toString();
      if (!latestStatusByLead.has(key)) {
        latestStatusByLead.set(key, deal.status);
      }
      if (!latestStageByLead.has(key)) {
        latestStageByLead.set(key, deal.stage);
      }
    }

    // also compute counts per lead
    const dealCountByLead = new Map<string, number>();
    for (const deal of deals) {
      const key = deal.leadId.toString();
      dealCountByLead.set(key, (dealCountByLead.get(key) || 0) + 1);
    }

    // Build a stage ID → name map from tenant config for display
    const tenantDoc = await this.tenantModel.findById(tenantId).select('pipelineStages').lean().exec() as any;
    const stageNameMap = new Map<string, string>();
    if (tenantDoc?.pipelineStages) {
      for (const s of tenantDoc.pipelineStages) {
        if (s.id) stageNameMap.set(s.id, s.name);
        stageNameMap.set(s.name, s.name); // also map name → name for legacy
      }
    }

    const statusColorMap: Record<string, { bg: string; text: string }> = {
      OPEN: { bg: '#EBF2FF', text: '#3B82F6' },
      NEW: { bg: '#F0F9FF', text: '#0EA5E9' },
      WON: { bg: '#ECFDF5', text: '#059669' },
      LOST: { bg: '#FEF2F2', text: '#DC2626' },
      CONTACTED: { bg: '#FFF9E6', text: '#D97706' },
      QUALIFIED: { bg: '#E6FFFA', text: '#059669' },
    };

    return leads.map((lead) => {
      const obj: any = lead.toObject();
      obj.latestDealStatus = latestStatusByLead.get(lead._id.toString()) ?? null;
      const rawStageId = latestStageByLead.get(lead._id.toString()) ?? null;
      obj.latestDealStage = rawStageId;
      // Resolve stage UUID → readable name for display
      obj.latestDealStageName = rawStageId ? (stageNameMap.get(rawStageId) || rawStageId) : null;
      obj.dealCount = dealCountByLead.get(lead._id.toString()) || 0;
      obj._dealCount = obj.dealCount;

      // Priority: WON/LOST overrides everything; then active deal stage; then lead status
      if (obj.latestDealStatus === 'WON' || obj.latestDealStatus === 'LOST') {
        obj.displayStatus = obj.latestDealStatus; // e.g. "WON"
        obj.displayStatusColor = statusColorMap[obj.latestDealStatus];
      } else if (obj.latestDealStageName) {
        // Active deal in pipeline — show the pipeline stage name
        obj.displayStatus = obj.latestDealStageName;
        obj.displayStatusColor = { bg: '#EFF6FF', text: '#2563EB' }; // blue for active deal
      } else {
        // No deal — fall back to lead's own status
        obj.displayStatus = obj.status;
        const s = obj.status ? obj.status.toString().toUpperCase() : null;
        obj.displayStatusColor = s ? (statusColorMap[s] || { bg: '#F1F5F9', text: '#64748B' }) : { bg: '#F1F5F9', text: '#64748B' };
      }
      return obj;
    });
  }

  async findOne(id: string, tenantId: string, userId?: string, userRole?: string) {
    const query: any = { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), isDeleted: false };
    if (userRole === 'SALES') {
      query.assignedTo = new Types.ObjectId(userId);
    }
    const lead = await this.leadModel.findOne(query)
      .populate('tenantId')
      .populate('assignedTo')
      .populate('assignedBy')
      .populate('createdBy')
      .exec();
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Attach latest deal status, stage and counts for this lead
    const relatedDeals = await this.dealModel
      .find({ tenantId: new Types.ObjectId(tenantId), leadId: new Types.ObjectId(id) } as any)
      .select('status stage createdAt')
      .sort({ createdAt: -1 })
      .exec();

    const latestStatus = relatedDeals.length > 0 ? relatedDeals[0].status : null;
    const latestStageId = relatedDeals.length > 0 ? relatedDeals[0].stage : null;
    const count = relatedDeals.length;
    const obj: any = (lead as any).toObject ? (lead as any).toObject() : lead;
    obj.latestDealStatus = latestStatus;
    obj.latestDealStage = latestStageId;

    // Resolve stage UUID → readable name
    const tenantDoc = await this.tenantModel.findById(tenantId).select('pipelineStages').lean().exec() as any;
    const stageNameMap = new Map<string, string>();
    if (tenantDoc?.pipelineStages) {
      for (const s of tenantDoc.pipelineStages) {
        if (s.id) stageNameMap.set(s.id, s.name);
        stageNameMap.set(s.name, s.name);
      }
    }
    obj.latestDealStageName = latestStageId ? (stageNameMap.get(latestStageId) || latestStageId) : null;

    obj.dealCount = count;
    obj._dealCount = count;

    // Priority: WON/LOST > active deal stage > lead own status
    const statusColorMap: Record<string, { bg: string; text: string }> = {
      OPEN: { bg: '#EBF2FF', text: '#3B82F6' },
      NEW: { bg: '#F0F9FF', text: '#0EA5E9' },
      WON: { bg: '#ECFDF5', text: '#059669' },
      LOST: { bg: '#FEF2F2', text: '#DC2626' },
      CONTACTED: { bg: '#FFF9E6', text: '#D97706' },
      QUALIFIED: { bg: '#E6FFFA', text: '#059669' },
    };
    if (obj.latestDealStatus === 'WON' || obj.latestDealStatus === 'LOST') {
      obj.displayStatus = obj.latestDealStatus;
      obj.displayStatusColor = statusColorMap[obj.latestDealStatus];
    } else if (obj.latestDealStageName) {
      obj.displayStatus = obj.latestDealStageName;
      obj.displayStatusColor = { bg: '#EFF6FF', text: '#2563EB' };
    } else {
      obj.displayStatus = obj.status;
      const s = obj.status ? obj.status.toString().toUpperCase() : null;
      obj.displayStatusColor = s ? (statusColorMap[s] || { bg: '#F1F5F9', text: '#64748B' }) : { bg: '#F1F5F9', text: '#64748B' };
    }

    return obj;
  }

  async update(id: string, updateData: any, tenantId: string, userId: string, userRole?: string) {
    const query: any = { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), isDeleted: false };
    if (userRole === 'SALES') {
      query.assignedTo = new Types.ObjectId(userId);
    }
    const oldLead = await this.leadModel.findOne(query).exec();
    if (!oldLead) {
      throw new NotFoundException('Lead not found');
    }

    if (userRole === 'SALES') {
      delete updateData.assignedTo;
    } else if (updateData.assignedTo) {
      updateData.assignedTo = new Types.ObjectId(updateData.assignedTo);
    }

    const lead = await this.leadModel
      .findOneAndUpdate({ _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) } as any, updateData, { new: true })
      .exec();

    if (lead) {
      const actorUser = await this.userModel.findById(userId).select('name email').lean().exec() as any;
      const actorName = actorUser?.name || actorUser?.email || 'Someone';
      const leadIdentifier = lead.name || lead.email || lead.phoneNumber || 'a lead';

      const changes: string[] = [];
      if (updateData.status && updateData.status !== oldLead.status) {
        changes.push(`changed status of lead "${leadIdentifier}" to ${updateData.status}`);
      }
      if (updateData.assignedTo && updateData.assignedTo.toString() !== (oldLead.assignedTo?.toString())) {
        changes.push(`reassigned lead "${leadIdentifier}"`);
      }
      
      if (changes.length > 0) {
        const content = `${actorName} ${changes.join('; ')}`;
        await this.activitiesService.create({
          type: updateData.status ? ActivityType.STATUS_CHANGE : ActivityType.SYSTEM,
          leadId: lead._id,
          content: content,
          activityTime: new Date(),
        }, tenantId, userId);
      }

      // Check for notes or aiSummary updates to add to "Note History"
      // Prioritize AI Summary to avoid double-logging when aiSummary also updates lead.notes
      if (updateData.aiSummary && updateData.aiSummary !== oldLead.aiSummary) {
        await this.activitiesService.create({
          type: ActivityType.NOTE,
          leadId: lead._id,
          content: `AI Call Summary: ${updateData.aiSummary}`,
          activityTime: new Date(),
          aiGenerated: true,
        }, tenantId, userId);
      } else if (updateData.notes && updateData.notes !== oldLead.notes) {
        await this.activitiesService.create({
          type: ActivityType.NOTE,
          leadId: lead._id,
          content: updateData.notes,
          activityTime: new Date(),
        }, tenantId, userId);
      }
    }
    return lead;
  }

  async remove(id: string, tenantId: string, userId?: string, userRole?: string) {
    const query: any = { _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId) };
    if (userRole === 'SALES') {
      query.assignedTo = new Types.ObjectId(userId);
    }
	const result = await this.leadModel.findOneAndUpdate(query, { isDeleted: true }).exec();
	if (!result) {
		throw new NotFoundException('Lead not found');
	}
	return { message: 'Lead soft-deleted successfully' };
  }
}
