import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./users";

export const mcpToolInvocations = pgTable(
  "mcp_tool_invocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: text("request_id").notNull(),
    adapterId: text("adapter_id").notNull(),
    toolName: text("tool_name").notNull(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull(),
    source: text("source").notNull(),
    inputSummary: jsonb("input_summary").$type<Record<string, unknown>>(),
    resultStatus: text("result_status").notNull(),
    errorCode: text("error_code"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    requestIdx: index("mcp_tool_invocations_request_idx").on(table.requestId),
    orgCreatedIdx: index("mcp_tool_invocations_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    toolCreatedIdx: index("mcp_tool_invocations_tool_created_idx").on(
      table.toolName,
      table.createdAt,
    ),
  }),
);

export const mcpToolInvocationsRelations = relations(
  mcpToolInvocations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [mcpToolInvocations.organizationId],
      references: [organizations.id],
    }),
  }),
);
