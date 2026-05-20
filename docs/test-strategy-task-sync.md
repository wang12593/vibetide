# VibeTide 任务同步功能模块 — 专项测试方案

| 字段 | 内容 |
|------|------|
| 文档版本 | V1.0 |
| 编制日期 | 2026年5月19日 |
| 适用模块 | CMS 栏目同步 / CMS 发布状态同步 / 数据采集同步 / 研究任务同步 / 对话-任务同步 / 知识库向量化同步 |
| 编制依据 | `docs/test-strategy.md`（总体测试方案）、`docs/plans/system-test-cases.md`（系统测试用例）、`CLAUDE.md`（项目架构） |

---

## 1. 引言

### 1.1 项目背景

VibeTide 的"任务同步"不是一个单一模块，而是横跨 6 个子系统的一组**数据一致性保障机制**。所有同步功能统一基于 **BullMQ + Redis** 的后台任务队列实现，包括：定时 Cron、事件驱动 dispatch、指数退避重试、幂等写入、同步日志审计。

| 同步子系统 | 同步方向 | 触发方式 | 核心队列 |
|-----------|---------|---------|---------|
| CMS 栏目同步 | CMS → 本地 | Cron + 手动 | `cms` |
| CMS 发布状态同步 | 本地 ↔ CMS | 事件驱动 | `cms` |
| 数据采集同步 | 外部源 → 本地 | Cron + 手动 | `collection` |
| 研究任务同步 | 外部源 → 本地 | 事件驱动 | `research` |
| 对话-任务同步 | 对话 → 任务中心 | 意图执行时自动 | — |
| 知识库向量化同步 | 本地计算 | 事件驱动 | `knowledgeBase` |

### 1.2 测试目标

| 维度 | 目标 |
|------|------|
| 数据一致性 | 同步后本地数据与外部源 100% 一致（立项文档指标：栏目同步准确率 100%） |
| 幂等安全 | 同一事件重复投递不产生重复数据、不破坏已有数据 |
| 故障恢复 | 重试机制能在 3 次内恢复瞬时故障；保护性措施在极端情况下不误删数据 |
| 状态流转正确 | Mission / Publication / CollectionRun 状态机流转完整，终态不可逆 |
| 日志可追溯 | 每次同步操作均有日志记录，可通过 UI 或数据库查询回溯 |
| 性能基线 | 单次栏目同步 ≤ 30s，单次采集源运行 ≤ 60s，向量化 1000 chunks ≤ 5min |

### 1.3 参考文档

| 文档 | 路径 |
|------|------|
| 总体测试方案 | `docs/test-strategy.md` |
| 系统测试用例 | `docs/plans/system-test-cases.md`（M6-CMS / M6-SYNC 章节） |
| 手动测试用例 | `docs/manual-test-cases.md`（12.2 CMS 栏目映射） |
| 项目架构 | `CLAUDE.md`（CMS Integration Layer / BullMQ Workers 章节） |
| 审计报告 | `docs/audit-report-2026-05-16.md`（M-5/M-6 硬编码问题） |
| 对话任务同步 Spec | `openspec/changes/add-multi-round-chat-confirmation/specs/chat-mission-sync/spec.md` |

---

## 2. 测试范围

### 2.1 测试内容（In-Scope）

#### 功能模块

| 优先级 | 模块 | 关键验证点 |
|--------|------|-----------|
| **P0** | CMS 栏目同步 | `syncCmsCatalogs()` 四步流程、0 栏目保护、dryRun 模式 |
| **P0** | CMS 发布状态轮询 | 5 次指数退避轮询、终态判定、超时处理 |
| **P0** | 对话-任务同步 | 意图执行自动创建 Mission、步骤状态同步更新 |
| **P1** | CMS 发布重试 | 3 次退避重试、可重试错误判定、耗尽标记 |
| **P1** | 数据采集同步 | Cron 触发、Adapter 执行、去重写入、桥接到 hot_topics |
| **P1** | 研究任务同步 | Tavily 爬取、白名单爬取、文章入库、正文补全 |
| **P1** | 知识库向量化同步 | Jina Embeddings 批量调用、chunk 状态更新、同步日志 |
| **P2** | 差量对比算法 | `reconcileCatalogs()` inserts/updates/softDeletes/复活 |
| **P2** | 采集去重写入 | URL hash + 内容指纹三级去重 |
| **P2** | 同步日志 UI | `/settings/cms-mapping` 日志 Tab、`/knowledge-bases/[id]` 同步日志 |

