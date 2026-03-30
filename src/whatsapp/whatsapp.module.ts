import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Activity, ActivitySchema } from '../activities/schemas/activity.schema';
import { Integration, IntegrationSchema } from '../integrations/schemas/integrations.schema';
import { Conversation, ConversationSchema } from '../integrations/schemas/conversations.schema';
import { Message, MessageSchema } from '../integrations/schemas/messages.schema';
import { TenantTemplate, TenantTemplateSchema } from '../templates/schemas/tenant-template.schema';
import { MasterTemplate, MasterTemplateSchema } from '../templates/schemas/master-template.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lead.name, schema: LeadSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: Integration.name, schema: IntegrationSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: TenantTemplate.name, schema: TenantTemplateSchema },
      { name: MasterTemplate.name, schema: MasterTemplateSchema },
    ]),
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService],
})
export class WhatsappModule {}
