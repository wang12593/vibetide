## Why

用户在 `/home` 穆兰首页发起对话并执行任务后，发现两个严重问题：

### 问题 1：群聊中消息路由错误，上下文不传递

**复现路径**：用户输入"生成一篇科技评论文章" → 穆兰推荐小雷+小文 → 确认后创建群聊 → 小雷生成"热点分析报告" → 用户在群聊中说"根据上述检索内容写一篇文章" → **预期小文回复，实际小雷回复**，且回复内容声称"未包含具体的检索内容"。

**根因**：
- `group-router.ts` 的 `INTENT_KEYWORD_MAP` 中"检索"命中 xiaolei、"写"命中 xiaowen，消息同时命中两个关键词，触发 `resolveMultiStepRoute`，按 WORKFLOW_ORDER 排序为 `[xiaolei, xiaowen]`
- 但用户期望的是：**小雷已完成检索，现在应该由小文接着工作**，而非重新让小雷检索
- 关键词路由无法区分"新任务"和"延续任务"——群聊中已有的步骤产出未被用于路由决策
- 小雷作为第一个被执行的步骤，收到的 prompt 是"根据上述检索内容写一篇文章"而非"根据上一步产出写一篇文章"——**因为这不是串行多步骤场景，而是单步回复场景**

### 问题 2：对话执行的任务不出现在任务中心

**复现路径**：在 `/home` 穆兰对话框执行了多次任务（确认执行后 AI 员工正常工作并产出结果） → 切换到"任务中心"页面 → 列表为空。

**根因（5 个断点）**：
1. **Mission 状态永远不更新**：`intent-execute/route.ts` 中 `void startMissionFromChat()` 创建 mission（status="queued"），但 SSE 流执行完所有步骤后**从不更新 `missions.status` 为 "completed"**
2. **Fire-and-forget 竞态**：`void startMissionFromChat(...)` 是发射后不管，mission 可能还未写入 DB 时 SSE 流就开始更新 task 状态，导致更新静默匹配 0 行
3. **缺少 missionId 过滤**：`updateMissionTaskStatus()` 的 WHERE 条件只有 `assignedEmployeeId + priority`，**没有限定 missionId**，可能误更新其他 mission 的 tasks
4. **两条 Mission 创建路径不一致**：路径 A（`start-mission-from-chat.ts`）设置完整字段但路径 B（`dal/missions.ts:createMissionFromChat`）缺少 `teamMembers`、`workflowTemplateId`
5. **无 `mission/created` 事件**：没有 dispatch 事件通知其他模块

## What Changes

### Fix 1: 群聊上下文感知路由

1. **修改 `group-router.ts`**：当群聊中已有步骤产出（即非首轮对话）时，跳过多步骤路由（`resolveMultiStepRoute`），改用**焦点员工路由**或 **@提及路由**
2. **修改 `route.ts` handleGroupChat**：将前序步骤的产出作为 `upstreamOutput` 注入到 stepExecutor 的 prompt 中，确保后续回复能引用之前的内容
3. **修改路由优先级**：增加"最近产出员工的下一位"逻辑——如果小雷刚完成检索，用户说"写一篇文章"时自动路由到小文

### Fix 2: Mission 状态同步修复

1. **修改 `intent-execute/route.ts`**：将 `void startMissionFromChat()` 改为 `await`，确保 mission 和 tasks 写入后再开始执行
2. **新增 mission 状态更新**：SSE 流执行完毕后，更新 `missions.status` 为 "completed"（成功）或 "failed"（失败）
3. **修复 `updateMissionTaskStatus`**：WHERE 条件增加 `missionId` 限定
4. **统一 Mission 创建 Schema**：路径 B 补充 `teamMembers`、`workflowTemplateId` 等字段
5. **新增 `dispatch('mission/created')` 事件**：mission 创建成功后 dispatch 事件

## Capabilities

### New Capabilities
- `chat-group-context-aware-routing`: 群聊上下文感知路由 — 基于群聊历史中的步骤产出，智能决定由哪个员工回复，而非仅依赖关键词匹配

### Modified Capabilities
- `chat-mission-sync`: 对话任务同步 — 修复 Mission 状态不更新、竞态条件、缺少 missionId 过滤等问题

## Impact

- **Server Actions**: 修改 `src/app/actions/missions.ts` 中的 `startMissionFromChat`
- **API Routes**: 修改 `src/app/api/chat/intent-execute/route.ts`（mission 状态同步）和 `src/app/api/chat/stream/route.ts`（群聊上下文传递）
- **路由模块**: 修改 `src/lib/chat/group-router.ts`（上下文感知路由逻辑）
- **Dispatch**: 修改 `src/lib/queue/dispatch.ts`（新增 `mission/created` 事件）

**回滚计划**：
- 路由修改通过 feature flag `VIBETIDE_CONTEXT_AWARE_ROUTING` 控制
- Mission 修复是 bug fix，直接替换即可