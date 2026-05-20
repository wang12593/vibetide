---
name: ui-polish
description: Use after editing any React/Next.js UI file — *.tsx files under src/app/ or src/components/ (excluding src/components/ui/ which IS the primitive layer). Trigger automatically after Edit/Write on TSX files even without explicit user request, because design system drift accumulates silently. Verifies compliance with the project's shared component primitives (Button, Input, Select, SearchInput, DataTable, GlassCard, PageHeader, etc.), catches color override violations, hydration-unsafe nesting (button-in-button, div-in-p), and confirms Chinese-only copy. Reports violations with file:line — does NOT auto-fix. Trigger on phrases like "check the UI", "审查 UI", "ui-polish", "看看样式有没有问题", "review my changes for design system compliance", or after wrapping up a UI iteration session.
---

# UI Polish

Audit recently-edited UI files against the project's design system rules. Report violations with precise file:line locations. Do not auto-fix — the user (or a subsequent iteration) decides what to change.

## Why this skill exists

Design systems decay one PR at a time. Every time a developer hand-rolls `<button className="bg-blue-500 text-white px-4 py-2 rounded">` instead of using the project's `<Button>`, the system loses a little bit of consistency. After a few months, the UI looks like five different products glued together.

This skill is the auditor that runs after each UI change. It does not block anything — it just makes drift visible so the human can decide.

## Project context detection

The project's design system rules live in **CLAUDE.md** under "Design System Rules" or similar. Read that section first to understand what primitives this specific project uses. The default rules below assume a shadcn/ui + Tailwind setup with custom shared components, but adapt to whatever the project actually has.

If CLAUDE.md doesn't have design system rules, look for:
- `src/components/ui/` (shadcn/ui primitives)
- `src/components/shared/` (project-specific shared primitives)
- `eslint.config.*` for `no-restricted-syntax` rules

If none exist, surface this once: "项目没有声明设计系统规则，要不要先在 CLAUDE.md 里加一段?"

## Scope

**Audit:**
- `*.tsx` under `src/app/`, `src/components/` (except `src/components/ui/`)
- `*-client.tsx` files anywhere
- `src/components/shared/` (these are the primitives — different rules apply, see below)

**Skip:**
- `src/components/ui/` — these ARE the primitives, raw HTML elements are expected here
- `src/app/landing/` if the project marks it as a styled landing page exception
- `*.test.tsx` / `*.stories.tsx` — test/story files have looser rules
- Any path the project's eslint config explicitly excludes

## The checklist

Run through these in order on each edited file. Report violations as `file:line — <rule> — <fix hint>`.

### Section 1: Use shared primitives, not raw HTML

| Violation | Fix |
|---|---|
| `<button` (raw) | Use `<Button>` from the project's button primitive |
| `<input type="text"` (raw) | Use `<Input>` |
| `<input type="checkbox"` (raw) | Use `<Checkbox>` |
| `<input type="radio"` (raw) | Use `<RadioGroup>` |
| `<select` (raw) | Use `<Select>` |
| `<textarea` (raw) | Use `<Textarea>` |
| Hand-rolled search box (`<div className="relative"><Search.../>...<Input pl-8/></div>`) | Use `<SearchInput>` |
| Hand-rolled card (`<div className="rounded-xl bg-white p-4 shadow">`) | Use the project's card primitive (e.g., `<GlassCard>`) |
| Hand-rolled table (flex/grid rows for data) | Use `<DataTable>` |
| Hand-rolled page title (`<h1 className="text-2xl">...</h1>`) | Use `<PageHeader>` |

### Section 2: No color overrides on shared primitives

Shared primitives (Button, Input, Select, etc.) carry the project's design tokens. Overriding their color/border/background on the consumer side **defeats the system**. Use the primitive's variant prop instead.

