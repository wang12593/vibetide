## Why

Inngest 已在之前迁移中被 BullMQ 完全替代（package.json 无 inngest 依赖，`src/inngest/` 目录已删除），但代码库中仍有 22 个文件残留对 "Inngest" 的引用——包括类型命名（`InngestEventMap`）、注释、Showcase 展示文案等。这些残留会造成误导，让开发者误以为项目仍在使用 Inngest，也与 CLAUDE.md 中描述的 "Inngest (background jobs)" 不一致。

## What Changes

1. **重命名 `InngestEventMap` → `EventMap`**：`src/lib/queue/dispatch.ts` 中的类型名从 `InngestEventMap` 改为 `EventMap`
2. **清理所有注释中的 Inngest 引用**：约 18 个文件中的注释提到 "Inngest"，更新为 "BullMQ" 或直接删除
3. **更新 Showcase 页面文案**：将技术栈展示中的 "Inngest 事件调度" 更新为 "BullMQ 任务队列"
4. **更新 CLAUDE.md**：将 "Inngest (background jobs, event-driven workflows)" 更新为 "BullMQ (Redis-backed job queues)"
5. **更新 AGENTS.md**：同步更新文档中对 Inngest 的描述
6. **清理 .trae/skills/learned/ 中的 Inngest 学习记录**：删除过时的 Inngest 相关 learned skill 文件

## Capabilities

### New Capabilities

（无新增能力）

### Modified Capabilities

（无 spec 级别行为变更）

## Impact

- **类型重命名**：`InngestEventMap` → `EventMap`，影响 `dispatch.ts` 及其所有 import 方（约 6 个 worker 文件）
- **注释/文案更新**：约 22 个文件的文本修改，无功能影响
- **文档更新**：`CLAUDE.md`、`AGENTS.md` 描述修正
- **无 Breaking Change**：所有修改均为注释、命名和文档层面，无运行时行为变更
- **回滚计划**：纯文本替换，可通过 git revert 一步回滚