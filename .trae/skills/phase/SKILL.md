---
name: phase
description: Use when executing exactly ONE phase from a multi-phase implementation plan, with strict scope-locking and a single phase-scoped commit at the end. Trigger on phrases like "/phase", "跑 phase 3", "实现 Phase 2", "做下一阶段", "execute next phase", "P4 走起", or when the user references a plan file in docs/plans/, docs/superpowers/plans/, or openspec/ AND mentions a specific phase number. Complementary to /implement (which can run multiple phases) — use this skill when the user wants tight per-phase discipline with a tsc gate and one commit boundary. Triggers even when the user just says "下一个阶段" without naming the file, as long as a recent plan file is in context.
---

# Phase

Execute one phase of an implementation plan. One phase = one commit. Tsc must be green before committing. Scope is locked to the files the plan lists for that phase.

## Why this skill exists

Big plans get broken in two ways:
1. **Phase bleed** — implementing Phase N also touches files that belong to Phase N+2, making the diff hard to review and the rollback unclear
2. **Mid-phase red commits** — committing before the phase is fully verified, creating a window where `main` doesn't typecheck

This skill enforces a single discipline: **the phase commit is the verification boundary**. If tsc isn't green, no commit. If a file isn't in the plan's scope for this phase, no edit.

This is different from `/implement` (which executes whole plans batch-style). Use `/phase` when you want to ship one phase, look at the diff, sleep on it, then come back for the next.

## Inputs the skill needs

- **Plan file path** — `docs/plans/<file>.md`, `docs/superpowers/plans/<file>.md`, or similar
- **Phase number** — which phase to execute

If either is missing, ask. Don't guess. If multiple plan files were mentioned recently, ask which one.

If only the phase number is given and a plan file was discussed earlier in the conversation, use that file but **confirm with one short message** ("Phase 3 of `2026-04-19-...-plan.md`，对吗？") before proceeding.

## Workflow

### Step 1 — Parse the plan

Read the plan file. Locate the requested phase. Extract:
- Phase title
- File list (files to create + files to modify)
- Acceptance criteria / verification steps
- Any dependencies on prior phases

If the phase has no clear file list, that's a planning gap — surface it and ask whether to proceed with best-guess scope or fix the plan first.

### Step 2 — Verify prior phases are committed

Run `git log -20 --oneline` and confirm the previous phase's commit exists. If Phase N-1 is not in git history but Phase N depends on it, stop and ask.

Run `git status`. If the working tree is dirty with unrelated changes, refuse to proceed — the phase commit must contain only this phase's diff.

### Step 3 — Confirm scope

Print the file list clearly:
```
Phase N — <title>
要改的文件 (M):
  src/foo.ts
  src/bar.tsx
要新建的文件 (A):
  src/lib/new-helper.ts

验收: <从 plan 抄过来>

确认开始?
```

Wait for user confirmation. **Do not start editing until they say go.**

### Step 4 — Implement, scope-locked

Edit only the files listed. If during implementation you discover a needed change to a file outside the list:
- Stop
- Tell the user: "Phase N 范围外需要改 `src/xxx.ts`（原因: ...），是把它纳入这个 phase 还是单独处理?"
- Do not just silently edit it

Do not refactor adjacent code that "looks dirty". Do not improve unrelated comments. Stay in the lane.

### Step 5 — Tsc gate (hard)

Run `npx tsc --noEmit` (or the project's typecheck command).

- Red → list errors, stop. **Do not commit.** The user decides whether to fix-and-retry or roll back.
- Green → continue.

If the plan specifies tests for this phase, run those too. Same rule: red stops the pipeline.

### Step 6 — Phase-scoped commit

Compose:
```
<type>(<scope>): Phase N — <phase title>

<one-line summary of what this phase actually accomplished>
```

Example: `feat(a5): Phase 3 — report-template + 6 case TDD`

Stage by file (`git add <each file>`), then commit. **Do not push** — `/phase` ends at commit. Pushing is `/ship`'s job.

### Step 7 — Report and preview next

```
✓ Phase N committed: <SHA>
  files: M=<n> A=<m>
  tsc: green
  
下一阶段: Phase N+1 — <title>
  范围: <file count> 个文件
  依赖: <list>
```

This gives the user a one-glance decision: continue with `/phase` again, or stop here.

## What this skill will NOT do

- **Push to remote** — that's `/ship`
- **Execute multiple phases in one go** — that's `/implement`
- **Skip the tsc gate** — even with user pressure, no
- **Touch files outside the phase's listed scope** — surface and ask instead
- **Use `--amend`** — phases are append-only in git history

## Failure modes to watch for

- Plan file lists files that no longer exist (plan stale) → surface, ask whether to update plan or skip
- Phase verification step requires a server running → ask user to start it; don't auto-start
- Phase says "follow Phase N's pattern" but Phase N's commit isn't in history → stop, ask

## Edge case: plan file uses a different format

If the plan doesn't have a clear "Phase N" section but uses, e.g., "Day 1 / Day 2" or "Step A / Step B", treat those as phases. Confirm the mapping with the user once: "你说的 Phase 3 是 plan 里的 Day 3 / Step C，对吗?"
