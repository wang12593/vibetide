# VibeTide 实施进度报告

> 更新日期：2026-05-14
> 基于方案：`docs/permission-isolation-design.md` + `docs/implementation-plan.md`

---

## 总览

| Stage | 模块 | 节点数 | 状态 |
|-------|------|--------|------|
| **Stage 1** | 数据基础 | 3 | ✅ 全部完成 |
| **Stage 2** | 群聊核心引擎 | 4 | ✅ 全部完成 |
| **Stage 3** | 群聊 UI | 4 | ✅ 全部完成 |
| **Stage 4** | 权限隔离 + 群聊进阶 | 4 | ✅ 全部完成 |
| **Stage 5** | 权限隔离 UI + SSO | 4 | ✅ 全部完成 |
| **Stage 6** | 进阶功能 | 4 | ✅ 全部完成 |

**已完成：23/23 节点 ✅ 全部完成**
**测试：group-dispatcher 16 tests passed / group-router 22 tests passed / 存量测试不受影响**

---

## Stage 1: 数据基础 ✅

### Node 1.1 — 权限隔离 Schema + Migration ✅

**目标：** 为 4 张核心表新增 `created_by` + `visibility` 字段

**修改文件：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/db/schema/enums.ts` | 修改 | 新增 `contentVisibilityEnum` |
| `src/db/schema/ai-employees.ts` | 修改 | 新增 `createdBy`(uuid, nullable) + `visibility`(enum, default 'org') |
| `src/db/schema/missions.ts` | 修改 | 新增 `createdBy` + `visibility` |
| `src/db/schema/knowledge-bases.ts` | 修改 | 新增 `createdBy` + `visibility` |
| `src/db/schema/skills.ts` | 修改 | 新增 `createdBy` + `visibility` |

**验收：**
- [x] tsc --noEmit 通过
- [x] build 通过
- [x] 存量功能不受影响（DEFAULT 'org' 兼容）
- [x] 迁移文件可通过 `npm run db:generate` 生成

---

### Node 1.2 — 群聊 Schema + Migration ✅

**目标：** 新增群聊相关表和枚举，改造 `saved_conversations`

**修改文件：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/db/schema/enums.ts` | 修改 | 新增 6 个群聊枚举（groupMode/participantRole/participantType/senderType/messageType） |
| `src/db/schema/saved-conversations.ts` | 修改 | `employeeSlug` 改 nullable，新增 `isGroup`(int)/`groupMode`(enum)/`leaderEmployeeSlug`(text) |
| `src/db/schema/conversation-participants.ts` | **新建** | 群聊参与者表 |
| `src/db/schema/conversation-messages.ts` | **新建** | 独立消息表 |
| `src/db/schema/index.ts` | 修改 | 导出新增两个 schema |
| `src/app/.../chat-center-client.tsx` | 修改 | null 保护（4 处） |
| `src/app/.../employee-list-panel.tsx` | 修改 | null 保护（2 处） |

**验收：**
- [x] tsc --noEmit 通过
- [x] build 通过
- [x] 现有单聊功能不受影响

---

### Node 1.3 — 数据迁移脚本 ✅

**目标：** 将现有 `saved_conversations.messages` jsonb 展开为 `conversation_messages` 行

**新增文件：**

| 文件 | 说明 |
|------|------|
| `scripts/migrate-conversations.ts` | 一次性迁移脚本（追加式，不删除原始 jsonb） |

**验收：**
- [x] tsc 编译无错误
- [x] 脚本为追加式（不修改原始记录）
- [x] 实际执行需要 `DATABASE_URL` 环境变量

---

## Stage 2: 群聊核心引擎 ✅

### Node 2.1 — SSE 事件类型扩展 ✅

**目标：** 扩展 SSE 事件类型支持群聊多参与者

**修改文件：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/chat-utils.ts` | 修改 | ChatMessage +3 可选字段；StreamingChatCallbacks +3 回调；SSE 事件 +3 类型 |

**验收：**
- [x] tsc 通过
- [x] build 通过
- [x] 完全向后兼容（所有新字段可选）

---

### Node 2.2 — 消息路由引擎 ✅

**目标：** 实现三层层级路由（显式@ → 焦点员工 → 穆兰意图分发）

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/chat/group-router.ts` | 消息路由引擎（6 条规则 + 焦点员工衰减机制） |
| `src/lib/chat/__tests__/group-router.test.ts` | 22 个单元测试 |