#### 非功能特性

| 特性 | 测试重点 |
|------|---------|
| 幂等性 | 同一事件重复 dispatch 不产生副作用 |
| 并发安全 | 多 Worker 并发处理同一 org 的同步任务 |
| 错误隔离 | 单条 item 失败不影响批次内其他 item |
| 性能 | 大数据量同步的耗时和资源消耗 |
| 安全 | Feature flag 控制同步开关、CMS API 凭据保护 |

### 2.2 不测试内容（Out-of-Scope）

| 排除项 | 原因 |
|--------|------|
| Redis 本身的可靠性 | 由 Redis 服务保障 |
| BullMQ 框架内部逻辑 | 框架已自测，仅验证 dispatch/Worker 配置 |
| CMS 外部平台 API 的正确性 | 第三方服务，通过 Mock 测试 |
| Jina/Tavily API 的 Embeddings 质量第三方服务，通过 Mock 测试 |
| 渠道消息同步（钉钉/企微）独立模块，不在本次范围内 |

---

## 3. 测试策略

### 3.1 测试分层与方法

```
                    ┌──────────────────────┐
                    │   E2E 测试 (5%)       │  ← Playwright
                    │   CMS 映射页面 UI 验证  │
                    ├──────────────────────┤
                    │   集成测试 (35%)       │  ← Vitest
                    │   BullMQ Worker + DAL  │
                    ├──────────────────────┤
                    │   单元测试 (45%)       │  ← Vitest
                    │   纯函数/算法/Mock 外部  │
                    ├──────────────────────┤
                    │   手工测试 (15%)       │  ← 探索性 + 体验测试
                    │   Cron 触发 + 日志 UI   │
                    └──────────────────────┘
```

#### 单元测试（45%）

| 测试域 | 目标新增 | 关键测试点 |
|--------|---------|-----------|
| `reconcileCatalogs()` | 6 个 | inserts/updates/softDeletes/复活/0栏目保护/dryRun |
| `flattenTree()` | 3 个 | 多层级扁平化、空树、单节点 |
| `writeItems()` 去重 | 4 个 | URL hash 去重、内容指纹去重、全新插入、合并 sourceChannels |
| `bridgeCollectedItemToHotTopic()` | 3 个 | 优先级计算（P0/P1/P2）、titleHash upsert、shouldEnrich 标志 |
| `ingestArticle()` | 3 个 | URL hash 去重、outlet 匹配、contentFetchStatus 状态 |
| `fetchAndUpdateArticleContent()` | 4 个 | pending→fetching→done、幂等（done 跳过）、失败重试、skipped |
| `createMissionFromChat()` | 3 个 | 自动创建 Mission、关联 conversationId、fire-and-forget 不阻塞 |
| CMS 状态机 | 4 个 | submitting→submitted、retrying→submitted、终态判定、非终态继续 |
| `syncCmsCatalogs()` 错误分支 | 3 个 | feature flag 关闭、CMS API 失败、0 栏目保护 |

#### 集成测试（35%）

| 测试域 | 目标新增 | 关键测试点 |
|--------|---------|-----------|
| CMS 栏目同步全流程 | 2 个 | Mock CMS API → 四步同步 → DB 写入 → 日志记录 |
| CMS 状态轮询全流程 | 2 个 | Mock `getArticleDetail` → 5 轮轮询 → 终态标记 |
| CMS 重试全流程 | 1 个 | Mock 失败→重试→成功/耗尽 |
| 采集 Cron 全流程 | 2 个 | Mock adapter → writeItems → bridge → hot_topics |
| 研究 Tavily 爬取 | 2 个 | Mock Tavily + Jina → ingestArticle → 正文补全 |
| 知识库向量化 | 1 个 | Mock Jina Embeddings → 批量回写 → KB 状态更新 |
| 对话-任务同步 | 2 个 | 意图执行 → Mission 创建 → Task 状态同步 |
| BullMQ dispatch 路由 | 1 个 | 验证 17 种事件正确路由到对应队列 |
| 多租户隔离 | 2 个 | Org A 的同步不影响 Org B 的数据 |

