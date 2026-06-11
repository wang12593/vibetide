# CLAUDE.md — VibeTide

## 12 条行为准则（不可协商）

以下规则源自 Karpathy 4-rule 基线 + claude-code-pro-pack 扩展，覆盖 AI 编程 Agent 的核心失败模式。每条规则对应一个真实的失败场景，不是偏好。

1. **编码前先思考。** 陈述假设，暴露权衡，不确定时先问不要猜。有更简单的方案时主动反馈。
2. **简单优先。** 只写解决问题所需的最少代码。不做推测性功能，不对单次使用的代码做抽象。
3. **外科手术式修改。** 只碰必须碰的。不"改进"相邻代码、注释或格式。匹配现有风格。
4. **目标驱动执行。** 先定义成功标准，再循环迭代直到验证通过。告诉 Claude 成功长什么样，让它自己迭代。
5. **别让模型做非语言工作。** 重试、路由、限流、算术、时间判断——用确定性代码，不要用 prompt。
6. **硬性 token 预算。** 每个任务上限 4000 token，每个会话上限 30000 token。接近预算时总结并重新开始。不要静默超限。
7. **暴露冲突，不要取平均。** 代码库两处模式矛盾时，选一个（更近期/更经过测试的），解释原因，标记另一个待清理。不要混合两种模式。
8. **先读后写。** 添加代码前先读附近的代码、导出、调用方、共享工具。"看起来正交"很危险，重复函数会通过 import 顺序静默破坏。
9. **测试以正确性为门槛，不是"通过"。** 返回常量的函数通过了测试不等于测试有效。断言绑定行为，不是形状。
10. **长操作需要检查点。** 多步重构和迁移在每步之间提交，一次错误的转向不需要回退六步。
11. **惯例胜过新奇。** 代码库已有既定模式时，用那个模式，即使你的"更好"。两种模式并存永远比任何一种都差。
12. **显式失败，不要静默。** 迁移"成功完成"却因约束违反跳过 14% 的记录——这是 bug 不是成功。暴露部分失败、跳过的行、截断的输出、重试耗尽。

## 项目定制

- **Stack:** Next.js 16 + React 19 + TypeScript 5 (strict) + Drizzle ORM + Supabase PostgreSQL
- **Test runner:** 暂无统一测试框架，验证靠 `npx tsc --noEmit` + `npm run build`
- **Lint:** `npm run lint` — ESLint
- **Path alias:** `@/*` maps to `./src/*`
- **语言:** 所有 UI 文本使用简体中文，回复使用中文
- **禁止触摸:** `supabase/migrations/` 由 Drizzle CLI 管理，不要手动修改
- **Secrets:** 所有环境变量在 `.env.local`，绝不记录或提交
- **Git:** 单分支开发，所有 commit 直接落在 `main`，禁止创建 feature 分支和 worktree

## 验证清单

在将任务标记为完成前，逐项检查：

- [ ] 是否明确陈述了假设？
- [ ] 是否有修改触及了任务范围之外的代码？如果有，回退或说明理由。
- [ ] 是否有测试仅因返回常量而"通过"？重新检查断言。
- [ ] 是否有部分失败、跳过的记录、截断的输出？在摘要中暴露。
- [ ] `npx tsc --noEmit` 类型检查通过？
- [ ] `npm run build` 构建通过？

---

## OpenSpec（规范驱动开发）

本项目使用 OpenSpec (v1.3.1) 管理变更提案和规范。

**何时使用 OpenSpec：**
- 新功能 / 新能力 → 先创建变更提案，再实现
- Breaking change / 架构变更 → 必须走 OpenSpec 流程
- 需求模糊 → 先用 explore 探索，再 propose 创建提案

**工作流命令（在对话中引用 skill 名称即可）：**
- `openspec-propose` — 创建完整变更提案（proposal + design + specs + tasks）
- `openspec-apply-change` — 按 tasks.md 实现代码
- `openspec-explore` — 探索模式，思考问题、调研代码
- `openspec-archive-change` — 归档已完成的变更

**CLI 常用命令：**
```bash
openspec list                    # 查看活跃变更
openspec list --specs            # 查看已有规范
openspec status --change <name>  # 查看变更状态
openspec validate <name>         # 验证变更
```

**配置文件：** `openspec/config.yaml`（含项目上下文和规则）
**变更目录：** `openspec/changes/`
**规范目录：** `openspec/specs/`

