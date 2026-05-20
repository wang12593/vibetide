---
name: function-list-analyzer
description: >-
  Reverse-engineer a comprehensive system function list by cross-analyzing codebase, requirement
  documents, and implementation plans. Use when: (1) user asks to generate a "function list",
  "feature list", "功能清单", or "功能列表", (2) user wants to understand project completion
  status or gap analysis between requirements and code, (3) user asks "what features are
  implemented" or "what's missing", (4) user wants a full inventory of system capabilities.
  Triggers on keywords: function list, feature inventory, 功能清单, 功能列表, gap analysis,
  实现状态, 完成率, reverse engineer features.
---

# Function List Analyzer

Analyze a project's codebase, requirement docs, and implementation plans to produce a detailed
function list with implementation status tracking and gap analysis.

## Workflow

```
1. Gather inputs     → Identify docs, plans, and code directories
2. Analyze docs      → Extract function requirements from each document
3. Analyze plans     → Extract planned/completed tasks from plan files
4. Analyze code      → Reverse-engineer implemented functions per code layer
5. Cross-reference   → Match docs ↔ plans ↔ code, determine status
6. Output            → Write structured function list with gap analysis
```

## Step 1: Gather Inputs

Ask the user or infer from project structure:

1. **Module grouping** — How to organize functions into modules. Check CLAUDE.md or requirement
   docs for existing module definitions. Ask user to confirm or customize.
2. **Requirement docs** — Glob `docs/requirement/**/*.md` (or user-specified path)
3. **Implementation plans** — Glob `docs/plans/**/*.md` (or user-specified path)
4. **Code directories** — Auto-detect from project structure. Standard layers:

| Layer | Typical Paths | What to Extract |
|-------|--------------|-----------------|
| DB Schema | `src/db/schema/*.ts`, `prisma/schema.prisma`, `drizzle/` | Tables, enums, relations |
| Data Access | `src/lib/dal/*.ts`, `src/repositories/`, `src/services/` | Query functions |
| Mutations | `src/app/actions/*.ts`, `src/api/`, `src/controllers/` | Each exported mutation |
| Pages/Routes | `src/app/**/page.tsx`, `src/pages/`, `src/routes/` | Each route as UI function |
| Client Components | `*-client.tsx`, `*.client.tsx` | Interactive features |
| Shared Components | `src/components/shared/`, `src/components/common/` | Domain components |
| Agent/AI | `src/lib/agent/`, `src/ai/` | Tools, prompts, capabilities |
| Automation | `src/inngest/`, `src/jobs/`, `src/workers/` | Event handlers, cron jobs |
| API Routes | `src/app/api/`, `src/api/` | REST/GraphQL endpoints |
| Constants/Types | `src/lib/constants.*`, `src/lib/types.*` | Enums, configs, type defs |

5. **Output path** — Default: `docs/plans/system-function-list.md`. Ask if user wants different.

## Step 2: Analyze Requirement Documents

For each requirement doc, use an Explore agent or read directly:

- Extract every functional requirement (look for numbered items, bullet lists, feature descriptions)
- Record: requirement ID/section, feature name, description, module assignment
- Note priority indicators if present (P0/P1/P2, must-have/nice-to-have)

## Step 3: Analyze Implementation Plans

For each plan document:

- Extract task items (numbered steps, checkboxes, feature IDs like `F4.1.07`)
- Record: task ID, description, planned status (done/in-progress/planned)
- Link to corresponding requirement if referenced

## Step 4: Analyze Code (Reverse Engineering)

Use parallel Explore agents, one per code layer. For each layer:

- List all exported functions, classes, components, routes
- For each: extract name, purpose (from function name, JSDoc, or code inspection)
- Note if using mock data vs real data (indicates partial implementation)

**Granularity rules** — Each of these is a separate function entry:
- Each `export function` / `export async function` in action files
- Each exported query function in DAL files
- Each page route
- Each distinct UI interaction (dialog, form, modal, toggle)
- Each API endpoint (method + path)
- Each DB table (as data model capability)
- Each event handler / automated task
- Each agent tool

## Step 5: Cross-Reference

Build a unified list. For each function entry determine status:

- **✅ 已实现**: Code exists, functional, matches requirement
- **🔧 部分实现**: Code exists but incomplete (UI shell only, mock data, missing features)
- **❌ 未实现**: Defined in requirements or plans but no corresponding code

Cross-reference rules:
1. Every requirement item → search code for matching implementation
2. Every plan task → check if code was committed
3. Every code function → check if requirement or plan exists (mark "代码补充" if neither)

## Step 6: Output

Write the function list to the output file. Follow the template in
[references/output-template.md](references/output-template.md).

Structure:
1. Module overview table (completion stats)
2. Per-module function tables (grouped by sub-category)
3. Gap analysis section:
   - Requirements defined but not implemented
   - Plans specified but not implemented
   - Code exists but not in requirements/plans
4. Summary statistics

## Execution Strategy

For large projects, process one module at a time to manage context:

1. Launch parallel Explore agents for independent modules
2. Collect results and merge into a single document
3. If output exceeds context limits, write module-by-module to the output file

When content is too long for a single pass, write each module section incrementally using Edit
tool to append to the output file.