#### E2E 测试（5%）

| 测试场景 | 覆盖用例 | 说明 |
|---------|---------|------|
| CMS 映射页面访问 | TC-M10-CMS-001/002 | 已有 Playwright flow06 覆盖 |
| 触发栏目同步 | TC-M10-CMS-001 | 点击「立即同步」→ 验证 UI 反馈 |

#### 手工测试（15%）

| 类型 | 覆盖内容 |
|------|---------|
| Cron 触发验证 | 手动启动 Worker 进程，验证 Cron 按时触发 |
| 同步日志 UI | `/settings/cms-mapping` 日志 Tab 展示 |
| 大数据量测试 | 100+ 栏目同步、1000+ 条采集写入 |
| 网络异常模拟 | 断开 CMS API 连接，验证重试和保护性措施 |
| Feature flag 开关 | 关闭 `VIBETIDE_CATALOG_SYNC_ENABLED`，验证同步被跳过 |

### 3.2 专项测试策略

#### 幂等性测试

| 场景 | 验证方法 |
|------|---------|
| 栏目同步重复执行 | 同一 org 连续 2 次 `syncCmsCatalogs`，第二次 inserts=0 |
| 发布状态轮询重复 dispatch | 同一 publicationId 重复 dispatch `cms/publication.submitted`，不产生重复轮询 |
| 采集 item 重复写入 | 同一 URL hash 的 item 重复 `writeItems`，不产生重复记录 |
| 研究 article 重复入库 | 同一 url_hash 的文章重复 `ingestArticle`，`onConflictDoNothing` |
| 知识库重复向量化 | 已有 embedding 的 chunks 不重复调用 Jina |

#### 并发安全测试

| 场景 | 验证方法 |
|------|---------|
| 同一 org 并发栏目同步 | 2 个 Worker 同时处理同一 org 的 `cms/catalog-sync`，验证无死锁 |
| 同一源并发采集运行 | 2 个 Worker 同时运行同一 source，验证 run 状态一致性 |
| 对话并发创建 Mission | 多个对话同时触发意图执行，验证 Mission 不重复创建 |

#### 错误恢复测试

| 场景 | 预期 |
|------|------|
| CMS API 返回 500 | BullMQ 重试 3 次，最终失败写入 `cms_sync_logs`（status=failed） |
| CMS API 返回 0 栏目 | 保护性措施触发，不执行写操作，记录 warning |
| Jina Embeddings 超时 | BullMQ 重试 3 次，单条 chunk 失败不影响批次 |
| Tavily 搜索返回空结果 | 单 keyword 失败不影响其他 keyword |
| 数据库写入失败 | 事务回滚，run 状态标记 failed |

#### 性能测试

| 场景 | 目标指标 | 工具 |
|------|---------|------|
| 单 org 栏目同步（50 栏目） | ≤ 30s | Vitest benchmark |
| 单源采集（100 条） | ≤ 60s | Vitest benchmark |
| 知识库向量化（1000 chunks） | ≤ 5min | 手动计时 |
| reconcileCatalogs（1000 栏目） | ≤ 500ms | Vitest benchmark |
| dispatch 吞吐量 | 100 events/s | Vitest + 计时 |

### 3.3 测试工具栈

| 类别 | 工具 | 用途 |
|------|------|------|
| 单元/集成测试 | **Vitest 4.1.4** | `vi.mock` Mock CMS/Jina/Tavily API |
| 数据库 Mock | **Drizzle `eq` / `sql`** | 内存 SQLite 或 Mock DB 查询 |
| 外部 API Mock | **Vitest `vi.fn()`** | Mock CmsClient / Jina / Tavily |
| 类型检查 | **TypeScript 5** | `npx tsc --noEmit` |
| E2E | **Playwright** | CMS 映射页面验证 |
| Redis | **BullMQ `Queue` / `Worker`** | 测试 dispatch 路由和 Worker 配置 |
| 构建验证 | **Next.js build** | `npm run build` |