## Project Overview

Vibetide (Vibe Media) is a Chinese-language AI-powered content management platform. It manages a team of 8 specialized AI employees that collaborate on content production workflows: hot topic monitoring, content planning, writing, video production, quality review, channel distribution, and data analytics.

## Commands

```bash
npm run dev          # Start Next.js dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check (no emit)

# Database (requires DATABASE_URL in .env.local)
npm run db:push      # Push Drizzle schema to Supabase (dev)
npm run db:generate  # Generate SQL migration files
npm run db:migrate   # Apply migrations
npm run db:studio    # Open Drizzle Studio (visual DB browser)
npm run db:seed      # Seed database (npx tsx src/db/seed.ts)
```

## Tech Stack

- **Framework:** Next.js 16.1.6, React 19, TypeScript 5 (strict mode)
- **Database:** Supabase (PostgreSQL) via Drizzle ORM 0.45.1 with `postgres` driver
- **Auth:** Supabase Auth (@supabase/ssr for SSR cookie management)
- **AI:** AI SDK (Vercel) v6, @ai-sdk/anthropic
- **UI:** shadcn/ui (new-york style), Radix UI, Tailwind CSS v4, Lucide icons
- **Charts:** Recharts 3.7
- **Animation:** Framer Motion
- **Automation:** BullMQ (Redis-backed job queues, node-cron scheduling)
- **Path alias:** `@/*` maps to `./src/*`

## Architecture

### Route Structure

Three route areas under `src/app/`:
- `landing/` — Public landing page (shown at `/` for unauthenticated visitors).
- `(auth)/` — `login/`, `register/`, `auth/` (OAuth callback). No layout protection.
- `(dashboard)/` — 34 dashboard route groups. Layout fetches user profile with graceful fallback.

Root page (`/`) shows the landing page for unauthenticated users, redirects authenticated users to `/home`.

### Server/Client Component Pattern

**Use Server Components by default.** Only add `"use client"` when components need browser interactivity (event handlers, hooks, browser APIs). **Never import server-side DAL code (`src/lib/dal/`) from client components** — this causes build-time DB connection errors.

Dashboard pages follow a consistent split:
- **`page.tsx`** — Server component. Fetches data (from DAL or mock), passes as props.
- **`*-client.tsx`** — Client component ("use client"). Receives data as props, handles all interactivity.

Example: `team-hub/page.tsx` (server) → `team-hub-client.tsx` (client).

### Data Flow

```
Server Page → DAL (src/lib/dal/) → Drizzle ORM → Supabase PostgreSQL
                                                        ↑
Mutations  → Server Actions (src/app/actions/) ─────────┘
```

- **DAL** (`src/lib/dal/`): Read-only query functions that return UI types (`AIEmployee`, `Team`, etc. from `src/lib/types.ts`). Transform DB rows to match frontend interfaces.
- **Server Actions** (`src/app/actions/`): Mutations with `"use server"`. All require auth via `requireAuth()` helper. Use `revalidatePath()` for cache invalidation.
- **Mock data** (`src/data/`): 19 files with static mock data. Pages not yet migrated to DAL import directly from here.

### Database

- **~145 tables** defined across 54 schema files in `src/db/schema/`
- **72 enums** in `src/db/schema/enums.ts`
- **Key tables:** `organizations`, `user_profiles`, `ai_employees`, `skills`, `employee_skills`, `employee_memories`, `teams`, `team_members`, `workflow_templates`, `workflow_instances`, `workflow_steps`, `workflow_artifacts`, `team_messages`, `tasks`, `knowledge_bases`, `employee_knowledge_bases`, `missions`, `media_assets`, `articles`, `categories`
- **Types** auto-derived in `src/db/types.ts` via `InferSelectModel`/`InferInsertModel`
- **Connection** in `src/db/index.ts`: uses `postgres` driver with `{ prepare: false }` (required for Supabase PgBouncer)
- **Migrations** output to `supabase/migrations/`
- Multi-tenant: all core tables have `organization_id` foreign key

### Auth Flow

- **Supabase clients:** `src/lib/supabase/client.ts` (browser), `server.ts` (RSC/actions)
- **Middleware helper** (`src/lib/supabase/middleware.ts`): `updateSession()` refreshes cookies, redirects unauthenticated users to `/login`, redirects authenticated users away from auth pages to `/home`. Note: no active root `middleware.ts` file currently exists.
- **Server Actions** in `src/app/actions/auth.ts`: `signIn`, `signUp`, `signOut`
- Email/password auth only (no social login)

