import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type VirtualNumberDocument = VirtualNumber & Document;

@Schema({ timestamps: true, collection: 'virtual_numbers' })
export class VirtualNumber {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null, index: true })
  assignedTo: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  phoneNumber: string;

  @Prop()
  region: string;

  @Prop({ default: 'Local' })
  type: string;

  @Prop({ default: 'Active' })
  status: string;

  @Prop({ type: [String], default: ['Voice'] })
  capabilities: string[];

  @Prop({ default: 'Twilio' })
  vendor: string;

  @Prop({ type: Object, default: {} })
  vendorMeta: Record<string, any>;
}

export const VirtualNumberSchema = SchemaFactory.createForClass(VirtualNumber);
