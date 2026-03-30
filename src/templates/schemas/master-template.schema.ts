import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MasterTemplateDocument = MasterTemplate & Document;

export enum TemplateCategory {
  MARKETING = 'MARKETING',
  UTILITY = 'UTILITY',
  AUTHENTICATION = 'AUTHENTICATION',
}

@Schema({ timestamps: true, collection: 'crm_master_templates' })
export class MasterTemplate {
  @Prop({ required: true, enum: TemplateCategory, default: TemplateCategory.UTILITY })
  templateCategory: TemplateCategory;

  @Prop({ required: true, unique: true, trim: true })
  templateName: string;

  @Prop({ required: true, default: 'en_US' })
  languageCode: string;

  @Prop({ default: 'NAMED' })
  paramType: string;

  @Prop({ default: 'NONE' }) // TEXT, IMAGE, DOCUMENT, VIDEO, NONE
  headerType: string;

  @Prop({ type: Object })
  headerMedia: Record<string, any>;

  @Prop()
  headerText: string;

  @Prop()
  footerText: string;

  @Prop({ required: true })
  bodyText: string;

  @Prop({ type: [String], default: [] })
  bodyParams: string[];

  @Prop({ type: [String], default: [] })
  headerParams: string[];

  @Prop({ type: [Object], default: [] })
  quickButtons: any[];

  @Prop()
  event: string; // e.g., "NEW_LEAD", "SITE_VISIT_CONFIRMED"
}

export const MasterTemplateSchema = SchemaFactory.createForClass(MasterTemplate);
