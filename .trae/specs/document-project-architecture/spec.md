# VibeTide 项目设计与架构文档

## Why

VibeTide 是一个中文 AI 驱动的内容管理平台，管理 9 个专职 AI 员工协作完成内容生产全流程。项目历经多轮功能迭代和架构重构，需要一份完整的设计与架构文档作为团队协作和后续开发的权威参考。

## What Changes

- 新增 `docs/architecture.md` — 项目整体架构文档
- 新增 `docs/design.md` — 系统设计文档

## Impact

- Affected specs: 全局参考文档，不影响现有功能
- Affected code: 无代码变更，纯文档产出

---

## ADDED Requirements

### Requirement: 项目架构文档

系统 SHALL 提供一份完整的项目架构文档 `docs/architecture.md`，包含以下章节：

#### 1. 技术栈概览

| 层次 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router + Turbopack) | 16.1.6 |
| 前端 | React 19 + TypeScript 5 (strict) | 19.2.3 / ^5 |
| 数据库 | Supabase (PostgreSQL) via Drizzle ORM | ^0.45.1 |
| 认证 | Supabase Auth (@supabase/ssr) | ^0.8.0 |
| AI | Vercel AI SDK v6 + @ai-sdk/openai | ^6.0.116 |
| UI | shadcn/ui (new-york) + Radix UI + Tailwind CSS v4 | — |
| 图表 | Recharts | ^3.7.0 |
| 动画 | Framer Motion | ^12.34.3 |
| 富文本 | Tiptap | ^3.20.4 |
| 后台任务 | BullMQ + ioredis + node-cron | — |
| 对象存储 | 火山引擎 TOS | ^2.9.1 |
| 测试 | Vitest | ^4.1.4 |

#### 2. 系统架构图

```
┌──────────────────────────────────────────────────────────┐
│                      用户浏览器                            │
│  Landing / Login / Dashboard (48 路由模块)                 │
└──────────────┬───────────────────────────────────────────┘
               │ HTTP / SSE
┌──────────────▼───────────────────────────────────────────┐
│                   Next.js App Router                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Server Pages│  │ Server Actions│  │  API Routes(16) │  │
│  │ (page.tsx)  │  │ (actions/)   │  │  (api/)         │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬─────────┘  │
│         │                │                   │            │
│  ┌──────▼────────────────▼───────────────────▼─────────┐  │
│  │                    DAL (lib/dal/)                     │  │
│  │  62 个数据访问模块 — 只读查询，返回 UI 类型            │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                          │                                 │
│  ┌──────────────────────▼──────────────────────────────┐  │
│  │              Drizzle ORM (db/schema/)                │  │
│  │  56 个 Schema 文件 / ~145 表 / 72+ 枚举              │  │
│  └──────────────────────┬──────────────────────────────┘  │
└─────────────────────────┼─────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │  Supabase PostgreSQL   │
              │  (Docker 自托管)        │
              └───────────────────────┘
```

#### 3. 路由结构

**三大路由区域：**

| 区域 | 路径 | 说明 | 认证 |
|------|------|------|------|
| Landing | `src/app/landing/` | 公开落地页（`/`） | 否 |
| Auth | `src/app/(auth)/` | 登录/注册/OAuth回调 | 否 |
| Dashboard | `src/app/(dashboard)/` | 48 个功能模块 | 是 |

**Dashboard 包含 48 个子模块：**
- AI 员工管理（ai-employees、employee-marketplace）
- 内容生产（creation、super-creation、articles、production-templates）
- 热点与选题（hot-topics、inspiration、missing-topics、topic-compare）
- 研究中心（research 及 5 个子路由）
- 任务系统（missions、workflows）
- 聊天中心（chat、mulan）
- 数据分析（analytics、leaderboard、competitive、benchmark-accounts）
- 媒资管理（media-assets、asset-intelligence、asset-revive）
- 发布运营（publishing、channel-advisor、channel-knowledge）
- 知识管理（knowledge-bases、case-library）
- 审核（approvals、batch-review、audit-center）
- 系统（admin、settings、skills、categories）

#### 4. 数据流架构

```
Server Page (page.tsx)
  → DAL (src/lib/dal/)        只读查询
  → Drizzle ORM               SQL 构建
  → Supabase PostgreSQL       数据存储

Mutations:
  Client Component (*-client.tsx)
  → Server Actions (actions/)  "use server" + requireAuth()
  → Drizzle ORM INSERT/UPDATE/DELETE
  → revalidatePath()           缓存失效
```

**Server/Client 分离模式：**
- `page.tsx` — Server Component，获取数据，传递 props
- `*-client.tsx` — Client Component ("use client")，处理交互

#### 5. Agent 系统架构

