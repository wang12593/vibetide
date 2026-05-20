---
name: ship
description: Use when the user wants to finalize and push a chunk of completed work — phrases like "ship", "ship it", "/ship", "完成提交", "提交并推送", "推上去", "push to main", or after a logical unit of code is done and ready for main. Runs a strict typecheck → build → commit → push pipeline that stops on the first red signal. Triggers reliably even when the user just says "差不多了，可以收尾了" or "这个 feature 做完了" — anything that signals the end of a work session and intent to publish. Do NOT use for partial WIP commits, draft commits, or when the user is mid-implementation and just wants a checkpoint (use /checkpoint for that).
---

# Ship

Take a chunk of completed work from "code looks good on screen" to "pushed to main with green build".

## Why this skill exists

Repeated incidents in this codebase show two failure modes:
1. Committing while `tsc` is red — half-baked refactors land on `main` and break the next session
2. Commit messages that describe the diff line-by-line instead of the *intent* — useless for future archaeology

This skill enforces a strict pipeline so neither happens. It is intentionally conservative: any red signal stops everything.

## The pipeline

Execute in order. **Stop and report at the first failure** — do not auto-fix.

### Step 1 — Detect the project's verification commands

Read `package.json` (or `pyproject.toml`, `Cargo.toml`, etc.) to find the right commands. Common JS/TS:
- Typecheck: `npx tsc --noEmit` (or whatever `npm run typecheck` resolves to)
- Build: `npm run build` (or `pnpm build` / `yarn build`)
- Tests: only run if the user explicitly asked, or if the project has a fast unit-test script. Do not run heavy E2E.

If commands are not obvious, ask the user before guessing.

### Step 2 — Typecheck

Run typecheck. On red:
- Print the first 30 lines of error output
- Stop. Tell the user: "tsc 红了 N 处错误，需要先修。"
- Do NOT propose fixes unless the user asks — the user may want to triage themselves

On green: continue silently.

### Step 3 — Build

Run the production build. On red: same as Step 2 — stop, report, do not fix.

### Step 4 — Inspect the diff

Run `git status` and `git diff --stat` (no full `git diff` — too noisy). Show the file list and ask the user to confirm the scope before committing. If the diff includes obvious noise (`.DS_Store`, `node_modules/`, accidentally-committed `.env*` files), call it out.

### Step 5 — Compose the commit message

Use the conventional commit format the user prefers in this repo (check `git log -10 --oneline` for the actual style):

```
<type>(<scope>): <中文摘要不超过 50 字>

<可选的正文，解释 WHY，不解释 WHAT>
```

- `type` ∈ {feat, fix, refactor, docs, chore, perf, test, style}
- Match the **language** the repo's existing commits use (this user's repos are mostly Chinese)
- Focus the subject on *why* this change exists, not *what* lines moved
- No emojis unless the repo's history uses them
- Include `Co-Authored-By: Claude <noreply@anthropic.com>` only if the repo's existing commits already do

### Step 6 — Commit

Use `git commit` with the message via heredoc (preserves formatting). Stage specific files by name when possible — avoid `git add -A` / `git add .`, which can sweep up secrets or junk.

**Forbidden flags:** `--no-verify`, `--no-gpg-sign`, `--amend` (unless the user explicitly asks). If a pre-commit hook fails, that's a real signal — fix the underlying issue and create a new commit.

### Step 7 — Push

`git push origin <current-branch>`. If the user's repo policy forbids pushing to certain branches (check for a `.claude/` marker file or CLAUDE.md note), refuse and tell them why.

### Step 8 — Report

End with a one-line summary:
```
✓ Shipped <SHA> · <N> files · <type>(<scope>): <subject>
```

## When the pipeline fails

The instinct is to "just fix the small thing and try again". Resist this when:
- The failure surfaces a real bug the user should triage
- The fix would expand the diff scope beyond what the user signed off on
- More than one red signal appeared (cascading failures often mean a deeper issue)

Stop, report, let the user decide. A 30-second pause to confirm beats a bad commit on `main`.

## What this skill is NOT for

- **Partial WIP saves** → use `/checkpoint`
- **Multi-phase plan execution** → use `/implement` or `/phase`
- **PR creation** → this skill pushes to the current branch only; PR is a separate action
- **First commit on a new branch** → this skill assumes you're on a tracked branch with an upstream

## Example

User: "可以了，ship"

```
1. 跑 npx tsc --noEmit ... ✓ 0 errors
2. 跑 npm run build ........ ✓ built in 12.3s
3. git status:
   M src/lib/dal/users.ts
   M src/app/(dashboard)/users/page.tsx
   范围对吗？
```

(user confirms)

```
4. Commit message draft:
   feat(users): 用户列表页支持按角色筛选

   接通 DAL 的 role filter 参数,前端加 Select。
   解决 #312 反馈的"无法快速找到管理员账号"。

   提交?
```

(user confirms)

```
5. ✓ Shipped a3f2b91 · 2 files · feat(users): 用户列表页支持按角色筛选
```
