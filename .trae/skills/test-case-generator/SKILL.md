---
name: test-case-generator
description: >-
  Generate comprehensive test cases by cross-analyzing codebase, requirement documents, test
  plans, and implementation plans. Use when: (1) user asks to generate "test cases", "测试用例",
  "test plan", "测试方案", or "QA cases", (2) user wants to know "what should be tested" or
  "how to verify this feature", (3) user asks for test coverage analysis against requirements,
  (4) user wants to produce a test case document from existing code and specs. Triggers on
  keywords: test cases, 测试用例, 生成测试, generate tests, QA, test coverage, 测试覆盖,
  验收测试, acceptance test, regression test, 回归测试.
---

# Test Case Generator

Generate a detailed test case document by analyzing requirement docs, test plans, implementation
plans, and codebase. Output covers functional, integration, E2E, and boundary tests.

## Workflow

```
1. Gather inputs       → Locate docs, plans, test plans, and code directories
2. Analyze requirements → Extract acceptance criteria per feature
3. Analyze test plans   → Incorporate existing test strategy and scenarios
4. Analyze code         → Derive testable functions, flows, and interactions
5. Generate test cases  → Apply test patterns per code layer
6. Cross-reference      → Ensure requirement → case traceability
7. Output               → Write structured test case document
```

## Step 1: Gather Inputs

Identify or ask the user for:

1. **Module grouping** — How to organize test cases into modules (check CLAUDE.md or
   requirement docs for existing definitions; confirm with user)
2. **Requirement docs** — Glob `docs/requirement/**/*.md` (or user-specified)
3. **Test plans** — Glob `docs/plans/*test*`, `docs/test*`, or user-specified test strategy docs
4. **Implementation plans** — Glob `docs/plans/**/*.md` (or user-specified)
5. **Function list** — Check if `docs/plans/system-function-list.md` exists (output from
   the function-list-analyzer skill); if so, use it as the master feature inventory
6. **Code directories** — Auto-detect from project structure:

| Layer | Typical Paths | What to Extract |
|-------|--------------|-----------------|
| Server Actions | `src/app/actions/*.ts`, `src/api/`, `src/controllers/` | Each exported mutation function |
| DAL / Services | `src/lib/dal/*.ts`, `src/services/`, `src/repositories/` | Each query function |
| Pages / Routes | `src/app/**/page.tsx`, `src/pages/` | Each route entry |
| Client Components | `*-client.tsx`, `*.client.tsx` | Interactive elements |
| Auth | `src/middleware.ts`, `src/lib/auth/`, `src/app/actions/auth.ts` | Auth flow |
| Workflow / State | `src/inngest/`, `src/jobs/`, `src/workers/` | State machines, handlers |
| Agent / AI | `src/lib/agent/`, `src/ai/` | Tools, assembly, execution |
| DB Schema | `src/db/schema/*.ts`, `prisma/schema.prisma` | Constraints, enums, relations |

7. **Output path** — Default: `docs/plans/system-test-cases.md`. Ask if user prefers different.

## Step 2: Analyze Requirements

For each requirement document:

- Extract every functional requirement with its acceptance criteria
- Identify business rules, validation rules, and constraint descriptions
- Note user roles and permission requirements
- Record: requirement ID/section, feature name, acceptance criteria, module

## Step 3: Analyze Test Plans

If test plan documents exist:

- Extract existing test scenarios and strategies
- Incorporate defined test scope, exclusions, and priorities
- Adopt the test plan's categorization if one exists
- Merge (not duplicate) with cases generated from code analysis

## Step 4: Analyze Code

Use parallel Explore agents per code layer. For each function/component:

- Identify inputs, outputs, side effects, error paths
- Note auth guards (`requireAuth()`, middleware checks)
- Identify database constraints (NOT NULL, UNIQUE, FK, enums)
- Map state transitions in workflow/state machine code
- Check for existing test files — if found, note what's already covered

## Step 5: Generate Test Cases

Apply the test patterns from [references/test-patterns.md](references/test-patterns.md) to
each code layer systematically. For every identified function/feature:

**Minimum coverage rules:**
- Each requirement → at least 3 cases (happy path + error path + boundary)
- Each Server Action → at least 2 cases (success + auth denied)
- Each page route → at least 2 cases (authenticated render + unauthenticated redirect)
- Each form → at least 2 cases (valid submit + validation error)
- Each state transition → at least 2 cases (valid transition + invalid transition)
- Each DB table with `organization_id` → 1 multi-tenant isolation case

**Priority assignment:**
- P0: Security (auth bypass, data leak), data integrity (data loss, corruption)
- P1: Core CRUD, main user flows, state machine transitions
- P2: UI feedback, secondary features, error messages
- P3: Edge cases, concurrency, performance, extreme data volumes

**Automatable assessment:**
- Mark ✅ if testable via unit/integration/E2E frameworks
- Mark ❌ if requires human judgment (visual quality, AI output quality, UX feel)

## Step 6: Cross-Reference

Ensure traceability:

1. Every requirement → has at least one test case (no blind spots)
2. Every test case → references a requirement or code location (no orphan tests)
3. If function list exists → every ✅/🔧 feature has test cases
4. If function list exists → every ❌ feature marked as "待实现后补充测试"

Produce gap analysis:
- Requirements with no test cases
- Code functions with no test cases
- Test plan scenarios not reflected in cases

## Step 7: Output

Write the test case document following [references/output-template.md](references/output-template.md).

Structure:
1. Test overview table (per module: P0/P1/P2/P3 counts + automation rate)
2. Test environment requirements
3. Per-module sections with test data prep + detailed cases
4. Gap analysis
5. Test framework recommendations (based on project tech stack)
6. Test data seed suggestions

## Execution Strategy

For large projects, process one module at a time:

1. Launch parallel Explore agents for independent modules
2. Write each module section incrementally using Edit to append
3. If content is too long, output modules sequentially

When a function list already exists, use it as the primary index and generate test cases
per function entry rather than re-analyzing all code from scratch.
