## Current State

`/home` 当前已经以 `leader` 作为穆兰对话入口，但旧的技能和工作流配置逻辑仍残留。`/chat` 当前实现了穆兰置顶、手动建群、单员工推荐卡片和多员工推荐建群，但这些推荐确认会跳转到 `/chat` 参数路由。意图识别仍会生成 `skills`，且没有把场景作为一等路由目标。

数据隔离方面，员工 DAL 已有 admin-aware 查询能力，但部分页面没有传递管理员上下文；自定义员工创建缺少 `createdBy`；技能和场景的页面模式、Server Action 所有权检查仍需补齐。

队列方面，运行时代码使用 BullMQ，但 OpenSpec 配置仍描述 Inngest，`intentDispatch` 队列缺少 worker 注册路径。

## Target Architecture

### Mulan Route Contract

穆兰意图识别输出统一收敛为路由目标，而不是执行细节：

```ts
type MulanRoute =
  | { kind: "llm"; reason: string }
  | { kind: "employee"; employeeSlug: string; reason: string; confidence: number }
  | { kind: "scenario"; scenarioId: string; reason: string; confidence: number }
  | {
      kind: "mission";
      title: string;
      employeeSlugs: string[];
      scenarioId?: string;
      reason: string;
      confidence: number;
    };
```

路由判断顺序：

1. 简单问候、闲聊、低任务复杂度内容直接走穆兰 LLM。
2. 明确员工能力、员工名称、单一职责匹配时优先推荐员工。
3. 未命中单员工但命中可复用流程时推荐场景。
4. 多步骤、跨员工、需要沉淀任务状态的请求创建 Mission。

`skills` 不作为穆兰路由目标出现。员工内部如何调用技能仍由员工 agent 或场景执行逻辑决定。

### Mulan UI Launch Surface

所有从穆兰发起的员工相关动作都在 `/home` 穆兰界面内完成：

- 单员工：展示员工推荐卡片，用户可在穆兰内开始对话或拉起该员工执行。
- 多员工：展示建群推荐卡片，用户确认后内联创建群聊并继续显示群聊上下文。
- 场景：展示场景推荐卡片，用户确认后在穆兰内选择/确认参与员工。
- Mission：创建 Mission 后在穆兰内展示任务状态、参与员工和继续对话入口。

`/chat` 保留为对话中心，不再作为穆兰推荐链路的必需跳转目标。

### Visibility Model

自定义内容遵循同一规则：

- 普通用户可见：系统预置内容 + 自己创建的自定义内容。
- 管理员可见：组织内系统预置内容 + 所有用户创建的自定义内容。
- 修改/删除：创建者或管理员可操作；非创建者普通用户必须被 Server Action 拒绝。

员工、技能和场景的列表查询、详情读取、更新、删除都必须在服务端执行相同约束，客户端显示只作为体验优化。

### Scenario Naming

用户可见文案统一使用“场景”。内部 `workflow_templates`、`workflowId`、`workflowTemplateId` 等命名保留，避免数据库迁移和历史 API 兼容风险。新增代码中的 UI 组件、按钮、页面标题优先使用 `scenario`/`场景` 命名。

### BullMQ Boundary

新增或调整的异步意图/任务分发只使用 BullMQ。Inngest 不应出现在运行时代码、OpenSpec 项目上下文或用户可见文档中。若使用 `intentDispatch` 队列，必须注册 worker 并提供失败日志；若暂不使用，应删除死队列定义。

## Rollout Plan

1. 先完成低风险收口：引导页删除、场景文案、权限查询和所有权检查。
2. 再调整穆兰意图输出契约，保持旧 `/chat` 流程可回退。
3. 最后把推荐卡片、建群确认、Mission 创建迁入 `/home` 穆兰界面。

## Risks

- 活跃 OpenSpec 变更较多，存在重复任务。本变更需要在实现时引用并收敛相关任务，而不是并行制造另一套 UI。
- “工作流改名为场景”如果扩大到 DB/API，会显著增加迁移风险；本设计明确先限制为用户可见层。
- intent 输出结构变化会影响前端组件和 API 调用，需要通过类型检查和关键路径手测兜底。
