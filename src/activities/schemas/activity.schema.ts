import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum ActivityType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
  WHATSAPP = 'WHATSAPP',
  NOTE = 'NOTE',
  STAGE_CHANGE = 'STAGE_CHANGE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  ASSIGNMENT = 'ASSIGNMENT',
  SYSTEM = 'SYSTEM',
  TASK = 'TASK',
}

export type ActivityDocument = Activity & Document;

@Schema({ timestamps: true, collection: 'activities' })
export class Activity {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, enum: ActivityType, required: true, index: true })
  type: ActivityType;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Lead', index: true })
  leadId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Deal', index: true })
  dealId: MongooseSchema.Types.ObjectId;

  @Prop()
  content: string;

  @Prop({ type: MongooseSchema.Types.Map, of: MongooseSchema.Types.Mixed, default: {} })
  meta: Map<string, any>;

  @Prop({ default: Date.now, index: -1 })
  activityTime: Date;

  @Prop({ default: false })
  aiGenerated: boolean;

  @Prop({ type: Number, default: 0 })
  totalTokens: number;

  @Prop({ type: Number, default: 0 })
  intelligenceCost: number;

  @Prop({ type: MongooseSchema.Types.Map, of: Number, default: {} })
  tokenBreakdown: Map<string, number>;
  
  @Prop({ default: false, index: true })
  isDeleted: boolean;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);

// Compound Indexes
ActivitySchema.index({ tenantId: 1, leadId: 1, activityTime: -1 });
ActivitySchema.index({ tenantId: 1, dealId: 1, activityTime: -1 });
ActivitySchema.index({ tenantId: 1, userId: 1, activityTime: -1 });
ActivitySchema.index({ tenantId: 1, type: 1 });
ActivitySchema.index({ tenantId: 1, activityTime: -1 });
