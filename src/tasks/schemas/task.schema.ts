import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TaskType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
  FOLLOW_UP = 'FOLLOW_UP',
  TODO = 'TODO',
}

export type TaskDocument = Task & Document;

@Schema({ timestamps: true, collection: 'tasks' })
export class Task {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  createdBy: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ type: String, enum: TaskPriority, default: TaskPriority.MEDIUM, index: true })
  priority: TaskPriority;

  @Prop({ type: String, enum: TaskStatus, default: TaskStatus.TODO, index: true })
  status: TaskStatus;

  @Prop({ type: String, enum: TaskType, default: TaskType.TODO })
  taskType: TaskType;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Lead', index: true })
  leadId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Deal', index: true })
  dealId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true })
  assignedTo: MongooseSchema.Types.ObjectId;

  @Prop({ index: true })
  dueDate: Date;

  @Prop()
  remindedAt: Date;

  @Prop()
  completedAt: Date;

  @Prop()
  aiStrategy: string;

  @Prop({ default: false, index: true })
  isDeleted: boolean;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

// Compound Indexes
TaskSchema.index({ tenantId: 1, assignedTo: 1, dueDate: 1 });
TaskSchema.index({ tenantId: 1, leadId: 1 });
TaskSchema.index({ tenantId: 1, dealId: 1 });
TaskSchema.index({ tenantId: 1, status: 1 });
TaskSchema.index({ tenantId: 1, priority: 1 });
TaskSchema.index({ tenantId: 1, dueDate: 1 });
