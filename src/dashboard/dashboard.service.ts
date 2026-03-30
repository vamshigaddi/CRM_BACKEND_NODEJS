import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Deal, DealDocument } from '../deals/schemas/deal.schema';
import { Task, TaskDocument, TaskStatus } from '../tasks/schemas/task.schema';
import { Activity, ActivityDocument } from '../activities/schemas/activity.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { Tenant } from 'src/tenants/schemas/tenant.schema';
import { Conversation, ConversationDocument } from '../integrations/schemas/conversations.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Deal.name) private dealModel: Model<DealDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
  ) {}

  async getStats(currentUser: any, months: number = 6) {
    const tenantId = new Types.ObjectId(currentUser.tenantId);
    const baseQuery: any = { tenantId, isDeleted: false };

    const isSales = currentUser.role === UserRole.SALES;
    if (isSales) {
      baseQuery.assignedTo = new Types.ObjectId(currentUser._id);
    }

    // 1. Total Leads & Qualified Leads
    const totalLeads = await this.leadModel.countDocuments(baseQuery).exec();
    const qualifiedLeads = await this.leadModel.countDocuments({
      ...baseQuery,
      leadScore: { $gte: 70 },
    }).exec();

    // 2. Revenue Calculation (WON Deals)
    const wonDeals = await this.dealModel.find({ ...baseQuery, status: 'WON' }).exec();
    const totalRevenue = wonDeals.reduce((sum, deal) => sum + (deal.closingValue || deal.value || 0), 0);

    // 3. Conversion Rate
    const totalDeals = await this.dealModel.countDocuments(baseQuery).exec();
    const conversionRate = totalDeals > 0 ? (wonDeals.length / totalDeals) * 100 : 0;

    const tenant = await this.tenantModel
        .findOne({ _id: tenantId, isDeleted: false })
        .select('pipelineStages')
        .lean();

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      const pipelineStages = tenant.pipelineStages || [];
  
      // Build two lookup sets: stable UUIDs and legacy display names.
      // Deals may store either form depending on when they were created.
      const stageKeys: string[] = pipelineStages.flatMap((s: any) => {
        const keys = [s.name];
        if (s.id && s.id !== s.name) keys.push(s.id);
        return keys;
      });

      // Build a reverse map: stored value → { id, name } for display resolution
      const stageMap = new Map<string, { id: string; name: string }>();
      pipelineStages.forEach((s: any) => {
        const entry = { id: s.id || s.name, name: s.name };
        stageMap.set(s.name, entry);
        if (s.id && s.id !== s.name) stageMap.set(s.id, entry);
      });

     const stageChartRaw = await this.dealModel.aggregate([
        {
          $match: {
            ...baseQuery,
            stage: { $in: stageKeys },
          },
        },
        {
          $group: {
            _id: '$stage',
            count: { $sum: 1 },
            totalValue: { $sum: { $ifNull: ['$closingValue', '$value'] } },
          },
        },
        {
          $project: {
            _id: 0,
            stage: '$_id',
            count: 1,
            totalValue: 1,
          },
        },
      ]);

      // Merge entries that resolve to the same stage (e.g. uuid + legacy name)
      const mergedStageMap = new Map<string, { label: string; id: string; value: number; amount: number }>();
      for (const row of stageChartRaw) {
        const resolved = stageMap.get(row.stage);
        const stageId = resolved?.id || row.stage;
        const stageName = resolved?.name || row.stage;
        if (mergedStageMap.has(stageId)) {
          mergedStageMap.get(stageId)!.value += row.count;
          mergedStageMap.get(stageId)!.amount += row.totalValue || 0;
        } else {
          mergedStageMap.set(stageId, { label: stageName, id: stageId, value: row.count, amount: row.totalValue || 0 });
        }
      }
      // Sort by pipeline order
      const stageChart = pipelineStages
        .map((s: any) => mergedStageMap.get(s.id || s.name) || null)
        .filter(Boolean);

    const sourceStats = await this.leadModel.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ]);
    const sourceChart = sourceStats.map((s) => ({ label: s._id || 'Unknown', value: s.count }));

    const performanceOverTime = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const monthlyWon = await this.dealModel.find({
        ...baseQuery,
        status: 'WON',
        closedAt: { $gte: startOfMonth, $lte: endOfMonth }
      }).exec();

      performanceOverTime.push({
        label: d.toLocaleString('default', { month: 'short' }),
        value: monthlyWon.reduce((sum, deal) => sum + (deal.closingValue || deal.value || 0), 0)
      });
    }

    // 6. Recent Activities
    const activityQuery: any = { tenantId, isDeleted: false };
    if (isSales) {
      activityQuery.userId = currentUser._id;
    }

    const recentActivitiesRaw = await this.activityModel
      .find(activityQuery)
      .sort({ activityTime: -1 })
      .limit(30) // Fetch extra to allow for deduplication
      .populate('userId', 'name email')
      .exec();

    const seenWhatsappLeads = new Set<string>();
    const recentActivities = [];

    for (const a of recentActivitiesRaw) {
      if (a.type === 'WHATSAPP') {
        const leadStr = a.leadId?.toString();
        if (leadStr && seenWhatsappLeads.has(leadStr)) {
          continue; // Skip if we already have a WhatsApp activity for this lead
        }
        if (leadStr) {
          seenWhatsappLeads.add(leadStr);
        }
      }
      recentActivities.push(a);
      if (recentActivities.length >= 7) break; // Limit to 7 items total in the dashboard feed
    }

    // Map activity type → readable verb for when content is missing/raw
    const typeLabel: Record<string, string> = {
      STAGE_CHANGE: 'moved a deal to a new stage',
      STATUS_CHANGE: 'updated a deal status',
      CALL: 'logged a call',
      WHATSAPP: 'sent a WhatsApp message',
      EMAIL: 'sent an email',
      NOTE: 'added a note',
      TASK: 'completed a task',
      MEETING: 'logged a meeting',
      ASSIGNMENT: 'reassigned a lead',
      SYSTEM: 'performed an action',
    };

    const activityFeed = recentActivities.map((a: any) => {
      const actorName = a.userId ? (a.userId.name || a.userId.email) : null;
      // Use content if present and non-trivial; otherwise synthesise from type
      const content = (a.content && a.content.trim().length > 0) ? a.content : (typeLabel[a.type] || a.type);
      return {
        type: a.type,
        content,
        time: a.activityTime,
        // Always show a real name; fall back to 'Team member' rather than 'System'
        user: actorName || 'Team member',
        userId: a.userId ? a.userId._id : null,
        leadId: a.leadId,
        dealId: a.dealId,
        aiGenerated: a.aiGenerated,
      };
    });

    const cards = [
      { title: 'Total Leads', value: totalLeads },
      { title: 'Qualified Leads', value: qualifiedLeads, trend: 12.5 },
      { title: 'Total Revenue', value: totalRevenue, suffix: '₹' },
      { title: 'Win Rate', value: Number(conversionRate.toFixed(1)), suffix: '%' },
    ];

    if (isSales) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      const dueTasksCount = await this.taskModel.countDocuments({
        ...baseQuery,
        status: { $ne: TaskStatus.COMPLETED },
        dueDate: { $lte: today },
      }).exec();

      const todayTasks = await this.taskModel.find({
        ...baseQuery,
        status: { $ne: TaskStatus.COMPLETED },
        $or: [
          { dueDate: { $lte: today } },
          { dueDate: null },
          { dueDate: { $exists: false } }
        ]
      })
      .sort({ priority: 1, dueDate: 1 })
      .limit(10)
      .exec();

      const activeDeals = await this.dealModel.countDocuments({ ...baseQuery, status: { $ne: 'WON' } }).exec();



      const salesCards = [
        { title: 'My Total Leads', value: totalLeads },
        { title: 'Active Deals', value: activeDeals },
        { title: 'Tasks Due Today', value: dueTasksCount, color: dueTasksCount > 0 ? 'text-rose-500' : '' },
      ];

      return {
        cards: salesCards,
        pipelineByStage: stageChart,
        leadSources: sourceChart,
        performanceOverTime,
        recentActivities: activityFeed,
        myTasksDue: dueTasksCount,
        todayTasks
      };
    } else {
      const repRevenue = await this.dealModel.aggregate([
        { $match: { ...baseQuery, status: 'WON' } },
        { $group: { _id: '$assignedTo', total: { $sum: { $ifNull: ['$closingValue', '$value'] } } } },
      ]);

      const teamChart = await Promise.all(
        repRevenue.map(async (item) => {
          const user = item._id ? await this.userModel.findOne({ _id: item._id, isDeleted: false }).exec() : null;
          return {
            label: user ? user.name || user.email : 'Unassigned',
            value: item.total,
          };
        }),
      );

      // compute top 4 reps by revenue for manager/admin dashboard
      const topSellersRaw = await this.dealModel.aggregate([
        { $match: { ...baseQuery, status: 'WON' } },
        { $group: { _id: '$assignedTo', total: { $sum: { $ifNull: ['$closingValue', '$value'] } } } },
        { $sort: { total: -1 } },
        { $limit: 4 },
      ]);

      const topSellers = await Promise.all(
        topSellersRaw.map(async (item) => {
          const user = item._id ? await this.userModel.findOne({ _id: item._id, isDeleted: false }).exec() : null;
          return {
            label: user ? user.name || user.email : 'Unassigned',
            value: item.total,
          };
        }),
      );

      return {
        cards,
        pipelineByStage: stageChart,
        leadSources: sourceChart,
        performanceOverTime,
        recentActivities: activityFeed,
        teamPerformance: teamChart,
        leadConversionRate: Number(conversionRate.toFixed(1)),
        topSellers,
      };
    }
  }

  async getNotifications(currentUser: any) {
    const tenantId = new Types.ObjectId(currentUser.tenantId);
    const userId = new Types.ObjectId(currentUser._id);
    const notifs = [];

    // 1. Unread WhatsApp Conversations
    const convs = await this.conversationModel.aggregate([
      { $match: { tenantId, assignedTo: userId, unreadCount: { $gt: 0 }, channel: 'whatsapp' } },
      {
        $lookup: {
          from: 'crm_leads',
          localField: 'leadId',
          foreignField: '_id',
          as: 'lead',
        },
      },
      { $unwind: { path: '$lead', preserveNullAndEmptyArrays: true } },
    ]);
    
    for (const c of convs) {
      notifs.push({
        id: `wa_${c._id}`,
        content: `New WhatsApp message from ${c.lead?.name || c.lead?.phoneNumber || 'Unknown'}`,
        time: c.lastMessageAt || c.updatedAt,
        link: '/whatsapp'
      });
    }

    // 2. New Leads Assigned
    const leads = await this.leadModel.find({
      tenantId,
      assignedTo: userId,
      status: 'NEW',
    }).exec();

    for (const l of leads) {
      const lead = l as any;
      notifs.push({
        id: `lead_${lead._id}`,
        content: `New lead assigned: ${lead.name || lead.email || lead.phoneNumber || 'Unknown'}`,
        time: lead.createdAt,
        link: '/leads'
      });
    }

    // 3. Tasks Due Today
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const tasks = await this.taskModel.find({
      tenantId,
      assignedTo: userId,
      status: { $ne: TaskStatus.COMPLETED },
      $or: [
        { dueDate: { $lte: today } },
        { dueDate: null },
        { dueDate: { $exists: false } }
      ]
    }).exec();

    for (const t of tasks) {
      const task = t as any;
      notifs.push({
        id: `task_${task._id}`,
        content: `Task due: ${task.title}`,
        time: task.dueDate || task.createdAt,
        link: '/tasks'
      });
    }

    // Sort by time descending
    let sortedNotifs = notifs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // Filter logic: WhatsApp notifications stay until unreadCount is 0. 
    // Tasks and Lead assignments are cleared/seen based on lastReadNotificationsAt.
    const userDoc = await this.userModel.findById(userId).exec();
    const readThreshold = userDoc?.lastReadNotificationsAt ? userDoc.lastReadNotificationsAt.getTime() : 0;
    
    const filteredNotifs = sortedNotifs.filter(n => {
      // Always show unread messages regardless of when the bell was last opened
      if (n.id.startsWith('wa_')) return true;
      // Other event-based notifs like "New Lead Assigned" obey the seen threshold
      return new Date(n.time).getTime() > readThreshold;
    });
    
    return filteredNotifs;
  }

  async markNotificationsRead(currentUser: any) {
    const userId = new Types.ObjectId(currentUser._id);
    await this.userModel.findByIdAndUpdate(userId, {
      lastReadNotificationsAt: new Date()
    }).exec();
    return { success: true };
  }
}
