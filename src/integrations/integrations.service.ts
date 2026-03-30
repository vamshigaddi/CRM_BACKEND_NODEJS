import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as net from 'net';
import axios from 'axios';
import { Integration, IntegrationDocument, IntegrationType, IntegrationStatus } from './schemas/integrations.schema';
import { Conversation, ConversationDocument } from './schemas/conversations.schema';
import { SaveIntegrationDto, PingIntegrationDto } from './dto/integration.dto';
import { TemplatesService } from '../templates/templates.service';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    @InjectModel(Integration.name) private integrationModel: Model<IntegrationDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    private readonly templatesService: TemplatesService,
  ) {}

  async createConversation(tenantId: string, leadId: string, assignedTo?: string) {
    const integration = await this.integrationModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      integrationType: IntegrationType.WHATSAPP,
      status: IntegrationStatus.CONNECTED,
    }).exec();

    if (!integration) return null;

    const existing = await this.conversationModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      leadId: new Types.ObjectId(leadId),
      channel: 'whatsapp',
    }).exec();

    if (existing) return existing;

    const conversation = new this.conversationModel({
      tenantId: new Types.ObjectId(tenantId),
      leadId: new Types.ObjectId(leadId),
      integrationId: integration._id,
      channel: 'whatsapp',
      assignedTo: assignedTo ? new Types.ObjectId(assignedTo) : undefined,
    });
    return conversation.save();
  }

  async findOneByTenant(tenantId: string, type: IntegrationType): Promise<Integration | null> {
    return this.integrationModel.findOne({ 
      tenantId: new Types.ObjectId(tenantId), 
      integrationType: type 
    }).exec();
  }

  async findAllByTenant(tenantId: string): Promise<Integration[]> {
    return this.integrationModel.find({ 
      tenantId: new Types.ObjectId(tenantId),
      isActive: true 
    }).exec();
  }

  async upsert(tenantId: string, dto: SaveIntegrationDto): Promise<Integration> {
    const { integrationType, ...config } = dto;
    
    const integration = await this.integrationModel.findOneAndUpdate(
      { 
        tenantId: new Types.ObjectId(tenantId), 
        integrationType 
      },
      { 
        ...config,
        tenantId: new Types.ObjectId(tenantId),
        integrationType
      },
      { upsert: true, new: true }
    ).exec();

    // If WhatsApp is configured and connected, assign the master templates
    if (integrationType === IntegrationType.WHATSAPP && integration.status === IntegrationStatus.CONNECTED) {
      await this.templatesService.assignTemplatesToTenant(tenantId);
    }
    
    return integration;
  }

  async remove(tenantId: string, type: IntegrationType): Promise<any> {
    const result = await this.integrationModel.deleteOne({ 
      tenantId: new Types.ObjectId(tenantId), 
      integrationType: type 
    }).exec();
    
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Integration ${type} not found`);
    }
    
    return { success: true };
  }

  // ─── PING ───────────────────────────────────────────────────────────────────
  async ping(dto: PingIntegrationDto): Promise<{ success: boolean; message: string }> {
    if (dto.integrationType === IntegrationType.EMAIL) {
      return this.pingSmtp(dto.integrationConfig);
    }
    if (dto.integrationType === IntegrationType.WHATSAPP) {
      return this.pingWhatsApp(dto.integrationConfig);
    }
    if (dto.integrationType === IntegrationType.TELEPHONY) {
      return this.pingTelephony(dto.integrationConfig);
    }
    throw new BadRequestException('Unknown integration type');
  }

  // TCP handshake to verify SMTP host:port is reachable + credentials format check
  private pingSmtp(cfg: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const { smtpHost, smtpPort, smtpUser, smtpPass, fromEmail } = cfg;
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !fromEmail) {
      return Promise.resolve({ success: false, message: 'Missing required SMTP fields.' });
    }
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: smtpHost, port: Number(smtpPort) }, () => {
        socket.destroy();
        resolve({ success: true, message: `SMTP server reachable at ${smtpHost}:${smtpPort}.` });
      });
      socket.setTimeout(8000);
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ success: false, message: `Connection timed out — check SMTP host and port.` });
      });
      socket.on('error', (err: any) => {
        resolve({ success: false, message: `Cannot reach SMTP server: ${err.message}` });
      });
    });
  }

  // Call Meta Graph API to verify Phone Number ID + access token
  private async pingWhatsApp(cfg: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const { accessToken, phoneNumberId, wabaId } = cfg;
    if (!accessToken || !phoneNumberId || !wabaId) {
      return { success: false, message: 'Access Token, Phone Number ID and WABA ID are required.' };
    }
    try {
      // Verify phone number ID is valid and belongs to the account
      const res = await axios.get(
        `https://graph.facebook.com/v19.0/${phoneNumberId}`,
        {
          params: { access_token: accessToken, fields: 'id,display_phone_number,verified_name,quality_rating' },
          timeout: 10000,
        }
      );
      const data = res.data as any;
      const displayNumber = data.display_phone_number || phoneNumberId;
      const verifiedName = data.verified_name ? ` (${data.verified_name})` : '';
      return {
        success: true,
        message: `WhatsApp account verified: ${displayNumber}${verifiedName}`,
      };
    } catch (err: any) {
      const metaError = err?.response?.data?.error;
      const msg = metaError
        ? `Meta API error: ${metaError.message || metaError.code}`
        : `Failed to reach Meta API — check your Access Token and Phone Number ID.`;
      return { success: false, message: msg };
    }
  }

  // Call Twilio API to verify Account SID + Auth Token
  private async pingTelephony(cfg: Record<string, any>): Promise<{ success: boolean; message: string }> {
    const { accountSid, authToken } = cfg;
    if (!accountSid || !authToken) {
      return { success: false, message: 'Account SID and Auth Token are required.' };
    }
    try {
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const res = await axios.get(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
        {
          headers: { Authorization: `Basic ${auth}` },
          timeout: 10000,
        }
      );
      const data = res.data as any;
      const status = data.status || 'active';
      const friendlyName = data.friendly_name ? ` (${data.friendly_name})` : '';
      return {
        success: true,
        message: `Twilio account verified: ${status}${friendlyName}`,
      };
    } catch (err: any) {
      const twilioError = err?.response?.data;
      const msg = twilioError
        ? `Twilio API error: ${twilioError.message || twilioError.code || err.message}`
        : `Failed to reach Twilio API — check your Account SID and Auth Token.`;
      return { success: false, message: msg };
    }
  }
}
