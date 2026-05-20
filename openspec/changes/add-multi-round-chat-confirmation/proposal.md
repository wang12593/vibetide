## Why

当前对话中心在用户发起任务请求（如"创建一篇稿件"）时，直接跳过需求确认阶段，立即进行意图识别和员工分派。这导致：(1) AI 缺少关键创作参数（主题、字数、风格等），产出质量不可控；(2) 用户无法在执行前充分表达需求细节，经常需要反复修改；(3) 对话中的任务执行没有同步到任务中心，缺少任务追踪闭环。

## What Changes

- 新增**需求澄清引擎**：在意图识别之前插入多轮对话阶段，通过 LLM 动态生成澄清问题，逐步收集任务所需的完整参数
- 新增**意图参数模板**：按场景类型（稿件创作、视频制作、数据分析等）预定义必填/选填参数字段，指导澄清引擎提问
- 修改**意图识别流程**：将收集到的参数作为上下文传入 `recognizeIntent()`，提升意图识别准确度
- 新增**对话任务同步**：意图执行时自动创建 Mission 并关联到任务中心，支持进度追踪
- 修改**前端对话面板**：新增需求澄清交互卡片 UI，展示参数收集进度和已确认参数摘要

## Capabilities

### New Capabilities
- `requirement-clarification`: 需求澄清引擎——多轮对话收集任务参数，动态生成澄清问题，维护参数状态机
- `chat-mission-sync`: 对话任务同步——将对话中的意图执行自动创建为 Mission，关联任务中心

### Modified Capabilities
- `intent-recognition`: 修改意图识别流程，接收已收集的参数上下文，提升识别准确度和员工分派质量

## Impact

- **API 路由**：`/api/chat/intent`（新增参数传入）、`/api/chat/intent-execute`（新增 Mission 创建逻辑）
- **新增 API**：`/api/chat/clarify`（需求澄清 SSE 流式端点）
- **Agent 模块**：`src/lib/agent/intent-recognition.ts`（接收参数上下文）、新增 `src/lib/agent/requirement-clarifier.ts`
- **前端组件**：`chat-panel.tsx`（新增 ClarificationCard 增强）、`use-chat-stream.ts`（新增澄清状态管理）
- **DAL**：`src/lib/dal/missions.ts`（新增 `createMissionFromChat`）
- **Server Actions**：`src/app/actions/missions.ts`（新增 `startMissionFromChat`）
- **类型**：`src/lib/agent/types.ts`（新增 `ClarificationSession`、`RequirementParameter`）
- **数据库**：可能新增 `clarification_sessions` 表存储澄清会话状态
- **回滚计划**：通过 feature flag `VIBETIDE_REQUIREMENT_CLARIFICATION_ENABLED`（默认 false）控制，关闭后回退到原有直接意图识别流程。所有新增代码独立于现有流程，关闭 flag 即可完全回退
