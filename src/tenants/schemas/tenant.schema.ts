import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { randomUUID } from 'crypto';

@Schema({ _id: false })
export class PipelineStage {
  // Stable identifier — never changes even if name/title is renamed.
  // Generated once on creation; subsequent saves must preserve it.
  @Prop({ required: true, default: () => randomUUID() })
  id: string;

  // Human-readable display title — can be renamed freely.
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  order: number;

  @Prop({ default: 0, min: 0, max: 100 })
  probability: number;

  // optional tailwind color class (e.g. "bg-blue-500"); frontend will
  // derive hues if omitted.
  @Prop()
  color?: string;
}

@Schema({ _id: false })
export class AIConfig {
  @Prop({ default: true })
  autoLeadCapture: boolean;

  @Prop({ default: true })
  autoDealCreation: boolean;
}

@Schema({ _id: false })
export class Integrations {
  @Prop({ type: Object, default: null })
  whatsapp: any;

  @Prop({ type: Object, default: null })
  telephony: any;

  @Prop({ type: Object, default: null })
  email: any;
}

export type TenantDocument = Tenant & Document;

@Schema({ timestamps: true, collection: 'tenants' })
export class Tenant {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  tenantCode: string;

  @Prop()
  website: string;

  @Prop()
  email: string;

  @Prop()
  phone: string;

  @Prop()
  logo: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  ownerId: MongooseSchema.Types.ObjectId;

  @Prop({ type: [PipelineStage], default: [] })
  pipelineStages: PipelineStage[];

  @Prop({ type: AIConfig, default: () => ({}) })
  aiConfig: AIConfig;

  @Prop({ type: Integrations, default: () => ({}) })
  integrations: Integrations;

  @Prop({ default: true })
  isActive: boolean;
  
  @Prop({ default: false, index: true })
  isDeleted: boolean;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);

const formatPhoneNumber = (phone: string) => {
  if (!phone) return phone;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `91${cleaned}`;
  if (cleaned.length === 12) return cleaned;
  return cleaned && cleaned.length > 0 ? cleaned : phone;
};

TenantSchema.pre('save', function () {
  if (this.phone) {
    this.phone = formatPhoneNumber(this.phone);
  }
});

TenantSchema.pre(/updateOne|findOneAndUpdate/, function () {
  const query = this as any;
  const update = query.getUpdate();
  if (!update) return;

  if (update.phone) update.phone = formatPhoneNumber(update.phone);
  if (update.$set && update.$set.phone) update.$set.phone = formatPhoneNumber(update.$set.phone);
});
