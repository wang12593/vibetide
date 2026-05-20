# Multi-Tenant Query Safety — Always Filter by organizationId

**Extracted:** 2026-03-22
**Context:** Any multi-tenant system using Drizzle ORM with shared tables that have an `organization_id` column

## Problem

In multi-tenant systems, `findFirst()` or `findMany()` queries that match by a non-unique field (like `slug`) without filtering by `organizationId` will silently return rows from the wrong tenant. This is especially dangerous with:

- `findFirst()` — returns an arbitrary match across all orgs
- Entity lookups used as foreign keys — creates cross-tenant data relationships
- Queries in server actions — the caller's org context is available but not used

**Real example:** `startMission()` searched for a "leader" employee by slug without org filter. The only leader existed in org B, but the user was in org A. The mission was created linking org A's data to org B's employee.

## Solution

1. **Every query on a shared table MUST include `organizationId`** in the WHERE clause
2. Use `and()` to combine entity-specific filters with org filter:

```typescript
// BAD — cross-tenant leak
const leader = await db.query.aiEmployees.findFirst({
  where: eq(aiEmployees.slug, "leader"),
});

// GOOD — scoped to user's org
const leader = await db.query.aiEmployees.findFirst({
  where: and(
    eq(aiEmployees.slug, "leader"),
    eq(aiEmployees.organizationId, organizationId)
  ),
});
```

3. When the entity might not exist in the current org, **auto-provision** rather than throw

## When to Use

- Writing any DB query in server actions, DAL functions, or Inngest functions
- Any `findFirst()` call on a table with `organization_id` column
- Code review: flag any query missing org filter as a potential cross-tenant bug
- Especially important for: employee lookups, team queries, skill resolution, knowledge base access
