import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MasterTemplate, MasterTemplateDocument, TemplateCategory } from './schemas/master-template.schema';
import { TenantTemplate, TenantTemplateDocument, TenantTemplateStatus } from './schemas/tenant-template.schema';

@Injectable()
export class TemplatesService implements OnModuleInit {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    @InjectModel(MasterTemplate.name) private masterTemplateModel: Model<MasterTemplateDocument>,
    @InjectModel(TenantTemplate.name) private tenantTemplateModel: Model<TenantTemplateDocument>,
  ) {}

  async onModuleInit() {
    await this.seedMasterTemplates();
  }

  private async seedMasterTemplates() {
    const templates = [
      {
        templateName: 'new_lead',
        languageCode: 'en_US',
        templateCategory: TemplateCategory.UTILITY,
        bodyText: `Hi {{lead_name}},\n\nThank you for your interest in {{project_name}} 😊\n\nI’m {{rep_name}} from {{company_name}} Real Estate. I’d love to understand your requirement better.\n\nAre you looking to buy or invest?\n• Budget: {{budget}}\n• Preferred location: {{location}}\n• Property type: Apartment / Villa / Plot\n\nLet me know a good time to call you 📞`,
        bodyParams: ['lead_name', 'project_name', 'rep_name', 'company_name', 'budget', 'location'],
        event: 'NEW_LEAD',
        headerType: 'NONE',
        paramType: 'NAMED'
      },
      {
        templateName: 'site_visit_confirmation',
        languageCode: 'en_US',
        templateCategory: TemplateCategory.UTILITY,
        bodyText: `Hi {{lead_name}},\n\nYour site visit for {{project_name}} is confirmed ✅\n\n📍 Location: {{location}}\n📅 Date: {{date}}\n⏰ Time: {{time}}\n\nLooking forward to meeting you!`,
        bodyParams: ['lead_name', 'project_name', 'location', 'date', 'time'],
        event: 'SITE_VISIT_CONFIRMATION',
        headerType: 'NONE',
        paramType: 'NAMED'
      },
      {
        templateName: 'site_visit_reminder',
        languageCode: 'en_US',
        templateCategory: TemplateCategory.UTILITY,
        bodyText: `Hi {{lead_name}},\n\nJust a reminder about your visit to {{project_name}} tomorrow at {{time}} ⏰\n\nSharing location here: {{location_link}}\n\nSee you soon!`,
        bodyParams: ['lead_name', 'project_name', 'time', 'location_link'],
        event: 'SITE_VISIT_REMINDER',
        headerType: 'NONE',
        paramType: 'NAMED'
      },
      {
        templateName: 'booking_confirmation',
        languageCode: 'en_US',
        templateCategory: TemplateCategory.UTILITY,
        bodyText: `Congratulations {{lead_name}}! 🎉\n\nYour unit in {{project_name}} has been successfully booked.\n\n🏠 Unit No: {{unit_number}}\n💰 Booking Amount: {{amount}}\n📅 Agreement Date: {{date}}\n\nWelcome to your new investment!`,
        bodyParams: ['lead_name', 'project_name', 'unit_number', 'amount', 'date'],
        event: 'BOOKING_CONFIRMATION',
        headerType: 'NONE',
        paramType: 'NAMED'
      },
    ];

    for (const t of templates) {
      await this.masterTemplateModel.updateOne(
        { templateName: t.templateName },
        { $set: t },
        { upsert: true }
      ).exec();
    }
    this.logger.log('WhatsApp Master Templates seeded/updated.');
  }

  async assignTemplatesToTenant(tenantId: string) {
    const masterTemplates = await this.masterTemplateModel.find().exec();
    const tId = new Types.ObjectId(tenantId);

    for (const mt of masterTemplates) {
      await this.tenantTemplateModel.updateOne(
        { tenantId: tId, masterTemplateId: mt._id },
        {
          $set: {
            tenantId: tId,
            masterTemplateId: mt._id,
            category: mt.templateCategory,
            templateName: mt.templateName,
            event: mt.event,
            templateStatus: TenantTemplateStatus.PENDING,
            enabled: true,
          }
        },
        { upsert: true }
      ).exec();
    }
  }

  async getTenantTemplates(tenantId: string): Promise<any[]> {
    const tenantTemplates = await this.tenantTemplateModel.find({ 
      tenantId: new Types.ObjectId(tenantId),
      enabled: true 
    })
    .populate('masterTemplateId')
    .exec();

    return tenantTemplates.map(t => {
      const mt = t.masterTemplateId as unknown as MasterTemplate;
      return {
        _id: t._id,
        metaTemplateId: t.metaTemplateId,
        templateName: t.templateName,
        languageCode: mt?.languageCode,
        category: t.category,
        bodyText: mt?.bodyText,
        bodyParams: mt?.bodyParams,
        headerType: mt?.headerType,
        headerText: mt?.headerText,
        footerText: mt?.footerText,
        templateStatus: t.templateStatus,
        event: t.event,
        enabled: t.enabled
      };
    });
  }
}
