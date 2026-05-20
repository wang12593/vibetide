import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./users";
import { clarificationStatusEnum } from "./enums";

export const clarificationSessions = pgTable("clarification_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  conversationId: text("conversation_id"),
  intentType: text("intent_type").notNull(),
  parameters: jsonb("parameters").$type<Record<string, string>>().default({}),
  rounds: jsonb("rounds")
    .$type<{ role: "system" | "user"; content: string; timestamp: number }[]>()
    .default([]),
  status: clarificationStatusEnum("status").notNull().default("active"),
  originalMessage: text("original_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
