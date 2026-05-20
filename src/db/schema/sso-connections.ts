import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { userProfiles } from "./users";
import { organizations } from "./users";

export const ssoConnections = pgTable(
  "sso_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => userProfiles.id)
      .notNull(),
    provider: varchar("provider", { length: 32 }).notNull(),
    externalUserId: varchar("external_user_id", { length: 128 }).notNull(),
    externalOrgId: varchar("external_org_id", { length: 128 }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    providerExternalUidx: uniqueIndex("sso_connections_provider_ext_uidx").on(
      table.provider,
      table.externalUserId
    ),
  })
);

export const ssoConnectionsRelations = relations(ssoConnections, ({ one }) => ({
  user: one(userProfiles, {
    fields: [ssoConnections.userId],
    references: [userProfiles.id],
  }),
  organization: one(organizations, {
    fields: [ssoConnections.organizationId],
    references: [organizations.id],
  }),
}));
