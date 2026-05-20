## MODIFIED Requirements

### Requirement: Intent Recognition with Parameter Context
意图识别系统 SHALL 接收来自澄清阶段的参数上下文，将其作为额外输入提升意图识别准确度和员工分派质量。

#### Scenario: Clarified parameters improve recognition
- **WHEN** 澄清阶段收集到参数 `{ topic: "AI教育", wordCount: "3000", style: "专业" }` 后传入意图识别
- **THEN** 系统基于参数上下文生成更精确的 `IntentResult`，`confidence` 高于无参数时的基线

#### Scenario: Parameters determine employee assignment
- **WHEN** 澄清参数包含风格为"视频脚本"
- **THEN** 意图识别将 `employeeSlug` 分派给 xiaowen（内容创作）而非 xiaolei（信息检索）

#### Scenario: Parameters included in step task description
- **WHEN** 意图执行步骤生成时
- **THEN** 每个步骤的 `taskDescription` 包含澄清收集的关键参数，如"撰写一篇关于AI教育的3000字专业风格稿件"

#### Scenario: No parameters fallback to existing flow
- **WHEN** feature flag 关闭或用户跳过澄清，参数上下文为空
- **THEN** 意图识别完全走现有流程，行为无任何变化

## ADDED Requirements

### Requirement: Clarification-Aware Intent API
`/api/chat/intent` 端点 SHALL 支持接收可选的 `clarifiedParameters` 字段。

#### Scenario: Intent API with parameters
- **WHEN** 前端发送 POST `/api/chat/intent` 包含 `{ message, employeeSlug, clarifiedParameters: { topic, wordCount, style } }`
- **THEN** 意图识别将参数作为上下文传入 LLM prompt，生成更精确的 IntentResult

#### Scenario: Intent API without parameters (backward compatible)
- **WHEN** 前端发送 POST `/api/chat/intent` 不包含 `clarifiedParameters`
- **THEN** 端点行为与当前完全一致，零影响
