## 1. 类型定义与数据库 Schema

- [ ] 1.1 在 `src/lib/agent/types.ts` 中新增 `RequirementParameter`、`ClarificationSession`、`ClarificationRound` 类型定义
- [ ] 1.2 在 `src/db/schema/` 中新增 `clarification-sessions.ts` 表 schema（含 `organization_id`、`conversation_id`、`parameters_json`、`status`、`created_at`、`updated_at`），并在 `src/db/schema/enums.ts` 中新增 `clarification_status` 枚举
- [ ] 1.3 在 `src/db/types.ts` 中导出新表的 `InferSelectModel` / `InferInsertModel` 类型

## 2. 参数模板系统

- [ ] 2.1 创建 `src/lib/agent/requirement-templates.ts`，按 `ChatIntentType` 定义参数模板（`content_creation` / `data_analysis` / `media_production` / `deep_analysis` / `information_retrieval` / `content_review` / `publishing`），每个模板包含 `required` 和 `optional` 参数字段
- [ ] 2.2 创建 `src/lib/agent/requirement-extractor.ts`，实现 `extractParameters(message, template)` 函数，使用 LLM 从用户消息中提取已有参数并识别缺失字段

## 3. 需求澄清引擎

- [x] 3.1 创建 `src/lib/agent/requirement-clarifier.ts`，实现 `ClarificationEngine` 类，核心方法：`initSession(message, intentType)` → `processResponse(userMessage, session)` → `isComplete(session)` → `getCollectedParameters(session)`
- [x] 3.2 实现 `generateClarificationQuestion(session, template)` 函数，基于缺失参数和已有上下文动态生成自然语言澄清问题（使用 Qwen3.5-35B-A3B，maxOutputTokens 512）
- [x] 3.3 实现 `shouldSkipClarification(message)` 快速判断函数，当消息长度 > 50 字且包含 ≥ 2 个关键参数时自动跳过澄清
- [x] 3.4 实现 feature flag 读取函数 `isClarificationEnabled()` 在 `src/lib/config.ts` 中，读取 `VIBETIDE_REQUIREMENT_CLARIFICATION_ENABLED` 环境变量

## 4. 澄清 API 端点

- [ ] 4.1 创建 `src/app/api/chat/clarify/route.ts`，实现 POST SSE 流式端点，接收 `{ message, conversationId, sessionId? }`，认证后调用 `ClarificationEngine`，返回 SSE 事件流（`clarification-question` / `parameter-update` / `clarification-complete`）
- [ ] 4.2 实现澄清会话 DB 持久化：在 `src/lib/dal/clarification-sessions.ts` 中创建 `upsertClarificationSession` 和 `getActiveClarificationSession` DAL 函数
- [ ] 4.3 实现会话超时逻辑：`getActiveClarificationSession` 检查 `updated_at` 是否超过 10 分钟，超时则标记为 `expired` 并返回 null

## 5. 意图识别增强

- [ ] 5.1 修改 `src/lib/agent/intent-recognition.ts` 中 `recognizeIntent()` 函数签名，新增可选参数 `clarifiedParameters?: Record<string, string>`
- [ ] 5.2 在 LLM 意图识别 prompt 中注入参数上下文：当 `clarifiedParameters` 非空时，在 system prompt 中添加 `<collected_parameters>` 块，引导 LLM 基于参数生成更精确的 steps
- [ ] 5.3 修改 `src/app/api/chat/intent/route.ts`，从请求体中解析 `clarifiedParameters` 并传入 `recognizeIntent()`

## 6. 对话任务同步

- [x] 6.1 在 `src/lib/dal/missions.ts` 中新增 `createMissionFromChat(orgId, data)` 函数，接收对话上下文和澄清参数，创建 Mission + Task 记录
- [x] 6.2 在 `src/app/actions/missions.ts` 中新增 `startMissionFromChat()` Server Action（含 `requireAuth()`），fire-and-forget 调用 `createMissionFromChat`
- [x] 6.3 修改 `src/app/api/chat/intent-execute/route.ts`，在步骤执行前调用 `startMissionFromChat()`，将 `conversationId` 和 `clarifiedParameters` 传入
- [x] 6.4 在步骤执行过程中同步更新 Mission Task 状态：每个 SSE `step-complete` 事件后更新对应 Task 为 `completed`；所有步骤完成后更新 Mission 为 `completed`；错误时更新为 `failed`

## 7. 前端状态管理

- [ ] 7.1 创建 `src/hooks/use-clarification.ts`，独立管理澄清会话状态（`session` / `parameters` / `isClarifying` / `clarificationMessages`），暴露 `startClarification()` / `submitClarificationResponse()` / `skipClarification()` / `confirmParameters()` 方法
- [ ] 7.2 修改 `src/hooks/use-chat-stream.ts`，集成 `useClarification`：在 `sendMessage()` 流程中，当 feature flag 启用且消息为任务型时，先调用 `startClarification()` 进入澄清流程，澄清完成后再走意图识别
- [ ] 7.3 在 `sendMessage()` 中传递 `clarifiedParameters` 到 `/api/chat/intent` 请求

## 8. 前端 UI 组件

- [x] 8.1 创建 `src/components/chat/clarification-card.tsx`，展示澄清交互卡片：AI 提问气泡、参数进度条（"2/4 参数已确认"）、已收集参数标签列表、跳过按钮。使用 `<GlassCard>` + `<Button variant="ghost">` 共享组件
- [x] 8.2 创建 `src/components/chat/parameter-confirmation-card.tsx`，展示参数确认摘要：所有参数列表、每项可点击修改、"确认并开始"按钮、"返回修改"按钮。使用 `<GlassCard>` + `<Button>`
- [x] 8.3 修改 `src/app/(dashboard)/chat/chat-panel.tsx`，在消息渲染逻辑中识别 `clarification` 类型消息，渲染 `ClarificationCard` 和 `ParameterConfirmationCard`
- [x] 8.4 任务中心列表页增加"来自对话"标签：修改 `src/app/(dashboard)/tasks/` 相关组件，对 `source: 'chat'` 的 Mission 展示来源标签

## 9. 集成测试与验证

- [x] 9.1 验证 feature flag 关闭时，所有对话流程完全不受影响（回归测试）
- [x] 9.2 验证澄清 → 意图识别 → 执行 → Mission 创建的完整链路
- [x] 9.3 验证"跳过澄清"和"自动跳过（参数充足）"两种快速路径
- [x] 9.4 运行 `npx tsc --noEmit` 和 `npm run build` 确保零错误
