## Context

### 当前群聊路由机制

`group-router.ts` 使用 5 级优先级降级策略：@提及 → 活跃步骤 → 广播关键词 → 意图关键词 → 最近焦点 → 兜底(xiaoce)。

**问题**：当用户在群聊中说"根据上述检索内容写一篇文章"时，`resolveMultiStepRoute()` 同时命中"检索"(xiaolei) 和"写"(xiaowen)，触发串行多步骤执行。但实际上用户期望的是**让小文接着小雷的工作继续**，而不是重新执行小雷的检索。

### 当前 Mission 创建机制

`intent-execute/route.ts` 中 `void startMissionFromChat()` fire-and-forget 创建 mission，SSE 流异步执行步骤。但：
- mission status 永远停留在 "queued"
- `updateMissionTaskStatus` 缺少 missionId 过滤
- 两条创建路径的 Schema 不一致

### 约束

- 群聊路由修改不能破坏现有的 @提及和串行多步骤执行机制
- Mission 状态修复需要向后兼容已有的 "queued" 状态记录
- 所有修改需要 tsc + build 通过

## Goals / Non-Goals

**Goals:**
- 修复群聊中"根据上述检索内容写一篇文章"路由到错误员工的问题
- 修复 Mission 创建后状态不更新的问题
- 确保 `updateMissionTaskStatus` 只更新目标 mission 的 tasks
- 统一两条 Mission 创建路径的 Schema

**Non-Goals:**
- 不重构群聊路由的整体架构（只修复上下文感知问题）
- 不修改 step-review 机制
- 不修改 agent assembly 的 7 层 prompt 结构

## Decisions

### D1. 群聊路由：上下文感知 > 关键词匹配

**决策**：在 `resolveMultiStepRoute` 之前增加一个"上下文感知路由"层。当群聊中已有已完成的步骤产出时，如果用户消息暗示"继续/基于上一步/上述内容"，则直接路由到下一个工作流步骤的员工，而非重新触发多步骤路由。

**实现**：
1. `handleGroupChat` 检查群聊历史中是否有 `step-review` 类型的 assistant 消息
2. 如果有，提取最近完成的步骤信息和下一步员工
3. 当用户消息包含"继续/基于/上述/根据这些"等关键词时，直接路由到下一步员工
4. 将上一步产出作为 `upstreamOutput` 注入 stepExecutor

**替代方案**：让 LLM 做路由决策 → 增加延迟和成本，不适合每条消息。

### D2. Mission 状态：await 创建 + 执行完更新

**决策**：
1. `void startMissionFromChat()` 改为 `const missionResult = await startMissionFromChat()`
2. SSE 流执行完毕后，调用 `updateMissionStatus(missionId, "completed")`
3. 如果执行过程中出错，调用 `updateMissionStatus(missionId, "failed")`

**替代方案**：不改 await，改用 `dispatch` 事件 → 增加复杂度，await 是最简单的修复。

### D3. updateMissionTaskStatus：增加 missionId 过滤

**决策**：在 WHERE 条件中增加 `eq(missionTasks.missionId, missionId)`。

**理由**：当前只有 `assignedEmployeeId + priority` 的过滤条件太宽松，同一个员工在多个 mission 中都有相同 priority 的 task 时会误更新。

### D4. 统一 Mission Schema

**决策**：路径 B (`dal/missions.ts:createMissionFromChat`) 补充路径 A 已有的字段：`teamMembers`、`workflowTemplateId`、`inputParams`。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 上下文感知路由可能误判 | 增加"暗示关键词"列表，只有明确包含时才触发；否则走原有逻辑 |
| await 可能增加 SSE 首字延迟 | mission 创建通常 < 100ms，可接受 |
| 已有 "queued" 的历史 mission | 提供 SQL 脚本将已完成的 mission 标记为 "completed" |
| 路由修改影响现有串行流程 | Feature flag 控制，可回滚到纯关键词路由 |