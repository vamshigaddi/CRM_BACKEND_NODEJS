import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ConversationDocument = Conversation & Document;

@Schema({
  timestamps: true,
  collection: "crm_conversations",
})
export class Conversation {

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
  leadId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    required: true,
    index: true,
  })
  integrationId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ["whatsapp", "email"],
  })
  channel: string;

  @Prop({
    type: Types.ObjectId,
    index: true,
  })
  assignedTo?: Types.ObjectId; // sales user

  @Prop()
  lastMessageAt?: Date;

  @Prop({
    default: 0,
  })
  unreadCount: number;

  @Prop({
    enum: ["open", "closed"],
    default: "open",
  })
  status: string;
}

export const ConversationSchema =
  SchemaFactory.createForClass(Conversation);

ConversationSchema.index({
  tenantId: 1,
  leadId: 1,
  channel: 1,
});