---

## 4. 环境与数据

### 4.1 环境拓扑

| 环境 | 用途 | 部署方式 | 数据库 | Redis | 备注 |
|:---|:---|:---|:---|:---|:---|
| **DEV（本地）** | 单元/集成测试 | `npm test` | Mock / SQLite | Mock | 开发者本地 |
| **SIT（集成）** | Worker 全流程测试 | `npm run worker:dev` | 测试库 | 本地 Redis | 需要 `.env.local` 配置 |
| **E2E** | Playwright UI 验证 | `npm run dev` + `npm run test:e2e` | 测试库 | — | Playwright 自动启动 dev server |

### 4.2 数据准备

| 数据类型 | 准备方式 | 说明 |
|---------|---------|------|
| CMS 栏目 Mock 数据 | `vi.mock` 返回固定栏目树 | 3 层深度、50+ 节点 |
| 采集源 Mock 数据 | Seed 脚本或 `vi.mock` | 5 种 adapter 类型各 1 个 |
| 研究 Mock 数据 | `vi.mock` Tavily + Jina | 每种 keyword 返回 10 条结果 |
| 测试组织 | Supabase Admin API 创建 | 至少 2 个 org 用于隔离测试 |
| 测试用户 | `e2e/global-setup.js` 已创建 | admin / editor / viewer |

### 4.3 Mock 策略

| 依赖 | Mock 方式 | 说明 |
|------|----------|------|
| CMS 外部 API（CmsClient） | `vi.mock("@/lib/cms")` | Mock 登录/入库/栏目同步/状态查询 |
| Jina Embeddings | `vi.mock("@/lib/knowledge/embeddings")` | 返回固定 1024 维向量 |
| Jina Reader | `vi.mock("@/lib/web-fetch")` | 返回固定文章正文 |
| Tavily Search | `vi.mock` fetch | 返回固定搜索结果 |
| Redis / BullMQ | 集成测试使用真实 Redis；单元测试 Mock | `vi.mock("@/lib/queue")` |
| AI SDK | `vi.mock("ai")` | Mock `generateText` 返回固定意图结果 |

---

## 5. 准入与准出标准

### 5.1 提测标准（Entry Criteria）

- 开发完成所有同步模块的代码实现和 BullMQ Worker 注册
- `npx tsc --noEmit` 零错误
- `npm run build` 生产构建通过
- 核心同步函数有基础单元测试覆盖

### 5.2 上线标准（Exit Criteria）

- 100% 执行计划内测试用例
- P0 级 Bug 修复率 100%（0 栏目保护、幂等性、终态判定）
- P1 级 Bug 修复率 100%（重试机制、去重写入、状态同步）
- P2 级 Bug 修复率 ≥ 95%
- 单元测试覆盖率 ≥ 70%（同步核心模块 `cms/`、`collection/`、`research/`）
- 所有保护性措施测试通过（0 栏目保护、feature flag、事务回滚）
- 性能指标满足基线要求

---

## 6. 进度与资源

### 6.1 关键里程碑

| 阶段 | 产出 |
|:---|:---|
| 单元测试 — 纯函数 | `reconcileCatalogs` / `flattenTree` / `writeItems` / 状态机 覆盖 |
| 单元测试 — Mock 外部 | `syncCmsCatalogs` / `ingestArticle` / `fetchAndUpdateArticleContent` / `createMissionFromChat` 覆盖 |
| 集成测试 — BullMQ Worker | CMS / Collection / Research Worker 全流程验证 |
| 集成测试 — 多租户 | Org 隔离、并发安全 |
| E2E + 手工测试 | Playwright CMS 页面 + Cron 触发 + Feature flag |
| 回归 + 性能 | 性能基线 + 全量回归 |

### 6.2 资源需求