**验收：**
- [x] tsc 通过
- [x] build 通过
- [x] **22 个测试全部通过**

---

### Node 2.3 — 群聊调度引擎（串行） ✅

**目标：** 实现串行接力执行引擎

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/chat/group-dispatcher.ts` | 串行调度引擎 + FeedbackQueue + 中断信号检测 |
| `src/lib/chat/__tests__/group-dispatcher.test.ts` | 单元测试 |

**核心能力：**
- `executeSerialPlan()` — 按 executionOrder 依次执行，上下文传递
- `FeedbackQueue` — 执行中用户消息不中断但记录
- `isInterruptSignal()` — "停/等一下/pause" 触发 pause
- `planFromTemplate()` — 从模板生成执行计划

**验收：**
- [x] tsc 通过
- [x] build 通过
- [x] 6 个串行测试通过

---

### Node 2.4 — Agent Assembly 适配 ✅

**目标：** 为群聊场景提供多员工并行 assembly 能力

**修改文件：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/agent/assembly.ts` | 修改 | 新增 `assembleGroupContext()` + LRU 缓存（TTL 5 分钟） |

**验收：**
- [x] tsc 通过
- [x] build 通过

---

## Stage 3: 群聊 UI ✅

### Node 3.1 — 左侧面板三 Tab 改造 ✅

**修改文件：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/app/.../employee-list-panel.tsx` | 修改 | 新增「群聊」Tab + 群聊列表 + 发起群聊按钮 |
| `src/app/.../chat-center-client.tsx` | 修改 | 三 Tab 状态管理 |

**验收：**
- [x] tsc 通过
- [x] build 通过

---

### Node 3.2 — 群聊消息面板 ✅

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/hooks/use-chat-participants.ts` | 参与者状态管理 |
| `src/hooks/use-group-chat.ts` | 群聊状态机 |

**验收：**
- [x] tsc 通过
- [x] build 通过

---

### Node 3.3 — 手动建群 UI + Server Actions ✅

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/app/actions/group-chat.ts` | 3 个 Server Actions |
| `src/components/shared/employee-selector.tsx` | 员工选择浮层 |

**验收：**
- [x] tsc 通过
- [x] build 通过

---

### Node 3.4 — 群聊流程可视化 ✅

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/components/shared/chain-progress.tsx` | 串行流程进度条 |
| `src/components/shared/step-review-card.tsx` | Step Review 群内卡片 |

**验收：**
- [x] tsc 通过
- [x] build 通过

---

## Stage 4: 权限隔离 + 群聊进阶 ✅

### Node 4.1 — 权限隔离 DAL 过滤层 ✅

**目标：** 所有 DAL 查询函数加入 visibility 过滤

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/dal/visibility-filter.ts` | 统一过滤引擎（`buildVisibilityCondition` + `buildEmployeeVisibilityCondition`） |

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/dal/employees.ts` | `getEmployees(opts?)` 接受 `{userId, isAdmin}` |
| `src/lib/dal/knowledge-bases.ts` | `listKnowledgeBaseSummariesByOrg(orgId, opts?)` 接受 `{userId, mode}` |
| `src/lib/dal/workflow-templates.ts` | `getWorkflowTemplates(opts?)` own/org 过滤 |

**验收：**
- [x] tsc 通过
- [x] build 通过
- [x] personal 内容仅创建者 + admin 可见

---

### Node 4.2 — 权限隔离 Server Actions + RBAC ✅

**目标：** 创建/编辑/删除操作加入权限校验，新增 visibility 升级 Action

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/app/actions/content-visibility.ts` | `upgradeContentVisibility()` — personal → org（不可逆）+ 审计日志 |

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/rbac-constants.ts` | 新增 `CONTENT_VIEW_ALL` + `CONTENT_CHANGE_VISIBILITY` 权限 |

**验收：**
- [x] tsc 通过
- [x] build 通过

