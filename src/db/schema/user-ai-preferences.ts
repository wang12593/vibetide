import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";

export interface FrequentIntent {
  intentType: string;
  count: number;
  lastTriggered: string;
}

export interface PreferredAssignment {
  intentType: string;
  steps: { employeeSlug: string; skills: string[] }[];
  userConfirmed: number;
  userEdited: number;
}

export const userAiPreferences = pgTable("user_ai_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  frequentIntents: jsonb("frequent_intents")
    .$type<FrequentIntent[]>()
    .default([])
    .notNull(),
  preferredAssignments: jsonb("preferred_assignments")
    .$type<PreferredAssignment[]>()
    .default([])
    .notNull(),
  communicationPreference: text("communication_preference"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userAiPreferencesRelations = relations(
  userAiPreferences,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [userAiPreferences.organizationId],
      references: [organizations.id],
    }),
  }),
);
