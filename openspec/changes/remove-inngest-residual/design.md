## Context

项目已完成从 Inngest 到 BullMQ 的迁移。当前状态：

- `package.json`：无 inngest 依赖，已有 `bullmq ^5.76.6` + `ioredis ^5.10.1` + `node-cron ^4.2.1`
- `src/inngest/`：已删除
- `src/app/api/inngest/`：已删除
- `src/lib/queue/`：完整的 BullMQ 任务系统（6 队列、23+ handler、9 cron、17 事件）
- 残留：22 个文件中存在 "inngest" 文本引用（类型名、注释、文档、Showcase）

## Goals / Non-Goals

**Goals:**
- 清除所有 "inngest" 残留引用，使代码库命名和注释完全一致
- 更新项目文档（CLAUDE.md / AGENTS.md）反映当前技术栈

**Non-Goals:**
- 不修改 BullMQ 的任何运行时代码
- 不新增功能
- 不修改数据库 schema

## Decisions

### D1. `InngestEventMap` → `EventMap`

**决策**：将 `dispatch.ts` 中的类型名 `InngestEventMap` 重命名为 `EventMap`。

**理由**：该类型是唯一一个在运行时代码中使用 "Inngest" 命名的标识符，重命名后更准确。

**替代方案**：`QueueEventMap` → 也可以，但 `EventMap` 更简洁，且 dispatch 模块上下文已明确是队列事件。

### D2. 注释中 "Inngest" → 删除或改为 "BullMQ"

**决策**：注释中引用 Inngest 的地方，根据上下文：
- 描述当前行为的 → 改为 "BullMQ"
- 描述历史行为的（如 "migrated from Inngest"）→ 直接删除
- 测试 mock 注释 → 更新为 "BullMQ dispatch"

### D3. Showcase 页面

**决策**：将技术栈展示中的 "Inngest 事件调度" 改为 "BullMQ 任务队列"。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 类型重命名导致外部 import 编译错误 | `tsc --noEmit` 验证，重命名后全局搜索 import 确认 |
| Showcase 页面文案修改影响展示效果 | 仅文本替换，无 UI 结构变更 |

## Migration Plan

1. 类型重命名 + 全局 import 修复
2. 注释清理（grep + replace）
3. 文档更新
4. `tsc --noEmit` + `npm run build` 验证
5. 单次 commit 推送