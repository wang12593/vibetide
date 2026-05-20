import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, inArray, sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

import { config } from "dotenv";
config({ path: ".env.local" });
config();

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

async function cleanup() {
  console.log("🧹 Continuing selective cleanup...\n");

  const existingOrg = await db.query.organizations.findFirst({
    orderBy: (o, { asc }) => [asc(o.createdAt)],
  });
  if (!existingOrg) { console.log("No org found."); process.exit(0); }
  const orgId = existingOrg.id;
  console.log(`Org: ${existingOrg.name} (${orgId})\n`);

  // Clean knowledge bases (skip documents table if not exists)
  console.log("1. Cleaning knowledge bases...");
  try {
    const delKB = await db.delete(schema.knowledgeBases).where(eq(schema.knowledgeBases.organizationId, orgId)).returning({ id: schema.knowledgeBases.id });
    console.log(`   Deleted ${delKB.length} knowledge bases`);
  } catch (e: any) {
    console.log(`   Knowledge bases: ${e.message?.slice(0, 80)}`);
  }

  // Clean knowledge nodes + relations
  console.log("2. Cleaning knowledge graph...");
  try {
    await db.delete(schema.knowledgeRelations_).returning({ id: schema.knowledgeRelations_.id });
  } catch {}
  const delKNodes = await db.delete(schema.knowledgeNodes).where(eq(schema.knowledgeNodes.organizationId, orgId)).returning({ id: schema.knowledgeNodes.id });
  console.log(`   Deleted ${delKNodes.length} knowledge nodes`);

  // Clean categories
  console.log("3. Cleaning categories...");
  const delCats = await db.delete(schema.categories).where(eq(schema.categories.organizationId, orgId)).returning({ id: schema.categories.id });
  console.log(`   Deleted ${delCats.length} categories`);

  // Reset employee stats
  console.log("4. Resetting employee stats...");
  const updated = await db
    .update(schema.aiEmployees)
    .set({
      tasksCompleted: 0,
      accuracy: 0,
      satisfaction: 0,
      currentTask: null,
      status: "idle",
      avgResponseTime: "0s",
    })
    .where(eq(schema.aiEmployees.organizationId, orgId))
    .returning({ id: schema.aiEmployees.id });
  console.log(`   Reset ${updated.length} employees\n`);

  // Verify remaining data
  console.log("=== Verification ===");
  const missionCount = await db.select({ count: sql<number>`count(*)::int` }).from(schema.missions).where(eq(schema.missions.organizationId, orgId));
  const articleCount = await db.select({ count: sql<number>`count(*)::int` }).from(schema.articles).where(eq(schema.articles.organizationId, orgId));
  const channelCount = await db.select({ count: sql<number>`count(*)::int` }).from(schema.channels).where(eq(schema.channels.organizationId, orgId));
  const assetCount = await db.select({ count: sql<number>`count(*)::int` }).from(schema.mediaAssets).where(eq(schema.mediaAssets.organizationId, orgId));
  const kbCount = await db.select({ count: sql<number>`count(*)::int` }).from(schema.knowledgeBases).where(eq(schema.knowledgeBases.organizationId, orgId));
  const empCount = await db.select({ count: sql<number>`count(*)::int` }).from(schema.aiEmployees).where(eq(schema.aiEmployees.organizationId, orgId));
  const skillCount = await db.select({ count: sql<number>`count(*)::int` }).from(schema.skills).where(eq(schema.skills.organizationId, orgId));
  const wfCount = await db.select({ count: sql<number>`count(*)::int` }).from(schema.workflowTemplates).where(eq(schema.workflowTemplates.organizationId, orgId));

  console.log(`  Missions:    ${missionCount[0].count}`);
  console.log(`  Articles:    ${articleCount[0].count}`);
  console.log(`  Channels:    ${channelCount[0].count}`);
  console.log(`  MediaAssets: ${assetCount[0].count}`);
  console.log(`  KnowledgeBases: ${kbCount[0].count}`);
  console.log(`  Employees:   ${empCount[0].count} (preserved)`);
  console.log(`  Skills:      ${skillCount[0].count} (preserved)`);
  console.log(`  Workflows:   ${wfCount[0].count} (preserved)`);

  console.log("\n✅ Cleanup complete!");
  await client.end();
}

cleanup().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
