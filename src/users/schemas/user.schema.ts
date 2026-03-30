import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  SALES = 'SALES',
}

@Schema({ _id: false })
export class UserIntegrationIds {
  @Prop()
  whatsappUserId: string;

  @Prop()
  telephonyUserId: string;
}

export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: MongooseSchema.Types.ObjectId;

  @Prop()
  name: string;

  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop()
  phoneNumber: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.SALES })
  role: UserRole;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  reportingTo: MongooseSchema.Types.ObjectId;

  @Prop({ type: UserIntegrationIds, default: () => ({}) })
  integrationIds: UserIntegrationIds;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ type: Date, default: null })
  lastAssignedAt: Date;
  
  @Prop({ default: false, index: true })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  lastReadNotificationsAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

const formatPhoneNumber = (phone: string) => {
  if (!phone) return phone;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `91${cleaned}`;
  if (cleaned.length === 12) return cleaned;
  return cleaned && cleaned.length > 0 ? cleaned : phone;
};

UserSchema.pre('save', function () {
  if (this.phoneNumber) {
    this.phoneNumber = formatPhoneNumber(this.phoneNumber);
  }
});

UserSchema.pre(/updateOne|findOneAndUpdate/, function () {
  const query = this as any;
  const update = query.getUpdate();
  if (!update) return;

  if (update.phoneNumber) update.phoneNumber = formatPhoneNumber(update.phoneNumber);
  if (update.$set && update.$set.phoneNumber) update.$set.phoneNumber = formatPhoneNumber(update.$set.phoneNumber);
});