| 角色 | 职责 |
|------|------|
| QA 工程师 | 编写/执行测试用例、手工测试、缺陷管理 |
| 后端开发 | 配合 Mock 策略、修复 Bug、Code Review |
| AI 辅助 | 自动生成测试代码骨架、Mock 数据 |

---

## 7. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| CMS 外部 API 不稳定 | 集成测试无法执行 | 高 | Mock CMS API 进行测试；仅在 SIT 环境验证真实 API |
| Redis 未本地部署 | Worker 集成测试无法运行 | 中 | 提供 Docker Compose 快速启动 Redis；单元测试不依赖 Redis |
| 大数据量同步耗时超预期 | 性能测试不达标 | 中 | 分批处理优化；限制单次同步数量 |
| 0 栏目保护被绕过 | 数据被误删 | 低 | P0 级测试用例覆盖；代码 review 确认保护逻辑 |
| CMS 硬编码问题（审计 M-5/M-6） | 同步配置无法动态调整 | 中 | 测试中记录该问题为 known issue；后续 spec 修复 |
| 知识库向量化批次失败 | 部分 chunks 无 embedding | 低 | 单条隔离机制测试；重试机制验证 |

---

## 8. 测试用例索引

以下测试用例来自 `docs/plans/system-test-cases.md`，与本次同步模块测试直接相关：

### CMS 栏目同步

| 用例 ID | 名称 | 优先级 | 测试类型 |
|---------|------|--------|---------|
| TC-M6-SYNC-001 | 完整同步流程 | P1 | 集成测试 |
| TC-M6-SYNC-002 | 差量对比—新增栏目 | P1 | 单元测试 |
| TC-M6-SYNC-003 | 差量对比—字段变更 | P2 | 单元测试 |
| TC-M6-SYNC-004 | 差量对比—删除同步 | P2 | 集成测试 |
| TC-M6-SYNC-005 | CMS 返回 0 栏目保护 | **P0** | 集成测试 |
| TC-M6-SYNC-006 | DryRun 模式 | P2 | 集成测试 |

### CMS 发布状态

| 用例 ID | 名称 | 优先级 | 测试类型 |
|---------|------|--------|---------|
| TC-M6-CMS-008 | 状态轮询（5 次指数退避） | P1 | 集成测试 |
| TC-M6-CMS-009 | 发布失败重试（3 次） | P1 | 集成测试 |

### CMS 映射配置（E2E）

| 用例 ID | 名称 | 优先级 | 测试类型 |
|---------|------|--------|---------|
| TC-M10-CMS-001 | 触发栏目同步 | P1 | E2E |
| TC-M10-CMS-002 | 查看同步日志 | P2 | E2E |

### 对话-任务同步

| 用例 ID | 名称 | 优先级 | 测试类型 |
|---------|------|--------|---------|
| CHAT-MISSION-001 | 意图执行自动创建 Mission | P0 | 集成测试 |
| CHAT-MISSION-002 | 步骤状态同步更新 | P1 | 集成测试 |
| CHAT-MISSION-003 | Mission 关联 conversationId | P1 | 单元测试 |
| CHAT-MISSION-004 | 全部步骤完成 → Mission completed | P1 | 集成测试 |

---

## 9. 已知问题与注意事项

1. **CMS 硬编码问题（审计 M-5/M-6）**：`cms/article-mapper/index.ts` 和 `settings/cms-mapping/cms-mapping-client.tsx` 中硬编码了 CMS site/app/catalog ID（81/1768/10210）。建议后续迁移到数据库配置，当前测试中需确认硬编码值在测试环境中可用。
2. **Inngest 残留清理已完成**：所有 Inngest 引用已替换为 BullMQ（`remove-inngest-residual` 变更），测试中不再考虑 Inngest 路径。
3. **知识库向量化 V1 使用 jsonb 存储向量**：当 chunk 数量超过 ~10k 时性能可能下降，当前测试在 1000 chunks 范围内验证。
4. **对话-任务同步已实现**：`createMissionFromChat` / `startMissionFromChat` 已在 `add-multi-round-chat-confirmation` 变更中实现，需要测试验证。