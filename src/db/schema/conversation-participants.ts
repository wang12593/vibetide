import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { savedConversations } from "./saved-conversations";
import { participantRoleEnum, participantTypeEnum } from "./enums";

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .references(() => savedConversations.id, { onDelete: "cascade" })
      .notNull(),
    participantType: participantTypeEnum("participant_type").notNull(),
    participantId: text("participant_id").notNull(),
    role: participantRoleEnum("role").default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
  },
  (table) => ({
    convParticipantUidx: uniqueIndex(
      "conv_participants_conv_participant_uidx"
    ).on(table.conversationId, table.participantType, table.participantId),
  })
);

export const conversationParticipantsRelations = relations(
  conversationParticipants,
  ({ one }) => ({
    conversation: one(savedConversations, {
      fields: [conversationParticipants.conversationId],
      references: [savedConversations.id],
    }),
    organization: one(organizations, {
      fields: [conversationParticipants.organizationId],
      references: [organizations.id],
    }),
  })
);
