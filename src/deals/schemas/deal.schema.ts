import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';


export enum DealStatus {
  OPEN = 'OPEN',
  WON = 'WON',
  LOST = 'LOST',
}

export type DealDocument = Deal & Document;

@Schema({ timestamps: true, collection: 'deals' })
export class Deal {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Lead', required: true, index: true })
  leadId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ default: 0 })
  value: number;

  @Prop({ default: 0 })
  budgetMin: number;

  @Prop({ default: 0 })
  budgetMax: number;

  @Prop({ type: String, index: true })
  stage: string;

  @Prop()
  probability: number;

  @Prop()
  expectedCloseDate: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  assignedTo: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, enum: DealStatus, default: DealStatus.OPEN, index: true })
  status: DealStatus;

  @Prop()
  closedAt: Date;

  @Prop()
  closingValue: number;

  @Prop()
  closingNotes: string;

  @Prop()
  lostReason: string;

  @Prop({ type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' })
  priority: string;

  @Prop()
  dealType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  createdBy: MongooseSchema.Types.ObjectId;
  
  @Prop({ default: false, index: true })
  isDeleted: boolean;
}

export const DealSchema = SchemaFactory.createForClass(Deal);

// Compound Indexes
DealSchema.index({ tenantId: 1, leadId: 1 });
DealSchema.index({ tenantId: 1, stage: 1 });
DealSchema.index({ tenantId: 1, status: 1 });
DealSchema.index({ tenantId: 1, assignedTo: 1 });
DealSchema.index({ tenantId: 1, value: -1 });