```
┌─────────────────────────────────────────────────────┐
│                  用户消息                              │
│                    │                                  │
│            ┌───────▼───────┐                          │
│            │  fastClassify │  问候语/单步命令 → free chat│
│            └───────┬───────┘                          │
│                    │ needs_llm                        │
│     ┌──────────────▼──────────────┐                  │
│     │    意图识别 (intent-recognition)               │
│     │  Phase 1: 复杂任务规则(6条) → 多员工协作         │
│     │  Phase 2: Level 0 规则(11条) → 单员工分派       │
│     │  Phase 3: LLM 兜底 → 员工优先 prompt            │
│     └──────────────┬──────────────┘                  │
│                    │ IntentResult                     │
│     ┌──────────────▼──────────────┐                  │
│     │    Agent 组装 (assembly.ts)  │                  │
│     │  7 层 System Prompt:        │                  │
│     │  ① Identity                 │                  │
│     │  ② Skills + Proficiency     │                  │
│     │  ③ Execution Guide          │                  │
│     │  ④ Authority Level          │                  │
│     │  ⑤ Sensitive Topics         │                  │
│     │  ⑥ Knowledge + Memories     │                  │
│     │  ⑦ Output + Quality Self-Eval│                 │
│     └──────────────┬──────────────┘                  │
│                    │                                  │
│     ┌──────────────▼──────────────┐                  │
│     │  工具注册 (tool-registry.ts) │                  │
│     │  20+ 工具: web_search,       │                  │
│     │  web_deep_read, create_task  │                  │
│     │  knowledge_retrieval, etc.   │                  │
│     └──────────────┬──────────────┘                  │
│                    │                                  │
│     ┌──────────────▼──────────────┐                  │
│     │   执行 (execution.ts /       │                  │
│     │        intent-execute/)      │                  │
│     │   LLM 流式 / 短路直出        │                  │
│     └─────────────────────────────┘                  │
└─────────────────────────────────────────────────────┘
```

**9 个 AI 员工（EmployeeId）：**

| slug | 名称 | 角色 | 职责 |
|------|------|------|------|
| xiaolei | 小乐 | 热点分析师 | 全网搜索、热点监控、趋势追踪 |
| xiaoce | 小策 | 选题策划师 | 选题提取、角度设计、受众分析 |
| xiaozi | 小资 | 素材研究员 | 素材搜索、知识检索、案例参考 |
| xiaowen | 小文 | 内容创作师 | 内容生成、标题生成、风格改写 |
| xiaojian | 小剪 | 视频制片人 | 视频剪辑、缩略图、布局设计 |
| xiaoshen | 小深 | 质量审核官 | 质量审核、合规检查、事实核查 |
| xiaofa | 小发 | 渠道运营师 | 发布策略、风格适配、翻译 |
| xiaoshu | 小数 | 数据分析师 | 数据报告、竞品分析、受众分析 |
| xiaotan | 小探 | 深度调查员 | 深度调查、舆情分析 |
| leader | 穆兰 | 调度中枢 | 意图路由、任务调度、不执行技能 |
| advisor | — | 频道顾问 | 渠道策略建议 |

**Leader（穆兰）特殊角色：**
- 不直接执行任何技能（EMPLOYEE_CORE_SKILLS.leader = []）
- 只保留 `create_task` 调度工具
- 意图识别后分派给其他员工执行
- 复杂任务可调度多个员工协作

#### 6. 意图识别优先级

```
用户消息 → fastClassify
  ├─ 问候语 → free chat
  ├─ 单步命令 → free chat
  └─ needs_llm → recognizeIntent
       ├─ Phase 1: 复杂任务规则（6条）→ 多员工协作
       ├─ Phase 2: Level 0 规则（11条）→ 单员工分派
       └─ Phase 3: LLM 兜底 → 员工优先 prompt
```

**复杂任务规则示例：**
- "短视频策划制作" → xiaoce + xiaowen + xiaojian
- "深度报道" → xiaoce + xiaolei + xiaowen + xiaoshen
- "多平台发布" → xiaofa + xiaoshu

#### 7. 技能系统

```
skills/                           44 个内置技能目录
  └── web_search/SKILL.md         标准化技能描述（baoyu-skills 规范）

src/lib/agent/tool-registry.ts    20+ 工具实现
src/db/schema/skills.ts           skills 表（slug/name/category/type）
src/db/schema/enums.ts            skillCategoryEnum（7 大分类）
```

**7 大技能分类：**
- `info_perception` — 信息感知（web_search、trending_topics 等）
- `info_processing` — 信息处理（content_generate、summary_generate 等）
- `system_interop` — 系统互操作（cms_publish、browser_automation 等）
- `automation` — 自动化（task_planning、trend_monitor 等）
- `communication` — 沟通（translation、style_rewrite 等）
- `multimodal` — 多模态（video_edit_plan、thumbnail_generate 等）
- `other` — 其他

#### 8. 数据库架构

