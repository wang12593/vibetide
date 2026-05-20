import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { savedConversations } from "./saved-conversations";
import { senderTypeEnum, messageTypeEnum } from "./enums";

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .references(() => savedConversations.id, { onDelete: "cascade" })
      .notNull(),
    seqNum: integer("seq_num").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    senderType: senderTypeEnum("sender_type"),
    senderId: text("sender_id"),
    messageType: messageTypeEnum("message_type").default("text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    parentMessageId: uuid("parent_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
  },
  (table) => ({
    convSeqUidx: uniqueIndex("conv_messages_conv_seq_uidx").on(
      table.conversationId,
      table.seqNum
    ),
  })
);

export const conversationMessagesRelations = relations(
  conversationMessages,
  ({ one }) => ({
    conversation: one(savedConversations, {
      fields: [conversationMessages.conversationId],
      references: [savedConversations.id],
    }),
    organization: one(organizations, {
      fields: [conversationMessages.organizationId],
      references: [organizations.id],
    }),
    parentMessage: one(conversationMessages, {
      fields: [conversationMessages.parentMessageId],
      references: [conversationMessages.id],
      relationName: "messageReplies",
    }),
  })
);
