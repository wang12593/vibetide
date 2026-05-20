## 1. Fix Mission 状态同步（P0 — 阻断性 Bug）

- [x] 1.1 修改 `src/app/api/chat/intent-execute/route.ts`：将 `void startMissionFromChat(...)` 改为 `const missionResult = await startMissionFromChat(...)`
- [x] 1.2 修改 `src/app/api/chat/intent-execute/route.ts`：SSE 流执行完毕后调用 `updateMissionStatus(missionId, "completed")`
- [x] 1.3 修改 `src/app/api/chat/intent-execute/route.ts`：SSE 流出错时调用 `updateMissionStatus(missionId, "failed")`
- [x] 1.4 新增 `updateMissionStatus(missionId, status)` 函数到 `src/lib/dal/missions.ts`
- [x] 1.5 修复 `updateMissionTaskStatus`：WHERE 条件增加 `eq(missionTasks.missionId, missionId)`
- [x] 1.6 统一 `dal/missions.ts:createMissionFromChat`：补充 `teamMembers`、`workflowTemplateId`、`inputParams` 参数

## 2. Fix 群聊上下文感知路由（P1）

- [x] 2.1 在 `src/lib/chat/group-router.ts` 中新增 `CONTINUATION_KEYWORDS` 常量：`["上述", "以上", "这些", "那些", "刚才", "上一步", "前面", "根据这些", "基于这些"]`
- [x] 2.2 在 `resolveRoute` 函数中增加第 2.5 优先级（在 routeByActiveStep 之后）：`routeByContinuation` — 检查消息是否包含暗示关键词 + 群聊历史是否有步骤产出
- [x] 2.3 新增 `routeByContinuation(message, context)` 函数：从群聊历史中提取最近完成的步骤，返回其下一个工作流步骤的员工
- [x] 2.4 修改 `handleGroupChat`：当路由决策是"延续"时，将上一步产出作为 `upstreamOutput` 传入 stepExecutor
- [x] 2.5 确保 @提及（第 1 优先级）不受上下文感知路由影响

## 3. 验证

- [x] 3.1 运行 `npx tsc --noEmit` 确保零类型错误
- [x] 3.2 运行 `npm run build` 确保生产构建通过
- [ ] 3.3 手动验证：在 `/home` 穆兰对话中执行任务 → 检查任务中心是否显示 Mission
- [ ] 3.4 手动验证：群聊中小雷完成后说"根据上述内容写一篇文章" → 确认小文回复