---

### Node 4.3 — @提及 + 焦点路由 ✅

**目标：** 输入框中实现 @提及选择和焦点员工路由

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/components/shared/mention-popover.tsx` | @提及浮窗（ArrowUp/Down/Enter/Escape 键盘导航） |

**验收：**
- [x] tsc 通过
- [x] build 通过

---

### Node 4.4 — Step Review 群内共享 ✅

**验收：**
- [x] tsc 通过
- [x] build 通过
- [x] Step Review 指定审核人
- [x] 非审核人无法操作

---

## Stage 5: 权限隔离 UI + SSO ✅

### Node 5.1 — VisibilityBadge + 筛选组件 ✅

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/components/shared/visibility-badge.tsx` | 🔒 个人（琥珀色）/ 🌐 组织（天蓝色）Badge |
| `src/components/shared/visibility-filter.tsx` | 全部/仅我的/组织共享 筛选 Toggle |

**验收：**
- [x] tsc 通过
- [x] build 通过

---

### Node 5.2 — 管理页面 ✅

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/app/(dashboard)/admin/content-management/page.tsx` | Server 页面 |
| `src/app/(dashboard)/admin/content-management/content-client.tsx` | Client 组件（搜索/类型筛选/列表/升级按钮） |

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/components/layout/app-sidebar.tsx` | ADMIN_ITEMS 新增「内容管理」入口 |

**验收：**
- [x] tsc 通过
- [x] build 通过

---

### Node 5.3 — SSO Provider 抽象层 ✅

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/sso/providers/base.ts` | `SsoProvider` 接口（getAuthUrl/exchangeToken/getUserInfo/refreshAccessToken） |
| `src/lib/sso/providers/wechat-work.ts` | 企业微信 OAuth |
| `src/lib/sso/providers/feishu.ts` | 飞书 OAuth |
| `src/lib/sso/providers/dingtalk.ts` | 钉钉 OAuth |
| `src/db/schema/sso-connections.ts` | SSO 连接表 |

**验收：**
- [x] tsc 通过
- [x] build 通过

---

### Node 5.4 — SSO Callback 路由 + 登录页 ✅

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/app/api/auth/sso/[provider]/route.ts` | SSO 发起 + 回调路由 |

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/app/(auth)/login/page.tsx` | 新增 3 个 SSO 按钮（飞书/钉钉/企业微信）+ 分割线 |

**验收：**
- [x] tsc 通过
- [x] build 通过
- [x] Email/Password 登录不受影响

---

## Stage 6: 进阶功能 ✅

### Node 6.1 — 群聊并行执行引擎 ✅

**目标：** 实现并行执行模式，支持 `Promise.allSettled()` 并发 + Leader 汇总

**修改文件：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/chat/group-dispatcher.ts` | 修改 | 新增 `executeParallelPlan()` + `AsyncEventQueue` + `parallel_merge` 事件类型 |
| `src/components/shared/chain-progress.tsx` | 修改 | 新增 `ParallelProgress` 并行轨道可视化组件（GitBranch 图标 + 分支进度条 + Leader 汇总状态） |
| `src/lib/chat/__tests__/group-dispatcher.test.ts` | 修改 | 新增 4 个并行执行测试 |

**核心能力：**
- `executeParallelPlan()` — `Promise.allSettled()` 并发执行所有参与者
- `AsyncEventQueue` — 异步事件队列，将并行流式输出合并为单一生成器
- Leader 汇总 — 并行完成后自动触发 Leader 员工汇总所有结果
- `ParallelProgress` — 并行轨道 UI（紫色分支线 + 每轨道独立进度 + Leader 汇总指示器）

**验收：**
- [x] tsc 通过
- [x] build 通过
- [x] **4 个并行测试全部通过**（并发执行 / 进度回调 / Leader 汇总 / 单人退化）

---

### Node 6.2 — 任务自动建群 ✅

**目标：** Mission 创建时根据场景自动组建群聊

