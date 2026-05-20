## Why

当前首页穆兰交互在用户输入后，通过一次性的 `clarificationQuestions` 表单收集补充信息，然后直接推荐员工或发起群聊。这种单次表单模式存在以下问题：

- **信息收集不充分**：单次表单只能提 2-3 个问题，无法根据用户回答动态追问
- **体验割裂**：表单的填空/选择式交互与聊天对话的语境不匹配
- **推荐精度受限**：缺少多轮语义交互，意图识别置信度低时无法渐进式澄清，导致推荐员工/群聊不够准确

将单次表单改为多轮对话式交互，使穆兰能像真人助手一样追问细节，逐步明确用户需求后再推荐最合适的员工组合或工作流。

## What Changes

1. **新增多轮需求确认对话流程**：用户输入后，穆兰根据意图识别的置信度和缺失信息，发起多轮追问（每轮 1 个问题），根据用户回复动态决定下一轮追问还是生成推荐
2. **替换 ClarificationForm 为多轮追问气泡**：删除当前 `ClarificationForm` 表单组件，改用聊天气泡形式展示追问和回答
3. **扩展 IntentResult 类型**：增加 `followUpRound` / `history` 字段，支持多轮状态的持续追踪
4. **更新嵌入式聊天面板**：`embedded-chat-panel.tsx` 中的 intent 气泡区域适配多轮追问渲染
5. **后端 AI Prompt 增强**：修改 intent-recognition 的 prompt，指示模型在信息不足时生成单轮追问，而非一次性问卷

## Capabilities

### New Capabilities
- `mulan-multi-turn-clarify`: 穆兰多轮需求确认能力 — 通过聊天式多轮追问渐进式收集用户需求，替代原有的单次 ClarificationForm

### Modified Capabilities

（无已有 spec 被修改）

## Impact

- **Server Actions**: 无需新增，复用 `useChatStream` 的 `sendMessage` 进行对话
- **共享组件**：
  - **删除** `src/components/chat/clarification-form.tsx`
  - **修改** `src/components/home/embedded-chat-panel.tsx` — intent 区域渲染多轮追问气泡
  - **修改** `src/components/chat/intent-bubble.tsx` — 新增多轮追问气泡类型
- **自定义 Hook**：修改 `src/hooks/use-chat-stream.ts` — 意图处理分支适配多轮状态
- **Agent 模块**：修改 `src/lib/agent/intent-parser.ts` — prompt 变化
- **类型**：修改 `src/lib/agent/types.ts` — `IntentResult` 扩展 `followUpRound`、`clarificationHistory`

**回滚计划**：
- 保留 `ClarificationForm` 组件及导入引用，仅作废弃标记
- 如多轮追问上线后效果不佳，可通过 feature flag `VIBETIDE_MULTI_TURN_CLARIFY_ENABLED` 切回旧表单模式
- 所有修改集中在 5 个文件内，回滚范围明确