## Context

### Current State

首页穆兰交互流程（`embedded-chat-panel.tsx` + `use-chat-stream.ts`）：

```
用户输入 → /api/chat/intent → IntentResult
  ├─ general_chat + 无 steps + 无 clarification → 穆兰直接回复
  ├─ needsClarification + clarificationQuestions → 展示单次 ClarificationCard/Form
  └─ 有 steps → 展示 IntentConfirmation → 执行
```

当前的 `ClarificationCard`（intent-bubble.tsx）和 `ClarificationForm`（clarification-form.tsx）都是一次性表单——AI 一次性返回所有 `clarificationQuestions`，用户填完就执行。无法根据前一个答案动态追问。

### 约束

- AI SDK v6 的 `generateText` + `tool` 调用，不使用 `maxSteps`
- 意图识别走 `/api/chat/intent` REST API，返回 `IntentResult` JSON
- 多轮追问状态在前端维护（后端无状态）
- 所有用户输入都通过 `chat.sendMessage()` 发送，以保证消息历史连续性

## Goals / Non-Goals

**Goals:**
- 将单次表单改为聊天气泡式的多轮追问
- 每轮只问 1 个问题（AI 根据上轮回答决定下一轮追问还是推荐）
- 多轮追问完成后自动进入推荐/执行阶段
- 保留现有意图识别 → 推荐 → 执行的完整链路

**Non-Goals:**
- 不改动现有的 `/api/chat/intent` API 的返回格式（仅扩展）
- 不新增 Server Action
- 不改动 `IntentConfirmation` / `EmployeeRecommendSheet` / 群聊创建等下游组件
- 不涉及数据库 schema 变更

## Decisions

### D1. 状态驱动而非事件驱动

**决策**：前端维护 `multiTurnState`，包含 `{ round: number, history: {question, answer}[], active: boolean }`。

**理由**：
- 后端 `/api/chat/intent` 是无状态的，每次调用都基于完整的对话历史重算
- 前端需要在每轮追问后累积 `history`，在下一次调用时作为 `clarificationHistory` 回传
- 状态机（CLARIFYING → CONFIRMING → EXECUTING → IDLE）比事件链更清晰

**替代方案**：在后端会话维护状态 → 需要 Redis/DB 额外存储，过度设计。

### D2. 复用 `useChatStream` 的 `sendMessage` 而非新增 API

**决策**：用户的多轮回答直接通过 `chat.sendMessage()` 发送到对话流，作为普通用户消息存入聊天历史。

**理由**：
- 保持聊天历史完整性——用户可以看到自己回答过什么
- 下一次意图识别自动将整个对话历史（包括之前的追问和回答）作为上下文
- 不需要额外 API 端点

**替代方案**：新 API `/api/chat/multi-turn-answer` → 增加维护成本，消息历史不完整。

### D3. 每轮只展示 1 个追问，而非一组

**决策**：AI prompt 指示只生成 1 个 `clarificationQuestion`（最重要的缺失信息）。

**理由**：
- 多轮对话体验更自然——像真人助手一样逐层深入
- 每个回答都能影响下一轮的方向，而不是一次性填完所有槽位
- 用户体验负担小——每轮只需回答 1 个问题

### D4. 停止条件

多轮追问在以下任意条件满足时停止：
1. AI 不再返回 `needsClarification: true`（信息足够，进入推荐阶段）
2. `confidence >= 0.9`（AI 高度确定用户意图）
3. 追问轮数达到上限 `MAX_CLARIFY_ROUNDS = 5`（防止死循环）
4. 用户主动点击「跳过，直接推荐」

## Data Flow

```
用户输入 "写一篇关于AI的文章"
  ↓
/api/chat/intent → IntentResult { needsClarification: true, clarificationQuestions: [{id, field, question, options}], clarifictionHistory: [] }
  ↓
多轮追问开始 round=1
  ↓
渲染追问气泡 "你希望文章面向什么受众？"（含选项按钮）
  ↓
用户点击 "技术开发者"
  ↓
chat.sendMessage("技术开发者")  # 作为普通用户消息
  ↓
系统自动触发新一轮意图识别（带上完整对话历史 + clarificationHistory）
  ↓
/api/chat/intent → IntentResult { needsClarification: true, question: "预期篇幅是多少？", clarificationHistory: [{q: "面向受众", a: "技术开发者"}] }
  ↓
round=2，渲染下一个追问
  ↓
...（重复直至满足停止条件）
  ↓
停止 → 进入正常推荐流程（IntentConfirmation / EmployeeRecommendSheet）
```

## Component Changes

### 新增 `MultiTurnClarifyBubble`（intent-bubble.tsx）

聊天气泡形式，每轮渲染 1 个追问。包含：
- 问题文本
- 选项按钮（options 非空时）
- 自定义输入框（allowCustom=true 时）
- 「跳过」按钮

### 修改 `embedded-chat-panel.tsx`

在 intent 渲染区域（当前处理 `pendingIntent` 处），增加分支：

```
if (isMultiTurnActive && pendingIntent?.needsClarification):
  → 不显示 ClarificationCard / ClarificationForm
  → 显示 MultiTurnClarifyBubble（1 个问题）

if (isMultiTurnActive && !pendingIntent?.needsClarification):
  → 多轮结束，进入推荐流程
```

### 修改 `use-chat-stream.ts`

在 `executeIntentFn` 中，当 `needsClarification && isMultiTurnActive` 时：
1. 设置 `multiTurnState = { round: round + 1, history: [...prev, {question, answer}] }`
2. 不设置 `pendingIntent`（避免触发推荐 UI）
3. 设置一个新的 `pendingClarify` 状态，让 UI 渲染追问气泡

在用户回答后：
1. 调用 `executeIntentFn` 重新分析意图（传入完整上下文）
2. 如果仍需要追问 → 继续轮次
3. 如果不需要 → 清除 `multiTurnState`，设置 `pendingIntent` 进入推荐

### 修改 `intent-parser.ts` (Agent)

Prompt 变化：
- 当前：生成所有 `clarificationQuestions` 数组
- 改为：生成 1 个 `clarificationQuestion`（最重要的），附带 `clarificationHistory` 上下文
- 新增 `isMultiTurn` 指示器：true 时优先基于历史答案做判断，false 时首次分析

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| LLM 生成重复追问 | 在 prompt 中明确"不要重复已问过的问题"；`clarificationHistory` 作为禁止列表 |
| 多轮追问无限循环 | 硬限制 `MAX_CLARIFY_ROUNDS = 5`；用户可点击「跳过」 |
| 追问气泡与现有 IntentConfirmation 重叠 | 状态机互斥——追问进行时不显示推荐 UI |
| Prompt 修改影响现有意图准确率 | 先在 `/api/chat/intent` 的 prompt 中添加 `isMultiTurn: true` 分支，新老逻辑共存测试 |
| 用户可能不知道是追问 | 追问气泡有明确标识："穆兰追问 (1/5)"，与普通消息视觉区分 |

## Open Questions

1. 追问的超时处理？如果用户不回答追问直接输入新话题，应该重置追问还是继续？
   - 建议：用户输入新话题时重置多轮状态，重新走意图识别
2. 是否需要用户显式确认所有回答汇总后再推荐？
   - 建议：不需要，多轮结束后自动进入推荐流程；用户可在推荐阶段修改