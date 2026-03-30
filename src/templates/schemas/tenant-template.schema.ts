import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TenantTemplateDocument = TenantTemplate & Document;

export enum TenantTemplateStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Schema({ timestamps: true, collection: 'crm_tenant_templates' })
export class TenantTemplate {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId: Types.ObjectId; // storeRef

  @Prop({ type: Types.ObjectId, ref: 'MasterTemplate', required: true })
  masterTemplateId: Types.ObjectId;

  @Prop()
  metaTemplateId: string; // ID from Meta

  @Prop({ required: true })
  category: string;

  @Prop({ enum: TenantTemplateStatus, default: TenantTemplateStatus.PENDING })
  templateStatus: TenantTemplateStatus;

  @Prop({ required: true })
  templateName: string;

  @Prop()
  event: string;

  @Prop({ default: true })
  enabled: boolean;
}

export const TenantTemplateSchema = SchemaFactory.createForClass(TenantTemplate);

TenantTemplateSchema.index({ tenantId: 1, masterTemplateId: 1 }, { unique: true });