### AI Employee System

8 preset AI employees (defined in `src/lib/constants.ts` as `EMPLOYEE_META`), each with a unique `EmployeeId` slug: `xiaolei`, `xiaoce`, `xiaozi`, `xiaowen`, `xiaojian`, `xiaoshen`, `xiaofa`, `xiaoshu`. The `advisor` ID is for channel advisors.

Each employee has skills (many-to-many via `employee_skills`), performance stats, and can participate in teams and workflow steps.

### Component Organization

- `src/components/ui/` — shadcn/ui base components (25+). Add new ones via `npx shadcn add <component>`.
- `src/components/shared/` — Domain-specific reusable components (GlassCard, DataTable, PageHeader, EmployeeAvatar, ActivityFeed, WorkflowPipeline, etc.)
- `src/components/charts/` — Recharts wrappers (area, bar, donut, gauge, radar, heat curve)
- `src/components/layout/` — AppSidebar, Topbar
- `cn()` utility in `src/lib/utils.ts` for merging Tailwind classes

### Design System Rules (don't break these)

Every past round of style drift came from bypassing shared primitives. These rules keep the UI consistent:

**Always use the shared primitives. Never hand-roll:**
- Buttons → `<Button>` from `@/components/ui/button` (never `<button>`)
- Inputs → `<Input>` from `@/components/ui/input` (never `<input type='text'>`)
- Search boxes → `<SearchInput>` from `@/components/shared/search-input` (never `<div className="relative"><Search absolute .../><Input pl-8 .../></div>`)
- Dropdowns → `<Select>` from `@/components/ui/select` (never `<select>`)
- Multi-line inputs → `<Textarea>` from `@/components/ui/textarea` (never `<textarea>`)
- Date pickers → `<DatePicker>` / `<DateRangePicker>` from `@/components/shared/date-picker` (never Popover+Calendar built from scratch)
- Tabs → `<Tabs>` / `<TabsList>` / `<TabsTrigger>` from `@/components/ui/tabs`. Use `variant="default"` (filled pill) or `variant="line"` (underlined). Don't manually emulate via `className="bg-transparent border-0 p-0 h-auto"` — use the variant.
- Data tables → `<DataTable>` from `@/components/shared/data-table` (never hand-rolled flex/grid rows)
- Page titles → `<PageHeader>` from `@/components/shared/page-header`
- Cards → `<GlassCard>` from `@/components/shared/glass-card` (never `rounded-xl bg-white p-4 shadow`)

**Never override color classes via `className` on shared components.** The shared `Button` uses a liquid-glass translucent sky style. `<Button className="bg-primary text-white">...</Button>` defeats the shared style — use `variant` (`default` / `ghost` / `destructive` / `outline` / `secondary` / `link`) instead. Same for `<Input>`, `<SelectTrigger>`, `<Textarea>`, etc.

