## ADDED Requirements

### Requirement: 多轮追问触发条件

系统 SHALL 在 `/api/chat/intent` 返回 `needsClarification: true` 时启动多轮追问流程，而非立即展示单次表单。多轮追问仅对 `employeeSlug === "leader"` 的场景生效。

#### Scenario: 单步骤低置信度触发多轮

- **WHEN** 用户输入一个模糊请求（例如"写篇文章"），且意图识别返回 `needsClarification: true` 且 `steps.length <= 1`
- **THEN** 系统启动多轮追问流程，展示第 1 个追问气泡（而非单次 `ClarificationCard`）

#### Scenario: 高置信度跳过追问

- **WHEN** 意图识别返回 `confidence >= 0.9` 且 `needsClarification: false`
- **THEN** 系统直接进入推荐/执行阶段，跳过追问

---

### Requirement: 每轮追问内容与格式

每轮追问 MUST 只展示 1 个 `ClarificationQuestion`。该问题可以包含选项按钮，也支持自定义输入。

#### Scenario: 带选项的追问

- **WHEN** 意图识别返回的 `clarificationQuestions[0].options` 非空
- **THEN** 渲染选项按钮供用户点击选择，同时提供「自定义输入」入口

#### Scenario: 纯文本追问

- **WHEN** 意图识别返回的 `clarificationQuestions[0].options` 为空
- **THEN** 渲染文本输入框供用户自由输入回答

---

### Requirement: 追问气泡 UI

追问气泡 MUST 以聊天气泡形式嵌入对话流，与普通消息视觉区分。

#### Scenario: 追问气泡渲染

- **WHEN** 多轮追问处于激活状态
- **THEN** 在最近一条用户消息后渲染题为「穆兰追问 (1/5)」的气泡，包含问题文本和交互元素

#### Scenario: 追问气泡消失

- **WHEN** 用户回答了当前追问
- **THEN** 追问气泡替换为用户回答消息，并触发下一轮追问（或结束追问进入推荐）

---

### Requirement: 多轮状态管理

前端 MUST 维护 `multiTurnState` 追踪追问进度，包含轮次编号和历史记录。

#### Scenario: 轮次递增

- **WHEN** 用户回答了第 N 轮追问
- **THEN** 系统将 `{ question, answer }` 追加到 `clarificationHistory`，轮次递增至 N+1

#### Scenario: 历史回传

- **WHEN** 发起新一轮意图识别
- **THEN** 系统将累积的 `clarificationHistory` 作为 `IntentResult.clarificationHistory` 回传到 `/api/chat/intent`

---

### Requirement: 追问停止条件

系统 MUST 在满足以下任意条件时停止多轮追问：

1. 意图识别不再返回 `needsClarification: true`
2. 追问轮数达到上限 `MAX_CLARIFY_ROUNDS = 5`
3. 用户点击「跳过，直接推荐」

#### Scenario: 信息充足后停止

- **WHEN** 用户回答追问后重新调用 `/api/chat/intent` 返回 `needsClarification: false`
- **THEN** 多轮追问停止，系统进入推荐/执行阶段（展示 `IntentConfirmation` 或单步推荐）

#### Scenario: 达到轮数上限

- **WHEN** 追问轮数达到 5 轮
- **THEN** 系统强制结束追问，基于已有信息进入推荐/执行阶段

#### Scenario: 用户主动跳过

- **WHEN** 用户点击追问气泡上的「跳过，直接推荐」按钮
- **THEN** 多轮追问停止，系统基于已有信息进入推荐/执行阶段

---

### Requirement: 对话重置

当用户在追问过程中输入新的无关话题时，系统 SHALL 重置多轮状态。

#### Scenario: 新话题重置

- **WHEN** 追问进行中，用户输入了一个与当前追问无关的新消息
- **THEN** 系统重置 `multiTurnState` 为初始状态，重新对用户输入进行意图识别，不走追问继续逻辑