Flag patterns like:
- `<Button className="bg-primary text-white">` → use `variant="default"` or whatever variant maps
- `<Button className="bg-blue-500">` → use a variant
- `<Input className="bg-white/60 border border-gray-200">` → strip the override
- `<SelectTrigger className="border-0 bg-gray-100">` → strip
- `<Textarea className="border-0 bg-gray-100">` → strip
- `<TabsList className="bg-transparent border-0 p-0 h-auto">` → use `variant="line"` instead of emulating

Spacing/sizing/layout overrides on primitives are usually fine (`className="w-60 mt-4"`). It's color/background/border that signals drift.

### Section 3: Hydration safety

React hydration errors are silent killers — they look fine in dev, then crash in prod with cryptic errors. Catch them at write-time.

Flag:
- `<Button>` nested inside `<Button>` (button-in-button)
- `<button>` nested inside `<Button>` or vice versa
- `<a>` nested inside `<a>` or `<Link>` inside `<Link>`
- `<div>` / `<p>` / `<ul>` / `<ol>` nested inside `<p>` (block in inline)
- `<table>` / `<form>` nested inside `<p>`

These are not always easy to spot via grep — read the JSX structure and use judgment.

### Section 4: Server/client component boundary

If the project uses Next.js App Router with a Server/Client component split:
- Files marked `"use client"` MUST NOT import from `src/lib/dal/` or other server-only paths
- `*-client.tsx` files MUST NOT import server actions directly (they should receive functions as props or call API routes)

Flag any violation.

### Section 5: Copy and i18n

If CLAUDE.md says the project is Chinese-only UI:
- Flag any English UI copy in JSX text content (button labels, headings, placeholders)
- Allow English in: code identifiers, console.log, comments, prop names, type names, keys/IDs
- Allow English in: brand names, technical jargon used as-is in Chinese context (e.g., "API", "JSON", "Tab")

If CLAUDE.md mentions specific style preferences (e.g., "buttons should not have borders"), check those too.

### Section 6: Accessibility quick wins

These are not strict rules but worth surfacing:
- `<img>` without `alt` attribute (or `aria-hidden`)
- Interactive elements (buttons, links) with no accessible label (no text, no `aria-label`)
- Form inputs without associated `<Label>`

## Report format

Group by file, sort by line number:

```
src/app/(dashboard)/users/users-client.tsx
  L42  raw-button         用 <Button> 替代 <button>
  L78  color-override     <Button className="bg-primary"> — 改用 variant="default"
  L156 hydration-risk     <Button> 嵌在 <Button> 里 (L154 起) — 拆开

src/components/shared/user-card.tsx
  L23  hand-rolled-card   用 <GlassCard> 替代 rounded-xl + bg-white + shadow

总计: 4 处违规 across 2 个文件
```

If zero violations: `✓ UI 检查通过 — N 个文件，无违规`

## What this skill will NOT do

- **Auto-fix violations** — the user decides; some "violations" are intentional
- **Re-style or refactor anything** — read-only audit
- **Run on `src/components/ui/` primitives** — those are the source of truth
- **Block work** — it's an auditor, not a gatekeeper. Output is informational
- **Lint for things ESLint already covers** — if `no-restricted-syntax` already flags raw `<button>`, this skill defers to ESLint and skips that rule

## Edge cases

- **Generated code (e.g., shadcn-ui scaffolds)** — skip, those are scaffolds the user will customize
- **Storybook / MDX files** — skip, different conventions
- **Inline SVG** — `<button>`-looking elements inside SVG are fine (SVG namespace)
- **Third-party component wrappers** — if a file wraps a third-party lib (e.g., Recharts), raw HTML inside the wrapper is often necessary; use judgment

## Why "report, don't fix"

Auto-fixing UI is dangerous because:
1. The "violation" may be deliberate (e.g., a one-off marketing button that intentionally breaks the system)
2. Fixing requires choosing the right primitive, and that's a design decision
3. The diff from auto-fix can be huge and obscure the user's actual intent

By reporting only, the user keeps the keys. They can ask Claude to fix specific items in a follow-up.
