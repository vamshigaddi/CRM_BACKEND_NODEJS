import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum LeadUrgency {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum LeadDataSource {
  WHATSAPP = 'WHATSAPP',
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  WEBSITE = 'WEBSITE',
  FACEBOOK = 'FACEBOOK',
  IMPORT = 'IMPORT',
  MANUAL = 'MANUAL',
}

export enum LeadSentiment {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
}

export enum LeadStatus {
  OPEN = 'OPEN',
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  WON = 'WON',
  LOST = 'LOST',
}

@Schema({ _id: false })
export class LeadCompany {
  @Prop()
  name: string;

  @Prop()
  website: string;

  @Prop()
  industry: string;

  @Prop()
  size: string;

  @Prop()
  designation: string;
}

@Schema({ _id: false })
export class LeadIntent {
  @Prop()
  product: string;

  @Prop()
  budget: number;

  @Prop()
  budgetMin: number;

  @Prop()
  budgetMax: number;

  @Prop({ type: String, enum: LeadUrgency })
  urgency: LeadUrgency;

  @Prop()
  timeline: string;
}

@Schema({ _id: false })
export class StrategicInsights {
  @Prop()
  nextBestAction: string;

  @Prop()
  nextBestActionWhy: string;

  @Prop([String])
  coachingTips: string[];

  @Prop([String])
  missedOpportunities: string[];

  @Prop({ default: false })
  isHighValue: boolean;

  @Prop({ default: false })
  isAtRisk: boolean;

  @Prop({ default: false })
  escalationRequired: boolean;

  @Prop()
  lastProcessedAt: Date;
}

export type LeadDocument = Lead & Document;

@Schema({ timestamps: true, collection: 'leads' })
export class Lead {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: MongooseSchema.Types.ObjectId;

  @Prop({ index: true })
  name: string;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop({ required: true, index: true })
  phoneNumber: string;

  @Prop({ index: true })
  mobileNumber: string;

  @Prop({ index: true })
  whatsappNumber: string;

  @Prop({ index: true })
  email: string;

  // optional organization/company name; used in frontend for displaying organizational affiliation
  @Prop({ index: true })
  organization: string;

  @Prop({ type: LeadCompany, default: () => ({}) })
  company: LeadCompany;

  @Prop({ type: LeadIntent, default: () => ({}) })
  intent: LeadIntent;

  @Prop({ index: true })
  stage: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  assignedTo: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  assignedBy: MongooseSchema.Types.ObjectId;

  @Prop({ default: true, index: true })
  hasWhatsapp: boolean;

  @Prop({ type: String, enum: LeadDataSource, index: true })
  source: LeadDataSource;

  @Prop({ index: true })
  aiScore: number;

  @Prop({ index: true })
  leadScore: number;

  @Prop()
  aiSummary: string;

  @Prop({ type: StrategicInsights, default: () => ({}) })
  strategicInsights: StrategicInsights;

  @Prop({ type: String, enum: LeadSentiment })
  sentiment: LeadSentiment;

  @Prop()
  lastActivityAt: Date;

  @Prop()
  nextFollowUpAt: Date;

  @Prop({ type: String, enum: LeadStatus, default: LeadStatus.OPEN, index: true })
  status: LeadStatus;

  @Prop({ type: MongooseSchema.Types.Map, of: MongooseSchema.Types.Mixed, default: {} })
  customFields: Map<string, any>;

  @Prop()
  notes: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  createdBy: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, enum: LeadDataSource })
  createdFrom: LeadDataSource;
  
  @Prop({ default: false, index: true })
  isDeleted: boolean;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

const formatPhoneNumber = (phone: string) => {
  if (!phone) return phone;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `91${cleaned}`;
  if (cleaned.length === 12) return cleaned;
  return cleaned && cleaned.length > 0 ? cleaned : phone;
};

LeadSchema.pre('save', function () {
  if (this.phoneNumber) {
    this.phoneNumber = formatPhoneNumber(this.phoneNumber);
  }
  if (this.mobileNumber) {
    this.mobileNumber = formatPhoneNumber(this.mobileNumber);
  }
  if (this.whatsappNumber) {
    this.whatsappNumber = formatPhoneNumber(this.whatsappNumber);
  }
});

LeadSchema.pre(/updateOne|findOneAndUpdate/, function () {
  const query = this as any;
  const update = query.getUpdate();
  if (!update) return;

  if (update.phoneNumber) update.phoneNumber = formatPhoneNumber(update.phoneNumber);
  if (update.$set && update.$set.phoneNumber) update.$set.phoneNumber = formatPhoneNumber(update.$set.phoneNumber);

  if (update.mobileNumber) update.mobileNumber = formatPhoneNumber(update.mobileNumber);
  if (update.$set && update.$set.mobileNumber) update.$set.mobileNumber = formatPhoneNumber(update.$set.mobileNumber);

  if (update.whatsappNumber) update.whatsappNumber = formatPhoneNumber(update.whatsappNumber);
  if (update.$set && update.$set.whatsappNumber) update.$set.whatsappNumber = formatPhoneNumber(update.$set.whatsappNumber);
});

// Compound Indexes
LeadSchema.index({ tenantId: 1, phoneNumber: 1 });
LeadSchema.index({ tenantId: 1, assignedTo: 1 });
LeadSchema.index({ tenantId: 1, stage: 1 });
LeadSchema.index({ tenantId: 1, status: 1 });
LeadSchema.index({ tenantId: 1, source: 1 });
LeadSchema.index({ tenantId: 1, aiScore: 1 });
LeadSchema.index({ tenantId: 1, leadScore: 1 });

