import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export enum IntegrationType {
  WHATSAPP = "whatsapp",
  EMAIL = "email",
  TELEPHONY = "telephony",
}

export enum IntegrationStatus {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  ERROR = "error",
}

export type IntegrationDocument = Integration & Document;

@Schema({
  timestamps: true,
  collection: "crm_integrations",
})
export class Integration {

  @Prop({
    type: Types.ObjectId,
    required: true,
    index: true,
  })
  tenantId: Types.ObjectId;

  @Prop({
    required: true,
    enum: IntegrationType,
  })
  integrationType: IntegrationType;

  @Prop({
    type: Object,
    default: {},
  })
  integrationConfig: Record<string, any>;

  @Prop({
    enum: IntegrationStatus,
    default: IntegrationStatus.DISCONNECTED,
  })
  status: IntegrationStatus;

  @Prop({
    default: true,
  })
  isActive: boolean;

  @Prop()
  lastSyncedAt?: Date;

  @Prop()
  errorMessage?: string;
}

export const IntegrationSchema =
  SchemaFactory.createForClass(Integration);

IntegrationSchema.index(
  { tenantId: 1, integrationType: 1 },
  { unique: true }
);