Known drift patterns to avoid (these have all appeared and been cleaned up — don't reintroduce):
- `<Input className="bg-white/60 border border-gray-200 focus:ring-blue-500/30">` — strip the overrides
- `<SelectTrigger className="bg-[var(--glass-input-bg)] border-[var(--glass-input-border)]">` — strip
- `<SelectTrigger className="border-0 bg-gray-100 dark:bg-gray-800">` — strip
- `<Textarea className="border-0 bg-gray-100 dark:bg-gray-800">` — strip
- `<TabsList className="bg-transparent border-0 p-0 h-auto">` — use `variant="line"` instead

**DataTable API (key patterns):**
```tsx
<DataTable
  rows={items}
  rowKey={(item) => item.id}
  columns={[
    { key: "name", header: "名称", render: (r) => r.name },
    { key: "status", header: "状态", width: "w-24", render: (r) => ... },
    { key: "date", header: "时间", width: "120px", render: (r) => ... },
    { key: "count", header: "数量", align: "right", sortable: true, render: (r) => r.count },
  ]}
  selectable
  selectedKeys={selected}
  onSelectionChange={setSelected}
  sortKey={sortField}
  sortDirection={sortDir}
  onSortChange={(key, dir) => { ... }}
  expandedKeys={expanded}
  renderExpanded={(row) => <div>...</div>}
  emptyMessage={<EmptyStateContent />}
  footer={<FooterStats />}
/>
```

**SearchInput API:**
```tsx
<SearchInput placeholder="搜索..." value={q} onChange={e => setQ(e.target.value)} />
<SearchInput className="w-60" inputClassName="h-8 text-xs" ... />
```
`className` goes on the wrapper (use for width / positioning). `inputClassName` forwards to the inner `<Input>` (use for size variants like `h-8 text-xs`).

**DatePicker / DateRangePicker API:**
```tsx
<DatePicker value={date} onChange={setDate} placeholder="选择日期" />
<DateRangePicker value={range} onChange={setRange} placeholder="选择日期范围" />
```

**Enforcement:** `eslint.config.mjs` defines `no-restricted-syntax` rules (currently `warn`) that flag raw `<button>/<input>/<select>/<textarea>` in `src/app/**` and `src/components/**` (except under `src/components/ui/**`, `src/app/landing/**`, `src/components/media-assets/**`).

### Environment Variables

All environment variables are stored in **`.env.local`** (not `.env`). See `.env.example` for template:
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL

# AI Services (DeepSeek via OpenAI-compatible API)
OPENAI_API_KEY
OPENAI_API_BASE_URL       # https://api.deepseek.com/v1
OPENAI_MODEL              # deepseek-chat

# Web Search & Content Reading
TAVILY_API_KEY
JINA_API_KEY

# Trending Topics (热榜聚合)
TRENDING_API_URL
TRENDING_API_KEY
TRENDING_RESPONSE_MAPPING

# BullMQ Worker
REDIS_URL
```

**Important:** Supabase may have connectivity issues. Pages that query the database at render time must add `export const dynamic = 'force-dynamic'` to avoid build-time DB connection timeouts.

### CMS Integration Layer (Phase 1)

Phase 1 交付的 `src/lib/cms/` 模块是 VibeTide 唯一出口。

**导出（只从 `@/lib/cms` import，不直接访问内部文件）：**
- `CmsClient` + 5 接口（getChannels / getAppList / getCatalogTree / saveArticle / getArticleDetail）
- `publishArticleToCms({ articleId, appChannelSlug, operatorId, triggerSource })` — 核心入库
- `syncCmsCatalogs(orgId, options)` — 三步栏目同步
- `mapArticleToCms(article, ctx)` + `loadMapperContext(orgId, slug, org)`
- 错误类型：`CmsAuthError` / `CmsBusinessError` / `CmsNetworkError` / `CmsSchemaError` / `CmsConfigError`
- Feature flag：`isCmsPublishEnabled()` / `isCatalogSyncEnabled()`

**9 个 APP 栏目 slug（`ALL_APP_CHANNEL_SLUGS` 严格锁定）：**
`app_home / app_news / app_politics / app_sports / app_variety / app_livelihood_zhongcao / app_livelihood_tandian / app_livelihood_podcast / app_drama`

**关键 env（`.env.local`）：**
- `CMS_HOST` / `CMS_LOGIN_CMC_ID` / `CMS_LOGIN_CMC_TID` / `CMS_TENANT_ID` / `CMS_USERNAME`
- `VIBETIDE_CMS_PUBLISH_ENABLED`（默认 false，按 org 灰度）
- `VIBETIDE_CATALOG_SYNC_ENABLED`（默认 true）

**BullMQ Workers（CMS）：**
- `cmsCatalogSyncDaily`（每天 02:00 Asia/Shanghai 跑 org 级同步）
- `cmsCatalogSyncOnDemand`（dispatch `cms/catalog-sync`）
- `cmsStatusPoll`（入库后 5 次指数退避轮询，dispatch `cms/publication.submitted`）
- `cmsPublishRetry`（失败重试 3 次，dispatch `cms/publication.retry`）

**配置 UI：** `/settings/cms-mapping`（绑定 app_channels → cms_catalogs + 同步日志）

### MCP Integration Protocol Layer

The MCP layer exposes third-party adapters without bypassing business services.

- Adapter contract: `src/lib/integrations/types.ts`
- CMS adapter: `src/lib/integrations/cms/`
- MCP auth/server: `src/lib/mcp/`, `scripts/mcp-server.ts`
- Internal agent bridge: `src/lib/agent/tools/integration-bridge.ts`

CMS MCP tools must delegate to `@/lib/cms`; do not add raw CMS HTTP proxy tools.

### Scenario/Workflow 统一架构（B.1）

**单一真相源：** `workflow_templates` 表是 VibeTide 所有"场景"的唯一来源。

**数据流：**
- 首页场景网格、任务中心"发起新任务" 都调用 `listWorkflowTemplatesByOrg(orgId, filter)`
- 启动 mission 时双写 `scenario` (slug) + `workflowTemplateId` (uuid FK)
- `mission.scenario` 继续是 slug（builtin → legacy_scenario_key；custom → `custom_${nanoid(6)}`）
- 下游消费者（mission-executor / leader-plan / BullMQ workers / channels gateway）仍按 `mission.scenario` slug 分发（B.2 才迁到 workflowTemplateId）

**Category 12 值：** news / deep / social / advanced / livelihood / podcast / drama / daily_brief / video / analytics / distribution / custom

**Seed 来源（27+ builtin rows / org）：**
- SCENARIO_CONFIG (10)：`src/lib/constants.ts:456`（@deprecated，B.2 删）
- ADVANCED_SCENARIO_CONFIG (6)：`:610`（@deprecated）
- employeeScenarios.xiaolei (5)：迁到 workflow_templates
- 现有 templatesData (6)：补齐 icon/defaultTeam/appChannelSlug

**关键文件：**
- DAL: `src/lib/dal/workflow-templates.ts`
- Slug 工具: `src/lib/workflow-template-slug.ts`
- Seed 映射: `src/db/seed-builtin-workflows.ts`
- Fallback: `src/lib/scenario-fallback.ts`
- Spec: `docs/superpowers/specs/2026-04-19-unified-scenario-workflow-source.md`

**B.2 Pending（独立 spec）：** `/scenarios/customize` 重写、`channels/gateway.ts` 改读 DB、删除 SCENARIO_CONFIG 常量、DROP employee_scenarios 表、mission 下游消费者迁到 workflowTemplateId。

### Skill MD 标准（Track B / baoyu-inspired）

13 个 CMS/AIGC/场景 skill MD 按 baoyu-skills 规范标准化（Track B, 2026-04-19）：

**主文件规模：** 每个 `skills/<name>/SKILL.md` 目标 180-320 行（总计 ≤ 3500 行）

**Frontmatter 约定：**
- 保留：name / displayName / description / version / category
- 保留：metadata.{skill_kind, scenario_tags, compatibleEmployees, modelDependency, requires}
- 新增：metadata.implementation.{scriptPath, testPath}
- 新增：metadata.openclaw.{schemaPath, referenceSpec, subtemplatesPath?}
- 删除：metadata.runtime.{avgLatencyMs, maxConcurrency, timeoutMs, type}

**Body 10-12 章标准：**
1. 使用条件（合并 When/Prereq/Pre-flight）
2. 输入 / 输出（简要表，完整 Schema 外链）
3. 工作流 Checklist
4. 子模板分化（可选，摘要表）
5. 质量把关（合并自检+失败模式）
6. 输出模板 / 示例
7. EXTEND.md 示例
8. 上下游协作
9. 常见问题
10. 参考资料

**Script-heavy skill（duanju/zhongcao/podcast）子模板规范：**
- SKILL.md 只放摘要表（12+ / 4+ / 5+ 子类型矩阵）
- 详细规范写入 `src/lib/agent/skills/<name>-subtemplates.ts`（当前为 stub，follow-up 填充）

**Spec：** `docs/superpowers/specs/2026-04-19-skill-md-baoyu-standardization.md`
**Plan：** `docs/superpowers/plans/2026-04-19-skill-md-baoyu-standardization-plan.md`

### API Routes

`src/app/api/` has 10 route groups:
- `/ai/` — analysis, chat, edit (AI-powered content operations)
- `/chat/` — intent, intent-execute, stream (chat center backend)
- `/employees/`, `/inspiration/`, `/media-assets/`, `/missions/`, `/scenarios/`, `/skills/`, `/workflows/`

### Agent System

- **10 files + tools dir** in `src/lib/agent/`: assembly, execution, index, intent-parser, intent-recognition, model-router, prompt-templates, step-io, tool-registry, types, `tools/`
- **Agent assembly pipeline:** Load employee → skills → knowledge bases → memories (top-10) → compute proficiency → filter tools by authority → build 7-layer system prompt
- **7-layer prompt:** Identity → Skills+Proficiency → Authority → Sensitive Topics → Knowledge → Memories → Output+Quality Self-Eval
- **Intent recognition** (`intent-recognition.ts`): AI-driven skill routing in chat center; parses user messages to determine which employee/skill to invoke
- **Model router** (`model-router.ts`): Routes LLM calls to appropriate providers

### BullMQ (Background Jobs)

`src/lib/queue/` contains 6 Redis-backed queues with 23+ job handlers:
- **Workers:** `knowledge-base.ts`, `cms.ts`, `collection.ts`, `research.ts`, `scheduled.ts`, `publishing.ts`
- **Scheduler:** `src/lib/queue/scheduler.ts` — 9 cron jobs via node-cron
- **Dispatch:** `src/lib/queue/dispatch.ts` — 17 event types → queue routing
- **Entry:** `src/worker.ts` — standalone process (`npm run worker`)
- Production requires `REDIS_URL` (e.g. `redis://localhost:6379`)

### Knowledge Base Module

Top-level module at `/knowledge-bases` for managing AI employee knowledge bases (separate from `/channel-knowledge` which is the channel DNA dashboard).

- **Routes:** `src/app/(dashboard)/knowledge-bases/` — list page + `[id]` detail page (4 tabs: 文档/绑定员工/同步日志/设置)
- **DAL:** `src/lib/dal/knowledge-bases.ts` — `listKnowledgeBaseSummariesByOrg`, `getKnowledgeBaseById`, `listKnowledgeItems`, `getKnowledgeBaseBindings`, `getKnowledgeBaseSyncLogs`, `loadEmbeddedKnowledgeItems`, `assertKnowledgeBaseOwnership`. All multi-tenant scoped via `organizationId`.
- **Server actions:** `src/app/actions/knowledge-bases.ts` — `createKnowledgeBase`, `updateKnowledgeBase`, `deleteKnowledgeBase`, `addKnowledgeItem`, `crawlUrlIntoKB`, `updateKnowledgeItem`, `deleteKnowledgeItem`, `reindexKnowledgeBase`
- **Ingestion:** 3 paths — manual paste, .md/.txt upload, URL crawl via existing Jina Reader (`src/lib/web-fetch.ts:181`)
- **Chunking:** `src/lib/knowledge/chunking.ts` — paragraph + sentence + char-based fallback, 500-800 chars per chunk with 50-char overlap
- **Embeddings:** `src/lib/knowledge/embeddings.ts` — Jina `jina-embeddings-v3` (1024 dim), batch 100 with retry/backoff. Async via BullMQ `kb/document-created` job.
- **Retrieval:** `src/lib/knowledge/retrieval.ts` — application-layer cosine similarity over jsonb-stored vectors. V1 keeps jsonb (no pgvector); upgrade path documented when chunk count exceeds ~10k.
- **Agent integration:** `kb_search` tool in `tool-registry.ts` (`createKnowledgeBaseTools`). Auto-injected at execution time when employee has KB bindings. Filters by employee's bound KBs and skips KBs with `vectorization_status != 'done'`.

## AI SDK Notes

This project uses **AI SDK (Vercel) v6**. Key API differences from older versions:
- Use `stopWhen: stepCountIs(N)` not `maxSteps`
- Use `inputSchema` not `parameters` for tool definitions
- Use `maxOutputTokens` not `maxTokens`
- Import from `ai` package: `generateText`, `tool`, `stopWhen`, `stepCountIs`

## Conventions

- All UI text is in Chinese (Simplified)
- Product requirement docs are in `docs/requirement/` (7 comprehensive spec documents)
- Design/implementation plans go in `docs/plans/`
- Use OpenSpec workflow for architectural changes (see `openspec/AGENTS.md`)
- Glass UI design system: follow existing component patterns in `src/components/shared/` for consistent styling (GlassCard, frosted backgrounds, gradient accents)

## Git Workflow（强制：单分支开发）

**本仓库只有 `main` 一个分支，所有功能迭代直接在 `main` 上进行。**

- **禁止创建 feature / worktree 分支**（包括 `feature/*`、`claude/*`、`.worktrees/`、`.claude/worktrees/` 等）
- **所有 commit 直接落在 `main`**。每个完成的逻辑单元立即 commit + push
- **Agent / subagent 工作也必须在 `main` 上进行**，不要"为了隔离"而私自开分支
- **不要使用 `git worktree add`**
- **Phase 级 / 大 refactor 的临时中间态**：用 tsc 零错误 + 每个 commit 都能独立 build 来保证安全

所有的按钮或 lab 等任何可以点击触发事件的按钮，不要带边框