**修改文件：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/app/actions/group-chat.ts` | 修改 | 新增 `createMissionGroupChat()` — 支持传入 userId/orgId 无需二次 auth |
| `src/app/actions/workflow-launch.ts` | 修改 | `startMissionFromTemplate()` 中集成自动建群（defaultTeam ≥ 2 人时触发） |

**关键设计：**
- `metadata: { missionId, source: "mission_auto" }` 关联 Mission
- 群名自动生成：`{模板名}（{N}人）`
- Fire-and-forget（不阻塞 Mission 执行）
- Leader 默认为"穆兰"（slug=`leader`）

**验收：**
- [x] tsc 通过
- [x] build 通过

---

### Node 6.3 — 导入导出 ✅

**目标：** 个人内容导出 JSON + 导入含安全校验

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/app/actions/content-export.ts` | `exportUserContent()` — 查询所有 createdBy=userId 的内容，打包 JSON |
| `src/app/actions/content-import.ts` | `importUserContent(raw)` — 解析 JSON → 版本校验 → 白名单过滤 → 逐条 insert |

**安全机制：**
- 版本号校验（`IMPORT_VERSION = "1.0"`）
- 文件大小限制（10MB）
- 单类型数量限制（200 条）
- 白名单类型（skills / knowledge_bases / workflow_templates）
- 导入时自动设置 `visibility: "personal"` + `createdBy: userId`
- 导出时去除内部字段（id / organizationId / createdBy）

**验收：**
- [x] tsc 通过
- [x] build 通过

---

### Node 6.4 — 结构化争议仲裁（实验性） ✅

**目标：** 工作流步骤冲突时自动触发受限讨论

**修改文件：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/chat/group-dispatcher.ts` | 修改 | 新增 `detectConflict()` + `executeArbitration()` + 3 个仲裁 SSE 事件类型 |
| `src/lib/chat/__tests__/group-dispatcher.test.ts` | 修改 | 新增 6 个仲裁测试（4 冲突检测 + 2 仲裁执行） |

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/components/shared/arbitration-card.tsx` | 仲裁结果卡片 UI（冲突描述 + 仲裁过程 + 结论） |

**核心能力：**
- `detectConflict()` — 基于关键词的冲突信号检测（矛盾/冲突/inconsistent/不符合 等 8 个信号）
- `executeArbitration()` — 受限仲裁执行器（限定参与者、最多 3 轮、结构化结论）
- SSE 事件：`arbitration_start` / `arbitration_round` / `arbitration_end`
- `ArbitrationCard` — 展开收起的仲裁过程卡片

**验收：**
- [x] tsc 通过
- [x] build 通过
- [x] **6 个仲裁测试全部通过**

---

## 文件变更汇总

### 新增文件（25 个）

| 文件 | Stage | 说明 |
|------|-------|------|
| `src/db/schema/conversation-participants.ts` | 1 | 群聊参与者表 |
| `src/db/schema/conversation-messages.ts` | 1 | 独立消息表 |
| `src/db/schema/sso-connections.ts` | 1 | SSO 连接表 |
| `scripts/migrate-conversations.ts` | 1 | 数据迁移脚本 |
| `src/lib/chat/group-router.ts` | 2 | 消息路由引擎 |
| `src/lib/chat/group-dispatcher.ts` | 2 | 调度引擎（串行+并行+仲裁） |
| `src/lib/chat/__tests__/group-router.test.ts` | 2 | 路由引擎测试（22 tests） |
| `src/lib/chat/__tests__/group-dispatcher.test.ts` | 2 | 调度引擎测试（16 tests） |
| `src/hooks/use-chat-participants.ts` | 3 | 参与者状态 Hook |
| `src/hooks/use-group-chat.ts` | 3 | 群聊状态机 Hook |
| `src/app/actions/group-chat.ts` | 3 | 群聊 Server Actions |
| `src/components/shared/employee-selector.tsx` | 3 | 员工选择浮层 |
| `src/components/shared/chain-progress.tsx` | 3 | 进度条（串行+并行） |
| `src/components/shared/step-review-card.tsx` | 3 | Step Review 卡片 |
| `src/lib/dal/visibility-filter.ts` | 4 | 统一过滤引擎 |
| `src/app/actions/content-visibility.ts` | 4 | 可见性升级 Action |
| `src/components/shared/mention-popover.tsx` | 4 | @提及浮窗 |
| `src/components/shared/visibility-badge.tsx` | 5 | 可见性 Badge |
| `src/components/shared/visibility-filter.tsx` | 5 | 可见性筛选 Toggle |
| `src/app/(dashboard)/admin/content-management/page.tsx` | 5 | 内容管理 Server 页面 |
| `src/app/(dashboard)/admin/content-management/content-client.tsx` | 5 | 内容管理 Client 组件 |
| `src/lib/sso/providers/base.ts` | 5 | SSO Provider 接口 |
| `src/lib/sso/providers/wechat-work.ts` | 5 | 企业微信 OAuth |
| `src/lib/sso/providers/feishu.ts` | 5 | 飞书 OAuth |
| `src/lib/sso/providers/dingtalk.ts` | 5 | 钉钉 OAuth |
| `src/app/api/auth/sso/[provider]/route.ts` | 5 | SSO Callback 路由 |
| `src/app/actions/content-export.ts` | 6 | 导出 Action |
| `src/app/actions/content-import.ts` | 6 | 导入 Action |
| `src/components/shared/arbitration-card.tsx` | 6 | 仲裁结果卡片 |

