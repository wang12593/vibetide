## Why

当前项目已经具备穆兰对话、员工推荐、群聊、Mission、场景模板和 BullMQ 队列的部分实现，但这些能力分散在 `/home`、`/chat`、intent recognition、workflow templates 和 mission actions 中，导致用户路径不一致：

- 首页虽然已接入穆兰，但仍保留技能直选和旧的工作流配置残留。
- 员工推荐和推荐建群已经在 `/chat` 中实现，但穆兰入口触发后会跳转到 `/chat`，不符合“所有涉及员工的都在穆兰界面拉起”。
- 意图识别仍以 skills 作为步骤输出的一部分，和“优先员工，其次场景，不要 skills”的产品方向冲突。
- 自定义员工、技能、工作流/场景的“仅自己可见，管理员可见全部”尚未在页面、DAL 和 Server Action 层完全闭环。
- 运行时代码已基本迁移到 BullMQ，但 OpenSpec 配置、文档和 intent-dispatch 队列注册仍存在残留或未完成点。
- `add-landing-page` 活跃变更与“引导页删除”方向冲突，需要明确不再推进。

## What Changes

1. 删除/停用引导页和落地页相关入口，认证后首页固定进入 `/home` 穆兰智能体。
2. 将 `/home` 收敛为穆兰主交互：简单对话、员工推荐、场景推荐、建群推荐和 Mission 创建都在穆兰界面内完成。
3. 调整穆兰意图识别契约：路由优先级为员工，其次场景，不再输出 skills 作为穆兰路由目标。
4. 实现穆兰三层路由：简单对话走 LLM；明确员工/场景意图展示推荐卡片；复杂任务创建 Mission，并在穆兰界面中拉起相关员工或群聊。
5. 将用户可见的“工作流”统一改名为“场景”；数据库表名和内部函数名暂不重命名，避免不必要的 breaking change。
6. 完成自定义员工、技能、场景的数据隔离：普通用户只看自己创建的自定义内容，管理员可见并可管理组织内全部内容。
7. 补齐 BullMQ 迁移收口：清理 Inngest 残留配置/文档，确保新增异步意图/任务分发只使用 BullMQ。

## Relationship to Existing Changes

- Supersedes active `add-landing-page`;本变更明确不再新增公开落地页。
- Extends active `mulan-home-multi-turn-interaction` by making `/home` the canonical Mulan launch surface.
- Extends active `permission-system-fix` for custom employee/skill/scenario ownership and admin visibility.
- Extends active `fix-chat-mission-sync-and-routing` for Mulan-originated group and Mission launch behavior.
- Complements completed `remove-inngest-residual` by covering OpenSpec config, docs, and queue registration gaps.

## Non-Goals

- 不重命名数据库表 `workflow_templates` 或大规模改动历史 API 命名。
- 不删除 `/chat` 页面；`/chat` 保留为完整对话中心和历史会话入口，但穆兰推荐链路不再依赖跳转到 `/chat`。
- 不在本变更内重做权限模型或角色系统，只补齐当前产品需求所需的所有权和管理员可见性。

## Impact

- **Routes/UI**: `/home`、`/chat`、员工/技能/场景管理页、侧边栏文案。
- **Agent**: `intent-recognition`、`/api/chat/intent`、`use-chat-stream` 的路由契约。
- **Data Access**: employee、skills、workflow templates 的列表过滤和 Server Action 所有权检查。
- **Queue**: BullMQ worker 注册、队列命名一致性、Inngest 文档残留。
- **Compatibility**: 内部 workflow template 数据结构继续使用现有 schema，用户界面显示为“场景”。
