import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type MessageDocument = Message & Document;

@Schema({
  timestamps: true,
  collection: "crm_messages",
})
export class Message {

  @Prop({
    type: Types.ObjectId,
    required: true,
    index: true,
  })
  tenantId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    required: true,
    index: true,
  })
  conversationId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    required: true,
    index: true,
  })
  leadId: Types.ObjectId;

  @Prop()
  externalMessageId?: string; // WhatsApp message ID

  @Prop({
    required: true,
    enum: ["incoming", "outgoing"],
  })
  direction: string;

  @Prop({
    required: true,
    enum: ["text", "template", "image", "document"],
  })
  type: string;

  @Prop({
    required: true,
  })
  content: string;

  @Prop()
  templateName?: string;

  @Prop({
    enum: ["sent", "delivered", "read", "failed"],
  })
  status?: string;

  @Prop({
    type: Object,
  })
  rawPayload?: any;
}

export const MessageSchema =
  SchemaFactory.createForClass(Message);

MessageSchema.index({ conversationId: 1, createdAt: -1 });