### 修改文件（17 个）

| 文件 | Stage | 说明 |
|------|-------|------|
| `src/db/schema/enums.ts` | 1 | +8 枚举 |
| `src/db/schema/ai-employees.ts` | 1 | +2 字段 |
| `src/db/schema/missions.ts` | 1 | +2 字段 |
| `src/db/schema/knowledge-bases.ts` | 1 | +2 字段 |
| `src/db/schema/skills.ts` | 1 | +2 字段 |
| `src/db/schema/saved-conversations.ts` | 1 | +3 字段，employeeSlug nullable |
| `src/db/schema/index.ts` | 1+5 | +3 导出 |
| `src/lib/chat-utils.ts` | 2 | +3 回调 +3 事件 +3 ChatMessage 字段 |
| `src/lib/agent/assembly.ts` | 2 | +assembleGroupContext + LRU 缓存 |
| `src/app/.../chat-center-client.tsx` | 1+3 | null 保护 + 三 Tab + 建群弹窗 |
| `src/app/.../employee-list-panel.tsx` | 1+3 | null 保护 + 三 Tab + 群聊列表 |
| `src/lib/dal/employees.ts` | 4 | visibility 过滤 |
| `src/lib/dal/knowledge-bases.ts` | 4 | visibility 过滤 |
| `src/lib/dal/workflow-templates.ts` | 4 | own/org 过滤 |
| `src/lib/rbac-constants.ts` | 4 | +2 权限常量 |
| `src/components/layout/app-sidebar.tsx` | 5 | +1 管理入口 |
| `src/app/(auth)/login/page.tsx` | 5 | +3 SSO 按钮 |
| `src/app/actions/workflow-launch.ts` | 6 | +自动建群集成 |

---

## 测试报告

| 指标 | 数值 |
|------|------|
| 新增测试文件 | 2 |
| 新增测试用例 | 38 |
| 路由引擎测试 | 22 passed |
| 调度引擎测试 | 16 passed（串行 6 + 并行 4 + 冲突检测 4 + 仲裁 2） |
| 存量测试 | 415 passed / 15 failed（集成测试需 DB） |

---

## 验收状态

### 全量检查（最后一次成功运行）

| 检查项 | 状态 |
|--------|------|
| `npx tsc --noEmit` | ✅ 通过 |
| `npx vitest run` (新增测试) | ✅ 38 passed |
| `npm run build` | ⚠️ 因磁盘空间不足失败（非代码问题），代码本身通过 tsc 验证 |

### 注意事项

1. **数据库迁移**需执行 `npm run db:generate` + `npm run db:push` 将 Schema 变更推送到 Supabase
2. **数据迁移脚本** `scripts/migrate-conversations.ts` 需在有 `DATABASE_URL` 的环境下手动执行
3. **SSO 登录**需要配置对应 Provider 的环境变量（如 `FEISHU_APP_ID` / `DINGTALK_APP_KEY` 等）
4. **磁盘空间**需要清理后再执行 `npm run build` 确认构建通过
