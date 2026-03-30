import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity, ActivityDocument, ActivityType } from './schemas/activity.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Tenant, TenantDocument } from '../tenants/schemas/tenant.schema';

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    private configService: ConfigService,
  ) {}

  async create(activityData: any, tenantId: string, userId: string) {
    const data = {
      ...activityData,
      tenantId: new Types.ObjectId(tenantId),
    };
    if (!data.userId) {
      data.userId = new Types.ObjectId(userId);
    }
    const activity = new this.activityModel(data);
    return activity.save();
  }

  async findAll(
    tenantId: string,
    skip = 0,
    limit = 100,
    type?: ActivityType,
    leadId?: string,
    dealId?: string,
    userId?: string,
  ) {
    const query: any = { tenantId: new Types.ObjectId(tenantId), isDeleted: false };

    if (type) query.type = type;
    if (leadId) query.leadId = new Types.ObjectId(leadId);
    if (dealId) query.dealId = new Types.ObjectId(dealId);
    if (userId) query.userId = new Types.ObjectId(userId);

    return this.activityModel
      .find(query)
      .populate('tenantId')
      .populate('userId')
      .populate('leadId')
      .populate('dealId')
      .skip(skip)
      .limit(limit)
      .sort({ activityTime: -1 })
      .exec();
  }

  async findOne(id: string, tenantId: string) {
    const activity = await this.activityModel.findOne({ _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), isDeleted: false } as any).exec();
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
    return activity;
  }

  async update(id: string, updateData: any, tenantId: string, userId: string) {
    const activity = await this.activityModel.findOne({ _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), isDeleted: false } as any).exec();
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    if (activity.userId.toString() !== userId) {
      throw new Error('Not allowed to update this activity');
    }

    Object.assign(activity, updateData);
    return activity.save();
  }

  async remove(id: string, tenantId: string, userId: string) {
    const activity = await this.activityModel.findOne({ _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), isDeleted: false } as any).exec();
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    if (activity.userId.toString() !== userId) {
      throw new Error('Not allowed to delete this activity');
    }

    activity.isDeleted = true;
    return activity.save();
  }

  async analyzeRecording(id: string, tenantId: string, payload?: { transcript?: string, current_stage?: string, allowed_stages?: string[] }) {
    this.logger.log(`Analyzing recording for activity ${id}`);
    
    const activity = await this.activityModel.findOne({ _id: new Types.ObjectId(id), tenantId: new Types.ObjectId(tenantId), isDeleted: false } as any).exec();
    if (!activity || activity.type !== ActivityType.CALL) {
      throw new NotFoundException('Call recording not found');
    }

    // 1. Get Contextual Information (Lead and Tenant)
    const [lead, tenant] = await Promise.all([
      activity.leadId ? this.leadModel.findOne({ _id: activity.leadId, tenantId: new Types.ObjectId(tenantId) } as any).exec() : Promise.resolve(null),
      this.tenantModel.findOne({ _id: new Types.ObjectId(tenantId) } as any).exec()
    ]);

    // 2. Determine Transcript
    let transcription = (activity.meta as any).get ? (activity.meta as any).get('transcription') : (activity.meta as any).transcription;
    let transcriptText = payload?.transcript || transcription?.text;

    const aiBaseUrl = this.configService.get('ai.baseUrl');
    
    // If we don't have a transcript, we must get it first
    if (!transcriptText) {
      const recordingUrl = (activity.meta as any).get ? (activity.meta as any).get('recordingUrl') : (activity.meta as any).recordingUrl;
      if (!recordingUrl) {
        throw new Error('No transcript or recording URL available for analysis');
      }

      this.logger.log(`No transcript found, calling transcription service for ${recordingUrl}`);
      const transcribeUrl = aiBaseUrl.endsWith('/') ? `${aiBaseUrl}transcribe-url` : `${aiBaseUrl}/transcribe-url`;
      const transRes = await axios.post(transcribeUrl, { url: recordingUrl });
      
      transcription = transRes.data.transcription;
      transcriptText = transcription?.text;

      // Save transcription to activity metadata immediately
      if (!activity.meta) activity.meta = new Map();
      (activity.meta as any).set('transcription', transcription);
      activity.markModified('meta');
      await activity.save();
    }

    // 3. Perform AI Analysis with Context
    const currentStageName = tenant?.pipelineStages?.find(s => s.id === lead?.stage || s.name === lead?.stage)?.name || lead?.stage || 'New';
    const allowedStages = tenant?.pipelineStages?.map(s => s.name) || [];

    this.logger.log(`Calling AI analysis with context: Stage=${currentStageName}, StagesCount=${allowedStages.length}`);
    const analyzeUrl = aiBaseUrl.endsWith('/') ? `${aiBaseUrl}analyze` : `${aiBaseUrl}/analyze`;
    
    try {
      const analysisResponse = await axios.post(analyzeUrl, {
        transcript: transcriptText,
        current_stage: currentStageName,
        allowed_stages: allowedStages
      });

      const fullAnalysis = analysisResponse.data.analysis || analysisResponse.data;
      
      const costPer1K = this.configService.get('ai.costPer1KTokens') || 0.2;
      const totalTokens = fullAnalysis.total_tokens || 0;
      const calculatedCost = (totalTokens / 1000) * costPer1K;

      // 4. Update Activity with Full Analysis and Metrics
      if (!activity.meta) activity.meta = new Map();
      (activity.meta as any).set('analysis', fullAnalysis);
      (activity.meta as any).set('isAnalyzed', true);
      
      activity.totalTokens = totalTokens;
      activity.intelligenceCost = calculatedCost;
      
      if (fullAnalysis.usage?.breakdown || fullAnalysis.breakdown) {
         const breakdown = fullAnalysis.usage?.breakdown || fullAnalysis.breakdown;
         activity.tokenBreakdown = new Map(Object.entries(breakdown));
      }
      
      activity.markModified('meta');
      activity.markModified('tokenBreakdown');
      await activity.save();

      return fullAnalysis;
    } catch (err) {
      this.logger.error(`AI Analysis call failed: ${err.message}`);
      throw new Error(`AI Analysis failed: ${err.message}`);
    }
  }
}