```
~145 张表 / 72+ 枚举 / 56 个 schema 文件

核心表:
  organizations          组织（多租户）
  user_profiles          用户档案
  ai_employees           AI 员工
  skills                 技能定义
  employee_skills        员工-技能绑定（多对多）
  missions               任务/任务
  tasks                  子任务
  workflows              工作流模板
  saved_conversations    对话记录
  conversation_participants  群聊参与者
  articles               文章
  media_assets           媒资
  knowledge_bases        知识库
  categories             分类

多租户: 所有核心表包含 organization_id FK
内容隔离: created_by + content_visibility（personal/org）
RBAC: 3 角色（admin/editor/viewer）+ isSuperAdmin 标志
```

#### 9. 认证与权限

```
认证流程:
  Supabase Auth (email/password)
  → @supabase/ssr (SSR cookie 管理)
  → requireAuth() / requireCurrentOrgId()

权限系统 (RBAC):
  src/lib/rbac.ts
  3 角色: admin / editor / viewer
  45+ 权限点
  isSuperAdmin 标志（超级管理员）
```

#### 10. 设计系统

```
UI 组件层次:
  src/components/ui/          shadcn/ui 基础组件（25+）
  src/components/shared/      业务复用组件（46 个）
  src/components/charts/      图表组件（6 个）
  src/components/layout/      布局组件（AppSidebar、Topbar）

核心设计规范:
  Glass UI — 磨砂玻璃风格
  cn() — Tailwind 类名合并工具
  强制使用共享组件（ESLint 规则检查）
  所有 UI 文本使用中文
```

---

### Requirement: 系统设计文档

系统 SHALL 提供一份系统设计文档 `docs/design.md`，包含以下章节：

#### 1. 模块职责划分

| 模块 | 目录 | 职责 |
|------|------|------|
| 路由层 | `src/app/` | 页面渲染、API 端点、Server Actions |
| 数据访问层 | `src/lib/dal/` | 只读查询，62 个模块 |
| Agent 系统 | `src/lib/agent/` | 意图识别、Agent 组装、工具注册、执行引擎 |
| 业务逻辑 | `src/lib/` | CMS、RBAC、知识库、Web 抓取等 |
| 数据库 | `src/db/` | Schema 定义、seed、连接管理 |
| 组件 | `src/components/` | UI 组件库（shared + charts + layout） |
| 技能定义 | `skills/` | 44 个 SKILL.md 技能描述文件 |
| 前端 Hooks | `src/hooks/` | use-chat-stream 等 |

#### 2. 关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 员工优先意图识别 | 先匹配员工再匹配技能 | 减少不必要的技能调用，直接分派最合适的执行者 |
| Leader 纯调度 | 穆兰不执行技能 | 职责分离，调度者不兼任执行者 |
| Server/Client 分离 | page.tsx + *-client.tsx | 平衡 SSR 性能与客户端交互 |
| Drizzle ORM | 而非 Prisma | 更轻量、TypeScript 原生、Supabase PgBouncer 兼容 |
| jsonb 向量存储 | 而非 pgvector | V1 简化部署，应用层余弦相似度 |
| 工作流仅用户触发 | 不自动匹配 | 用户控制权优先，避免误触发 |

#### 3. API 路由清单

| 路径 | 功能 |
|------|------|
| `/api/chat/intent` | 意图识别 |
| `/api/chat/intent-execute` | 意图执行（SSE 流式） |
| `/api/chat/stream` | 自由对话（SSE 流式） |
| `/api/chat/feedback` | 对话反馈 |
| `/api/chat/upload` | 文件上传 |
| `/api/ai/analysis` | AI 分析 |
| `/api/ai/chat` | AI 对话 |
| `/api/ai/edit` | AI 编辑 |
| `/api/cms/catalog-sync` | CMS 栏目同步 |
| `/api/missions/[id]/progress` | 任务进度 |
| `/api/missions/[id]/artifacts` | 任务产物 |
| `/api/workflows/generate` | 工作流生成 |
| `/api/skills/[id]/export` | 技能导出 |
| `/api/inspiration/crawl` | 灵感抓取 |
| `/api/benchmarking/report` | 竞品分析报告 |

#### 4. 环境变量

| 变量 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端 Key |
| `DATABASE_URL` | 直连 PostgreSQL |
| `OPENAI_API_KEY` | DeepSeek API Key |
| `OPENAI_API_BASE_URL` | https://api.deepseek.com/v1 |
| `OPENAI_MODEL` | deepseek-chat |
| `TAVILY_API_KEY` | Tavily 搜索 API |
| `JINA_API_KEY` | Jina Reader API |
| `TRENDING_API_URL/KEY` | 热榜聚合 API |
| `INNGEST_EVENT_KEY` | Inngest 事件 Key |
| `INNGEST_SIGNING_KEY` | Inngest 签名 Key |

---

## Checklist

- [ ] architecture.md 覆盖技术栈、系统架构图、路由结构、数据流、Agent 系统、数据库、认证权限、设计系统
- [ ] design.md 覆盖模块职责、设计决策、API 路由、环境变量
- [ ] 文档内容与代码实际状态一致（非过时信息）
- [ ] 所有图表使用 Mermaid 或 ASCII 格式
- [ ] 文档全部使用中文
