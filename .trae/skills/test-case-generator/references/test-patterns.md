# Test Patterns by Code Layer

Common test case patterns to apply when analyzing each code layer. Use these as checklists
to ensure no test scenario is missed.

## Table of Contents
- [Server Actions](#server-actions)
- [DAL Query Functions](#dal-query-functions)
- [Page Routes](#page-routes)
- [Client Interactions](#client-interactions)
- [Auth Flow](#auth-flow)
- [Workflow / State Machine](#workflow--state-machine)
- [Agent / AI System](#agent--ai-system)
- [Event-Driven Automation](#event-driven-automation)
- [Database Constraints](#database-constraints)
- [Multi-Tenant Isolation](#multi-tenant-isolation)

---

## Server Actions

For each `export async function` in action files:

| Pattern | Priority | Type |
|---------|----------|------|
| Valid input → success response | P1 | Unit |
| Missing required fields → error | P1 | Unit |
| Unauthenticated call → redirect/error | P0 | Unit |
| Wrong organization → access denied | P0 | Unit |
| Duplicate creation → constraint error | P2 | Unit |
| After success → revalidatePath called | P2 | Integration |
| Concurrent calls → no race condition | P3 | Integration |

## DAL Query Functions

For each exported query function:

| Pattern | Priority | Type |
|---------|----------|------|
| Normal query → correct data shape | P1 | Integration |
| Empty result → returns empty array/null | P1 | Integration |
| Org-scoped → only returns own org data | P0 | Integration |
| Pagination params → correct slicing | P2 | Integration |
| Filter/search params → correct filtering | P2 | Integration |
| Joined relations → includes related data | P2 | Integration |

## Page Routes

For each `page.tsx`:

| Pattern | Priority | Type |
|---------|----------|------|
| Authenticated → renders page | P1 | E2E |
| Unauthenticated → redirect to login | P0 | E2E |
| Data loads → displays correct content | P1 | E2E |
| DB unavailable → error boundary / fallback | P2 | E2E |
| Empty data → shows empty state | P2 | E2E |

## Client Interactions

For each interactive component (`*-client.tsx`):

| Pattern | Priority | Type |
|---------|----------|------|
| Button click → triggers action | P1 | E2E |
| Form submit valid → success feedback | P1 | E2E |
| Form submit invalid → validation errors | P1 | E2E |
| Dialog open → displays correct content | P2 | E2E |
| Dialog confirm → executes action | P1 | E2E |
| Dialog cancel → no side effects | P2 | E2E |
| Loading state → shows spinner/skeleton | P3 | E2E |
| Error state → shows error message | P2 | E2E |

## Auth Flow

| Pattern | Priority | Type |
|---------|----------|------|
| Valid credentials → login success + redirect | P0 | E2E |
| Invalid password → error message | P0 | E2E |
| Non-existent email → error message | P0 | E2E |
| Session expired → redirect to login | P0 | E2E |
| Middleware → refreshes cookies on request | P1 | Integration |
| Sign out → clears session + redirect | P0 | E2E |
| Register → creates user + org | P0 | E2E |
| Register duplicate email → error | P1 | E2E |

## Workflow / State Machine

| Pattern | Priority | Type |
|---------|----------|------|
| Create instance → status = pending | P0 | Integration |
| Start → executes first step | P0 | Integration |
| Step complete → advances to next step | P0 | Integration |
| All steps complete → status = completed | P0 | Integration |
| Step fails → status = failed + error logged | P0 | Integration |
| Approval required → pauses for review | P1 | Integration |
| Approve → resumes execution | P1 | Integration |
| Reject → re-executes with feedback | P1 | Integration |
| Timeout → auto-approve/reject/escalate | P2 | Integration |
| Quality gate fail → escalation triggered | P2 | Integration |
| Token budget exceeded → graceful stop | P2 | Integration |
| Artifacts → persisted after each step | P1 | Integration |

## Agent / AI System

| Pattern | Priority | Type |
|---------|----------|------|
| Assembly → loads employee + skills + knowledge | P1 | Unit |
| System prompt → contains all 7 layers | P1 | Unit |
| Tool registry → filters by authority level | P1 | Unit |
| Tool execution → returns structured result | P1 | Integration |
| Missing API key → graceful error | P2 | Unit |
| Max steps reached → stops execution | P2 | Integration |

## Event-Driven Automation

| Pattern | Priority | Type |
|---------|----------|------|
| Event emitted → handler triggered | P1 | Integration |
| Handler success → side effects applied | P1 | Integration |
| Handler failure → retried / error logged | P2 | Integration |
| Duplicate event → idempotent handling | P2 | Integration |

## Database Constraints

| Pattern | Priority | Type |
|---------|----------|------|
| NOT NULL field → insert null → error | P2 | Unit |
| UNIQUE constraint → duplicate → error | P2 | Unit |
| FK constraint → invalid ref → error | P2 | Unit |
| Enum field → invalid value → error | P2 | Unit |
| Cascade delete → removes related records | P2 | Integration |

## Multi-Tenant Isolation

| Pattern | Priority | Type |
|---------|----------|------|
| Query with org_id A → no org_id B data | P0 | Integration |
| Action with org_id A → cannot modify B | P0 | Integration |
| User switches org → sees new org data only | P1 | E2E |
