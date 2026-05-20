## CHANGED Requirements

### Requirement: Mission 创建后状态正确流转

系统 SHALL 在 SSE 流执行完毕后正确更新 Mission 状态。

#### Scenario: 全部步骤成功完成

- **GIVEN** SSE 流中所有步骤执行成功
- **WHEN** 流结束
- **THEN** `missions.status` 更新为 `completed`

#### Scenario: 步骤执行失败

- **GIVEN** SSE 流中某步骤执行失败且不可恢复
- **WHEN** 流结束
- **THEN** `missions.status` 更新为 `failed`

---

### Requirement: Mission 创建是同步的

系统 SHALL 在开始执行步骤前确保 Mission 和 Tasks 已写入数据库。

#### Scenario: Mission 创建完成后再执行

- **WHEN** `startMissionFromChat()` 被调用
- **THEN** 系统等待 Mission 和 Tasks 写入完成后才开始 SSE 流执行
- **AND** SSE 流中的 `updateMissionTaskStatus` 能正确匹配到刚创建的 Tasks

---

### Requirement: Task 状态更新限定 Mission

`updateMissionTaskStatus` SHALL 在 WHERE 条件中包含 `missionId`。

#### Scenario: 精确更新目标 Mission 的 Tasks

- **GIVEN** 同一个员工在多个 Mission 中都有 `priority: 0` 的 Task
- **WHEN** 更新某个 Mission 的 Task 状态
- **THEN** 只更新目标 Mission 的 Tasks，不影响其他 Mission

---

### Requirement: 统一 Mission 创建 Schema

两条 Mission 创建路径 SHALL 产出一致的 Schema。

#### Scenario: 路径 B 补充完整字段

- **WHEN** 通过 `dal/missions.ts:createMissionFromChat` 创建 Mission
- **THEN** Mission 包含 `teamMembers`、`workflowTemplateId`、`inputParams` 字段