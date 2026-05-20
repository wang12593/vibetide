## 1. 类型重命名

- [x] 1.1 在 `src/lib/queue/dispatch.ts` 中将 `InngestEventMap` 重命名为 `EventMap`
- [x] 1.2 全局搜索所有 import `InngestEventMap` 的文件，更新为 `EventMap`（无外部 import）

## 2. 注释清理

- [x] 2.1 搜索 `src/lib/queue/` 目录下所有文件中的 "inngest"（不区分大小写），将注释中的引用更新或删除
- [x] 2.2 搜索 `src/lib/cms/` 目录下所有文件中的 "inngest"，更新注释
- [x] 2.3 搜索 `src/lib/collection/` 目录下所有文件中的 "inngest"，更新注释
- [x] 2.4 搜索 `src/app/actions/` 目录下所有文件中的 "inngest"，更新注释
- [x] 2.5 搜索 `src/app/api/` 目录下所有文件中的 "inngest"，更新注释
- [x] 2.6 搜索测试文件 `src/**/*.test.ts` 中的 "inngest"，更新注释

## 3. Showcase 页面文案

- [x] 3.1 在 Showcase 相关文件中将 "Inngest" 改为 "BullMQ 任务队列"

## 4. 项目文档更新

- [x] 4.1 更新 `CLAUDE.md`：将 "Inngest (background jobs, event-driven workflows)" 改为 "BullMQ (Redis-backed job queues, node-cron scheduling)"
- [x] 4.2 更新 `CLAUDE.md`：将 Inngest 相关的 Environment Variables 部分替换为 REDIS_URL
- [x] 4.3 更新 `CLAUDE.md`：将 Inngest 函数列表更新为 BullMQ Worker/队列描述
- [x] 4.4 更新 `AGENTS.md`：确认无 Inngest 引用（无需修改）

## 5. 清理学习记录

- [x] 5.1 删除 `.trae/skills/learned/inngest-direct-execution-fallback.md`

## 6. 验证

- [x] 6.1 运行 `npx tsc --noEmit` — 零错误通过
- [x] 6.2 运行 `npm run build` — 生产构建通过
- [x] 6.3 全局搜索确认 `src/` 下不再存在 "inngest" 引用