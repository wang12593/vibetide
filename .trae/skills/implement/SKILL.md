---
name: implement
description: Execute multi-phase implementation plans from markdown plan files. Use when the user says "implement", "execute plan", "执行计划", "实现", or provides a plan file path. Triggers on: (1) user references a plan document in docs/plans/, (2) user asks to implement a feature described in a plan, (3) user says "implement phase X" for partial execution. Handles phased implementation with type checking after each phase and build verification at the end.
---

# Implement Plan

Execute a structured implementation plan from a markdown file, phase by phase, with verification gates.

## Invocation

```
/implement <plan-file-path> [--phase N] [--from N] [--dry-run]
```

- `plan-file-path`: Path to the plan markdown file (e.g., `docs/plans/my-feature-plan.md`)
- `--phase N`: Execute only phase N (for bounded sessions)
- `--from N`: Start from phase N, execute all remaining phases
- `--dry-run`: Parse the plan and list all files to create/modify without executing

If no arguments provided, prompt: "Which plan file should I implement?"

## Workflow

```
1. Parse plan    → Extract phases, steps, and file lists
2. Pre-flight    → List all files to create/modify, confirm with user
3. Execute       → Implement phase by phase
4. Verify        → Type check after each phase, full build at end
5. Report        → Summary of files created/modified per phase
```

### Step 1: Parse Plan

Read the plan file. Extract:
- **Phases**: Top-level sections (## or ### headings with "Phase" or "阶段")
- **Steps**: Numbered items or checkboxes within each phase
- **File lists**: Any file paths mentioned (look for `src/`, backtick-wrapped paths)
- **Dependencies**: Note which phases depend on earlier phases

If the plan has no clear phase structure, treat the entire document as a single phase.

### Step 2: Pre-flight Check

Before writing any code:
1. List every file that will be created or modified, grouped by phase
2. Check for existing files that would be overwritten
3. Read CLAUDE.md and any project-specific conventions
4. Show the execution summary to the user and wait for confirmation

Output format:
```
Plan: [plan file name]
Phases: N total, executing [range]

Phase 1: [phase name]
  Create: src/db/schema/foo.ts, src/lib/dal/foo.ts
  Modify: src/db/schema/index.ts

Phase 2: [phase name]
  Create: src/app/actions/foo.ts
  Modify: src/app/(dashboard)/foo/page.tsx

Proceed? (waiting for confirmation)
```

### Step 3: Execute Phase by Phase

For each phase:

1. **Announce**: "Starting Phase N: [phase name]"
2. **Read existing files** before modifying — understand context first
3. **Implement all steps** in the phase sequentially
4. **Follow project conventions** from CLAUDE.md:
   - Server components by default, `"use client"` only when needed
   - Never import DAL code from client components
   - All UI text in Chinese
   - Follow existing patterns in the codebase
5. **Type check**: Run `npx tsc --noEmit` after the phase completes
6. **Fix errors**: If type check fails, fix all errors before proceeding
7. **Report**: List files created/modified in this phase

If type check fails after 3 fix attempts, stop and report the remaining errors to the user.

### Step 4: Final Verification

After all phases complete:
1. Run `npx tsc --noEmit` — full type check
2. Run `npm run build` — production build
3. If build fails, enter fix loop (max 3 iterations):
   - Parse error output
   - Fix errors (add `force-dynamic`, fix imports, etc.)
   - Re-run build
4. If build still fails after 3 attempts, report errors and stop

### Step 5: Report

Output a completion summary:

```
Implementation Complete

Phase 1: [name] — N files
Phase 2: [name] — N files
...
Total: X files created, Y files modified

Type check: PASS
Build: PASS
```

## Constraints

- Never use `any` type to silence errors
- Never import server-side code (`src/lib/dal/`, `src/db/`) in `"use client"` files
- Always verify AI SDK v6 method signatures (`stopWhen`, `inputSchema`, `maxOutputTokens`)
- Add `export const dynamic = 'force-dynamic'` to pages that query the database
- Use parallel sub-agents for independent phases when possible (schema has no deps → can parallelize DAL + actions after schema is done)

## Scope Control

- Execute ONLY what the plan specifies — do not add features, refactor, or "improve" beyond the plan
- If a step is ambiguous, implement the minimal interpretation
- If a step requires decisions not covered by the plan, note it in the phase report and continue
