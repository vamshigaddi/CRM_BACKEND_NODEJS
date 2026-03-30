import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument, LeadDataSource, LeadStatus } from '../leads/schemas/lead.schema';
import { Activity, ActivityDocument, ActivityType } from '../activities/schemas/activity.schema';
import { Integration, IntegrationDocument, IntegrationType, IntegrationStatus } from '../integrations/schemas/integrations.schema';
import { Conversation, ConversationDocument } from '../integrations/schemas/conversations.schema';
import { Message, MessageDocument } from '../integrations/schemas/messages.schema';
import { TenantTemplate, TenantTemplateDocument } from '../templates/schemas/tenant-template.schema';
import { MasterTemplate, MasterTemplateDocument } from '../templates/schemas/master-template.schema';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private configService: ConfigService,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
    @InjectModel(Integration.name) private integrationModel: Model<IntegrationDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(TenantTemplate.name) private tenantTemplateModel: Model<TenantTemplateDocument>,
    @InjectModel(MasterTemplate.name) private masterTemplateModel: Model<MasterTemplateDocument>,
  ) {}

  async getConversations(currentUser: any) {
    const pipeline: any[] = [
      { $match: { 
          tenantId: new Types.ObjectId(currentUser.tenantId), 
          channel: 'whatsapp' 
      } },
      // Ensure leadId is treated as ObjectId for the lookup
      {
        $addFields: {
          leadId: { $toObjectId: '$leadId' }
        }
      },
      {
        $lookup: {
          from: 'leads',
          localField: 'leadId',
          foreignField: '_id',
          as: 'lead',
        },
      },
      { $unwind: { path: '$lead', preserveNullAndEmptyArrays: true } },
    ];

    if (currentUser.role === 'SALES') {
      pipeline.push({
        $match: {
          $or: [
            { 'lead.assignedTo': new Types.ObjectId(currentUser._id) },
            { 'lead.assignedTo': { $exists: false } },
            { 'lead.assignedTo': null }
          ]
        },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'crm_messages',
          let: { convId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$conversationId', '$$convId'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: 'latestMessages'
        }
      }
    );

    pipeline.push(
      { $sort: { lastMessageAt: -1, createdAt: -1 } },
      {
        $project: {
          _id: 1,
          unreadCount: 1,
          lastMessageAt: 1,
          status: 1,
          lastMessage: { $arrayElemAt: ['$latestMessages', 0] },
          lead: {
            _id: '$lead._id',
            name: '$lead.name',
            email: '$lead.email',
            phoneNumber: '$lead.phoneNumber',
            organization: '$lead.organization',
          },
        },
      },
    );

    return this.conversationModel.aggregate(pipeline).exec();
  }

  async getMessages(tenantId: string, conversationId: string) {
    const messages = await this.messageModel.find({
      tenantId: new Types.ObjectId(tenantId),
      conversationId: new Types.ObjectId(conversationId),
    }).sort({ createdAt: 1 }).exec();

    // Reset unread count
    await this.conversationModel.updateOne(
      { _id: new Types.ObjectId(conversationId), tenantId: new Types.ObjectId(tenantId) },
      { $set: { unreadCount: 0 } }
    );

    // Mark as read in Meta API
    try {
      const latestIncomingUnread = await this.messageModel.findOne({
        tenantId: new Types.ObjectId(tenantId),
        conversationId: new Types.ObjectId(conversationId),
        direction: 'incoming',
        status: { $ne: 'read' }
      }).sort({ createdAt: -1 }).exec();

      if (latestIncomingUnread && latestIncomingUnread.externalMessageId) {
        const config = await this.getIntegrationConfig(tenantId);
        if (config && config.accessToken && config.phoneNumberId) {
          const apiVersion = this.configService.get<string>('whatsapp.apiVersion') || 'v19.0';
          const baseUrl = `https://graph.facebook.com/${apiVersion}/${config.phoneNumberId}/messages`;
          
          await axios.post(baseUrl, {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: latestIncomingUnread.externalMessageId
          }, {
            headers: { Authorization: `Bearer ${config.accessToken}` }
          });

          // Update DB status for all earlier unread incoming messages
          await this.messageModel.updateMany({
            tenantId: new Types.ObjectId(tenantId),
            conversationId: new Types.ObjectId(conversationId),
            direction: 'incoming',
            status: { $ne: 'read' }
          }, { $set: { status: 'read' } });
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to mark messages as read in Meta: ${err.response?.data?.error?.message || err.message}`);
    }

    return messages;
  }

  private async getIntegrationConfig(tenantId: string) {
    const integration = await this.integrationModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      integrationType: IntegrationType.WHATSAPP,
      status: IntegrationStatus.CONNECTED,
    }).exec();

    if (!integration || !integration.integrationConfig?.accessToken) {
      throw new HttpException('WhatsApp integration not configured or disconnected', HttpStatus.BAD_REQUEST);
    }
    return integration.integrationConfig;
  }

  async sendMessage(msgIn: any, currentUser: any) {
    const config = await this.getIntegrationConfig(currentUser.tenantId);
    const { accessToken, phoneNumberId } = config;
    const apiVersion = this.configService.get<string>('whatsapp.apiVersion') || 'v19.0';
    const baseUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    let lead = await this.leadModel.findOne({
      _id: new Types.ObjectId(msgIn.leadId),
      tenantId: new Types.ObjectId(currentUser.tenantId!),
    } as any).exec();

    if (!lead || (!lead.whatsappNumber && !lead.mobileNumber && !lead.phoneNumber)) {
      throw new HttpException('Lead not found or has no contact number', HttpStatus.BAD_REQUEST);
    }

    // Ensure conversation exists
    let conversation = await this.conversationModel.findOne({
      tenantId: new Types.ObjectId(currentUser.tenantId),
      leadId: new Types.ObjectId(lead._id.toString()),
      channel: 'whatsapp',
    });

    if (!conversation) {
      // Fallback: create conversation if it doesn't exist yet
      const whatsappIntegration = await this.integrationModel.findOne({
        tenantId: new Types.ObjectId(currentUser.tenantId),
        integrationType: IntegrationType.WHATSAPP,
      }).exec();

      if (!whatsappIntegration) {
        throw new HttpException('WhatsApp integration not found for this tenant', HttpStatus.BAD_REQUEST);
      }

      conversation = new this.conversationModel({
        tenantId: new Types.ObjectId(currentUser.tenantId),
        leadId: new Types.ObjectId(lead._id.toString()),
        integrationId: whatsappIntegration._id,
        channel: 'whatsapp',
      });
      await conversation.save();
    }

    // 24-HOUR RULE Check for free-form messages
    if (!msgIn.templateName) {
      const lastIncomingMsg : any = await this.messageModel.findOne({
        conversationId: new Types.ObjectId(conversation._id.toString()),
        direction: 'incoming',
      }).sort({ createdAt: -1 }).exec();

      if (!lastIncomingMsg || Date.now() - new Date(lastIncomingMsg.createdAt).getTime() > 24 * 60 * 60 * 1000) {
        throw new HttpException(
          'Cannot send free-form message. The 24-hour window from the last user message has expired. Please use a Template message.',
          HttpStatus.BAD_REQUEST
        );
      }
    }

    try {
      let result = null;
      const cleanTo = (lead.whatsappNumber || lead.mobileNumber || lead.phoneNumber).replace('+', '');

      let finalContent = msgIn.message || msgIn.filename || '';

      if (msgIn.templateName) {
        // Fetch template to get the parameter names/order
        const template = await this.tenantTemplateModel.findOne({
          tenantId: new Types.ObjectId(currentUser.tenantId),
          templateName: msgIn.templateName,
        }).populate('masterTemplateId').exec();

        let components = [];
        if (template && (template.masterTemplateId as any)?.bodyParams) {
          const params = (template.masterTemplateId as any).bodyParams;
          const paramValues = msgIn.bodyParamValues || {};
          
          const parameters = params.map((p:any) => ({
            type: 'text',
            text: paramValues[p] || '',
          }));

          if (parameters.length > 0) {
            components.push({
              type: 'body',
              parameters,
            });
          }
        }

        let resultText = (template?.masterTemplateId as any)?.bodyText || '';
        if (resultText) {
            Object.entries(msgIn.bodyParamValues || {}).forEach(([key, value]) => {
              resultText = resultText.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), (value as string) || `[${key}]`);
            });
            finalContent = resultText;
        } else {
            finalContent = msgIn.templateName;
        }

        result = await axios.post(baseUrl, {
          messaging_product: 'whatsapp',
          to: cleanTo,
          type: 'template',
          template: {
            name: msgIn.templateName,
            language: { code: msgIn.languageCode || 'en_US' },
            components: components.length > 0 ? components : undefined,
          }
        }, { headers });
      } else if (msgIn.mediaUrl) {
         result = await axios.post(baseUrl, {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'document',
          document: { link: msgIn.mediaUrl, filename: msgIn.filename || 'document.pdf' }
        }, { headers });
      } else if (msgIn.message) {
         result = await axios.post(baseUrl, {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'text',
          text: { body: msgIn.message }
        }, { headers });
      }

      // Save Message to DB
      const newMsg = new this.messageModel({
        tenantId: new Types.ObjectId(currentUser.tenantId),
        conversationId: conversation._id,
        leadId: lead._id,
        direction: 'outgoing',
        type: msgIn.templateName ? 'template' : (msgIn.mediaUrl ? 'document' : 'text'),
        content: finalContent,
        templateName: msgIn.templateName,
        status: 'sent',
        externalMessageId: result?.data?.messages?.[0]?.id,
      });
      await newMsg.save();

      // Update Conversation
      conversation.lastMessageAt = new Date();
      await conversation.save();

      // Log Activity
      const activityContent = msgIn.templateName ? `Sent Template: \n${finalContent}` : (msgIn.message || `Sent document: ${msgIn.filename}`);
      const activity = new this.activityModel({
        tenantId: new Types.ObjectId(currentUser.tenantId),
        userId: new Types.ObjectId(currentUser._id),
        leadId: msgIn.leadId,
        type: ActivityType.WHATSAPP,
        content: activityContent,
      });
      await activity.save();

      return {
        status: 'success',
        message: newMsg,
      };
    } catch (e: any) {
      this.logger.error(e.response?.data || e.message);
      throw new HttpException(`WhatsApp API Error: ${e.response?.data?.error?.message || e.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async handleWebhook(body: any) {
    this.logger.log(`Webhook received: object=${body?.object}`);
    
    if (body.object === 'whatsapp_business_account' || body.object === 'page') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          try {
            const wabaIdFromWebhook = entry.id;
            const phoneNumberIdFromWebhook = change.value?.metadata?.phone_number_id;

            if (!phoneNumberIdFromWebhook && !wabaIdFromWebhook) {
              this.logger.debug('Webhook change has no phone_number_id or WABA ID, skipping');
              continue;
            }

            // Identify which CRM Tenant this WhatsApp business number/account belongs to
            // Using $or to match either the specific phone number ID or the WABA ID (Business Account ID)
            const integrationSnapshot = await this.integrationModel.findOne({
              $or: [
                { 'integrationConfig.wabaId': String(wabaIdFromWebhook) },
                { 'integrationConfig.phoneNumberId': String(phoneNumberIdFromWebhook) },
                { 'integrationConfig.phoneNumberId': Number(phoneNumberIdFromWebhook) }
              ],
              integrationType: IntegrationType.WHATSAPP,
            }).exec();

            if (!integrationSnapshot) {
              this.logger.error(`Webhook received for unregistered integration: WABA=${wabaIdFromWebhook}, PhoneID=${phoneNumberIdFromWebhook}`);
              continue;
            }

            const tenantId = integrationSnapshot.tenantId;

            // --- Handle INCOMING MESSAGES ---
            if (change.value?.messages?.length) {
              const contacts = change.value?.contacts || [];
              for (const msg of change.value.messages) {
                const contact = contacts.find(c => c.wa_id === msg.from);
                const contactName = contact?.profile?.name || msg.from;
                await this.processIncomingMessage(
                  msg, 
                  change.value.metadata.display_phone_number, 
                  tenantId.toString(), 
                  contactName, 
                  integrationSnapshot._id.toString()
                );
              }
            }

            // --- Handle DELIVERY / READ STATUS UPDATES ---
            if (change.value?.statuses?.length) {
              for (const statusUpdate of change.value.statuses) {
                await this.processStatusUpdate(statusUpdate, tenantId.toString());
              }
            }
          } catch (innerErr) {
            this.logger.error(`Error processing webhook change: ${innerErr.message}`, innerErr.stack);
          }
        }
      }
    } else {
      this.logger.warn(`Webhook received for unknown object type: ${body.object}`);
    }
  }

  /**
   * Handles Meta status update payloads for outgoing messages.
   * Updates the message status in DB so the UI can show ✓ / ✓✓ / ✓✓(blue) ticks.
   */
  private async processStatusUpdate(statusUpdate: any, tenantId: string) {
    // statusUpdate shape: { id, status, timestamp, recipient_id, errors? }
    const { id: externalMessageId, status } = statusUpdate;

    // Only handle statuses we care about
    const validStatuses = ['sent', 'delivered', 'read', 'failed'];
    if (!validStatuses.includes(status)) return;

    try {
      await this.messageModel.updateOne(
        { externalMessageId, tenantId: new Types.ObjectId(tenantId) },
        { $set: { status } },
      );
      this.logger.log(`Message ${externalMessageId} status updated to: ${status} (Tenant: ${tenantId})`);
    } catch (err: any) {
      this.logger.error(`Failed to update message status for tenant ${tenantId}: ${err.message}`);
    }
  }

  private async processIncomingMessage(msg: any, businessPhoneNumber: string, tenantId: string, contactName: string, integrationId: any) {
    const fromPhone = msg.from; // User's phone (e.g. 919876543210)
    this.logger.log(`Received WHATSAPP message from ${fromPhone} (Tenant: ${tenantId})`);

    // 1. IMMEDIATE DUPLICATE CHECK
    // Check if we've already processed this message ID to prevent race conditions
    const existingMsg = await this.messageModel.findOne({ externalMessageId: msg.id }).exec();
    if (existingMsg) {
      this.logger.debug(`Message ${msg.id} already processed, skipping`);
      return; 
    }
    
    // 2. NORMALIZE PHONE NUMBER for more accurate lookup
    // Strip everything but digits
    const cleanedPhone = fromPhone.replace(/\D/g, '');
    // If it's 10 digits, assume India and add 91 (matching LeadSchema formatting)
    const normalizedPhone = cleanedPhone.length === 10 ? `91${cleanedPhone}` : cleanedPhone;
    const phoneSuffix = cleanedPhone.slice(-10);
    const phoneRegex = new RegExp(`${phoneSuffix}$`);
    
    // 3. FIND LEAD (using both exact normalized match and suffix regex)
    let lead = await this.leadModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      $or: [
        { whatsappNumber: normalizedPhone },
        { phoneNumber: normalizedPhone },
        { mobileNumber: normalizedPhone },
        { whatsappNumber: { $regex: phoneRegex } },
        { phoneNumber: { $regex: phoneRegex } },
        { mobileNumber: { $regex: phoneRegex } }
      ]
    } as any).exec();

    if (!lead) {
      this.logger.log(`Creating new lead for unknown number: ${fromPhone}`);
      try {
        lead = new this.leadModel({
          tenantId: new Types.ObjectId(tenantId),
          name: contactName || fromPhone,
          phoneNumber: normalizedPhone,
          whatsappNumber: normalizedPhone,
          source: LeadDataSource.WHATSAPP,
          status: LeadStatus.OPEN,
          hasWhatsapp: true,
          lastActivityAt: new Date(),
        });
        await lead.save();
      } catch (err) {
        // Fallback: check again if someone else created it in the few ms since we checked
        lead = await this.leadModel.findOne({
            tenantId: new Types.ObjectId(tenantId),
            $or: [{ whatsappNumber: normalizedPhone }, { phoneNumber: normalizedPhone }]
        }).exec();
        
        if (!lead) {
            this.logger.error(`Failed to register or find new lead for ${fromPhone}: ${err.message}`);
            return;
        }
      }
    }

    let conversation = await this.conversationModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      leadId: lead._id,
      integrationId: new Types.ObjectId(integrationId),
      channel: 'whatsapp',
    }).exec();

    if (!conversation) {
      this.logger.log(`Creating new conversation for lead ${lead._id} on tenant ${tenantId}`);
      conversation = new this.conversationModel({
        tenantId: new Types.ObjectId(tenantId),
        leadId: lead._id,
        integrationId: new Types.ObjectId(integrationId),
        channel: 'whatsapp',
        status: 'open',
      });
      await conversation.save();
    }

    conversation.lastMessageAt = new Date();
    conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    await conversation.save();

    let content = 'Attachment details received';
    let type = 'text';

    if (msg.type === 'text') {
      content = msg.text?.body || '';
      type = 'text';
    } else if (msg.type === 'image') {
      content = 'Image received';
      type = 'image';
    } else if (msg.type === 'document') {
      content = 'Document received';
      type = 'document';
    } else if (msg.type === 'button') {
      content = msg.button?.text || 'Button Reply';
      type = 'text';
    } else if (msg.type === 'interactive') {
      content = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || 'Interactive Reply';
      type = 'text';
    } else if (msg.type === 'template') {
      content = 'Template message';
      type = 'template';
    }

    const message = new this.messageModel({
      tenantId: new Types.ObjectId(tenantId),
      conversationId: conversation._id,
      leadId: lead._id,
      direction: 'incoming',
      type: type,
      content: content,
      externalMessageId: msg.id,
      status: 'delivered', 
    });
    await message.save();

    // LOG AS ACTIVITY so it shows in Lead Details audit trail
    // Note: We attribute the activity to the integrationId as it's a system-level event
    // The activity schema requires a userId; if lead is assigned, use that, otherwise use a placeholder or integration ID
    const activity = new this.activityModel({
      tenantId: new Types.ObjectId(tenantId),
      userId: lead.assignedTo || new Types.ObjectId("000000000000000000000000"), // System/Service user fallback
      leadId: lead._id,
      type: ActivityType.WHATSAPP,
      content: `Incoming WhatsApp: ${content}`,
      activityTime: new Date(),
    });
    await activity.save();

    lead.lastActivityAt = new Date();
    await lead.save();
  }
}
