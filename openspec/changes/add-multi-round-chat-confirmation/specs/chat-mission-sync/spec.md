## ADDED Requirements

### Requirement: Chat-to-Mission Auto Sync
系统 SHALL 在意图执行开始时自动创建 Mission 并关联到任务中心，实现对话任务的全程追踪。

#### Scenario: Intent execution creates mission
- **WHEN** 用户确认意图并开始执行（通过 `/api/chat/intent-execute`）
- **THEN** 系统在执行开始前自动创建一条 Mission 记录，标题取自用户需求摘要，状态为 `executing`

#### Scenario: Mission linked to conversation
- **WHEN** Mission 从对话中创建
- **THEN** Mission 记录关联 `conversationId`，任务中心可追溯来源对话

#### Scenario: Mission tracks execution steps
- **WHEN** 意图执行包含多个步骤（如 xiaolei 搜索 → xiaowen 写稿）
- **THEN** 每个步骤作为 Mission 下的 Task 记录，状态随执行进度同步更新

#### Scenario: Mission created via fire-and-forget
- **WHEN** Mission 创建过程发生错误（如 DB 写入失败）
- **THEN** 错误不阻塞对话执行，仅记录日志，对话 SSE 流正常继续

### Requirement: Mission Metadata from Clarification
系统 SHALL 将澄清阶段收集的参数作为 Mission 元数据存储。

#### Scenario: Parameters stored as mission config
- **WHEN** 澄清阶段收集了参数（主题、字数、风格等）
- **THEN** 这些参数以 JSON 格式存入 Mission 的 `config.metadata` 字段

#### Scenario: No clarification still creates mission
- **WHEN** feature flag 关闭或用户跳过澄清
- **THEN** Mission 仍然创建，metadata 字段为空对象

### Requirement: Mission Status Sync
系统 SHALL 在意图执行过程中同步更新 Mission 状态。

#### Scenario: Step completion updates task status
- **WHEN** 意图执行的某个步骤完成
- **THEN** 对应的 Mission Task 状态更新为 `completed`

#### Scenario: All steps complete updates mission status
- **WHEN** 意图执行的所有步骤完成
- **THEN** Mission 状态更新为 `completed`

#### Scenario: Execution error updates mission status
- **WHEN** 意图执行过程中发生错误
- **THEN** Mission 状态更新为 `failed`，错误信息记录到 Mission 消息中

### Requirement: Mission Visibility in Task Center
从对话创建的 Mission SHALL 在任务中心可见，并标注来源。

#### Scenario: Chat-sourced mission badge
- **WHEN** 用户打开任务中心
- **THEN** 从对话创建的 Mission 显示"来自对话"标签，点击可跳转到原对话

#### Scenario: Mission list includes chat missions
- **WHEN** 用户查看任务中心列表
- **THEN** 对话创建的 Mission 与其他 Mission 混合展示，按时间排序
