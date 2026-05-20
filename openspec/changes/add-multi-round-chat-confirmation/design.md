## Context

当前 Vibetide 对话中心的消息处理流程为：用户发消息 → `/api/chat/intent` 意图识别 → 前端展示意图确认卡片 → `/api/chat/intent-execute` 执行。这个流程缺少**需求收集阶段**——用户说"帮我写一篇稿件"时，系统不知道主题、字数、风格等关键参数，直接分派给小文执行，导致产出与用户预期不符。

现有架构中 `IntentResult` 已预留 `needsClarification` 和 `clarificationQuestions` 字段，但未被实际使用。前端 `ClarificationCard` 组件也仅有基础 UI 框架。需要在此基础上构建完整的多轮澄清流程。

**关键约束：**
- Server/Client Component 分离：API 路由和 DAL 为 Server 端，前端 hook 和组件为 Client 端
- 新增数据库表必须包含 `organization_id`
- 需要支持 SSE 流式（澄清过程中的 AI 回复也需要流式）
- 不能破坏现有的直接意图识别流程（通过 feature flag 控制）

## Goals / Non-Goals

**Goals:**
- 在意图识别前插入多轮需求澄清阶段，通过 AI 动态提问收集完整任务参数
- 按场景类型定义参数模板，指导澄清引擎的提问策略
- 将收集到的参数传入意图识别，提升员工分派准确度
- 意图执行时自动创建 Mission 同步到任务中心
- 支持用户跳过澄清直接执行（快速模式）

**Non-Goals:**
- 不改变现有群聊（group chat）的消息路由逻辑
- 不改变 intent-execute 的步骤执行引擎（step execution engine）
- 不做澄清历史的持久化查询 UI（本次只存 DB，不提供回顾页面）
- 不做跨会话的参数记忆（用户关闭对话后参数不保留）

## Decisions

### Decision 1: 澄清流程作为独立阶段插入，而非修改现有 intent 路由

**选择：** 新增 `/api/chat/clarify` API 端点作为独立的 SSE 流式澄清端点

**理由：** 现有 `/api/chat/intent` 路由已经复杂（问候检测 → 规则匹配 → LLM 兜底），在其内部加入多轮逻辑会进一步膨胀。独立端点职责清晰，便于独立调试和 feature flag 控制。

**替代方案：** 在 `/api/chat/intent` 中添加澄清循环 → 拒绝，因为该路由已是纯 JSON 响应，无法支持 SSE 流式澄清对话。

### Decision 2: 参数模板采用场景驱动定义，硬编码在 TypeScript 常量中

**选择：** 在 `src/lib/agent/requirement-templates.ts` 中按 `ChatIntentType` 定义参数模板

**理由：** Vibetide 的场景类型有限（8 种 `ChatIntentType`），参数字段稳定（主题、字数、风格等），不需要动态配置。TypeScript 常量提供类型安全，避免运行时解析错误。

**替代方案：** 数据库存储参数模板 → 过度工程化，场景类型不频繁变化。

### Decision 3: 澄清状态存储在前端内存 + DB 双层

**选择：** 前端 `useChatStream` hook 维护 `ClarificationSession` 状态对象，同时在 DB `clarification_sessions` 表中持久化

**理由：** 前端内存状态保证实时交互流畅（无网络延迟）；DB 持久化用于任务中心关联和崩溃恢复。页面刷新后可通过 `conversationId` 恢复未完成的澄清会话。

### Decision 4: Mission 创建采用 fire-and-forget 模式

**选择：** 意图执行开始时，通过 `startMissionFromChat()` 异步创建 Mission，不阻塞 SSE 流

**理由：** 现有 `startMission()` 已是 fire-and-forget 模式（Inngest event → 异步执行），保持一致。Mission 创建失败不应阻塞对话执行。

### Decision 5: Feature flag 双层控制

**选择：** 环境变量 `VIBETIDE_REQUIREMENT_CLARIFICATION_ENABLED`（全局开关）+ `IntentType` 级别的配置（哪些意图类型需要澄清）

**理由：** 全局开关便于紧急回退；意图类型级别配置支持灰度（例如只对 `content_creation` 启用澄清，`general_chat` 跳过）。

## Risks / Trade-offs

- **[延迟增加]** 澄清阶段增加 1-N 轮对话，用户等待时间变长 → 通过"快速模式"（用户可跳过）和"智能跳过"（用户消息已包含足够参数时自动跳过）缓解
- **[LLM 调用成本]** 每次澄清都需要 LLM 调用 → 使用轻量模型（Qwen3.5-35B-A3B，与意图识别一致），控制 maxOutputTokens 512
- **[前端状态复杂度]** useChatStream hook 已有 15+ 状态变量，新增澄清状态会增加复杂度 → 将澄清状态抽取为独立 `useClarification` hook，通过组合模式管理
- **[DB 写入频率]** 每轮澄清都写入 DB → 使用 upsert 而非 insert，减少写入量；澄清完成后合并为单条记录
- **[向后兼容]** 关闭 feature flag 后必须完全回退到原有流程 → 所有新增代码通过条件分支隔离，flag 关闭时零代码路径执行

## Open Questions

- 澄清会话超时时间建议值？（初步设想 10 分钟无活动自动关闭）
- 用户在澄清过程中切换员工是否需要重置澄清状态？
- Mission 标题是取用户首条消息摘要还是最终确认的需求摘要？
