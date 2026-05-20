## ADDED Requirements

### Requirement: Requirement Clarification Engine
系统 SHALL 在用户发起任务型消息时，在意图识别之前启动多轮需求澄清流程，通过 AI 动态生成澄清问题逐步收集任务所需的完整参数。

#### Scenario: Content creation triggers clarification
- **WHEN** 用户发送"帮我写一篇稿件"
- **THEN** 系统识别该消息为任务型意图，启动需求澄清流程，返回第一个澄清问题（如"请问稿件的主题是什么？"）

#### Scenario: General chat skips clarification
- **WHEN** 用户发送"你好"或普通闲聊消息
- **THEN** 系统跳过澄清流程，直接进入现有对话模式

#### Scenario: Sufficient parameters auto-skip clarification
- **WHEN** 用户发送"帮我写一篇关于AI技术发展的2000字深度分析稿件，风格要专业严谨"
- **THEN** 系统检测到消息已包含充分参数（主题、字数、风格），自动跳过澄清，直接进入意图识别

#### Scenario: User explicitly skips clarification
- **WHEN** 用户在澄清过程中发送"跳过"或"直接开始"
- **THEN** 系统使用已收集的部分参数（可能为空）直接进入意图识别阶段

### Requirement: Parameter Template System
系统 SHALL 按 `ChatIntentType` 维护参数模板，定义每种意图类型的必填参数、选填参数和推荐问题格式。

#### Scenario: Content creation parameters
- **WHEN** 意图类型为 `content_creation`
- **THEN** 系统加载稿件创作参数模板，包含必填参数（主题/题材、字数范围）和选填参数（风格、受众、关键词、参考链接）

#### Scenario: Data analysis parameters
- **WHEN** 意图类型为 `data_analysis`
- **THEN** 系统加载数据分析参数模板，包含必填参数（分析维度、时间范围）和选填参数（对比指标、输出格式）

#### Scenario: Media production parameters
- **WHEN** 意图类型为 `media_production`
- **THEN** 系统加载视频制作参数模板，包含必填参数（视频类型、时长）和选填参数（风格、配音要求、字幕需求）

### Requirement: Multi-round Clarification Session
系统 SHALL 维护澄清会话状态，支持多轮交互直到所有必填参数收集完毕或用户主动结束。

#### Scenario: Progressive parameter collection
- **WHEN** 用户在第一轮回答"主题是AI教育"
- **THEN** 系统记录该参数，生成下一个缺失必填参数的澄清问题（如"请问需要多少字？"）

#### Scenario: Multiple parameters in single response
- **WHEN** 用户在单条消息中回答"主题是AI教育，3000字，专业风格"
- **THEN** 系统一次性解析并记录所有提供的参数，仅对仍缺失的必填参数继续提问

#### Scenario: Parameter confirmation summary
- **WHEN** 所有必填参数已收集完毕
- **THEN** 系统展示参数确认摘要（如"主题：AI教育 | 字数：3000字 | 风格：专业"），用户确认后进入意图识别

#### Scenario: Parameter modification during clarification
- **WHEN** 用户在澄清过程中说"字数改成5000字"
- **THEN** 系统更新对应参数值，重新展示确认摘要

### Requirement: Clarification API Endpoint
系统 SHALL 提供 `/api/chat/clarify` SSE 流式端点处理澄清对话。

#### Scenario: Initiate clarification session
- **WHEN** 前端发送 POST `/api/chat/clarify` 包含 `{ message, conversationId }`
- **THEN** 系统返回 SSE 流，包含 AI 生成的澄清问题或参数确认摘要

#### Scenario: Continue clarification session
- **WHEN** 前端发送后续消息到 `/api/chat/clarify` 包含 `{ message, conversationId, sessionId }`
- **THEN** 系统基于已有参数状态继续澄清，返回 SSE 流

#### Scenario: Clarification session timeout
- **WHEN** 澄清会话超过 10 分钟无活动
- **THEN** 系统自动关闭会话，用户下次发送消息时重新开始

### Requirement: Clarification Frontend UI
系统 SHALL 在对话面板中展示澄清交互卡片，包含 AI 提问、用户输入和参数进度指示。

#### Scenario: Clarification card display
- **WHEN** 澄清流程启动
- **THEN** 对话面板展示澄清卡片，显示当前问题、已收集参数列表和进度指示（如"2/4 参数已确认"）

#### Scenario: Parameter confirmation card
- **WHEN** 所有必填参数收集完毕
- **THEN** 展示确认卡片，列出所有参数供用户最终确认或修改

#### Scenario: Quick skip button
- **WHEN** 澄清卡片展示中
- **THEN** 提供"跳过确认，直接开始"按钮，用户可随时跳过

### Requirement: Clarification Feature Flag
系统 SHALL 通过环境变量 `VIBETIDE_REQUIREMENT_CLARIFICATION_ENABLED` 控制澄清功能的启用。

#### Scenario: Feature flag enabled
- **WHEN** 环境变量 `VIBETIDE_REQUIREMENT_CLARIFICATION_ENABLED` 为 `true`
- **THEN** 任务型消息触发澄清流程

#### Scenario: Feature flag disabled
- **WHEN** 环境变量 `VIBETIDE_REQUIREMENT_CLARIFICATION_ENABLED` 为 `false` 或未设置
- **THEN** 所有消息直接走原有意图识别流程，零代码路径执行
