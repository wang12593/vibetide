## Context

### 已有实现（slash-at-mention-commands）

- `CommandPopover` 组件：通用弹出菜单，支持模糊搜索、键盘导航
- `useCommandTrigger` Hook：IME-safe 的 `/` 和 `@` 触发检测
- `home-client.tsx` 中集成了两个 `CommandPopover`：`/` 技能 + `@` 员工
- **限制 1**：`CommandPopover` 的 `visible` 条件为 `mode === "home" && slashTrigger.visible`，chat 模式下不触发
- **限制 2**：技能数据仅来自 `getAllBuiltinSkills()`（文件系统），不含自定义技能
- **限制 3**：`handleChatSend` 不支持 `selectedTargetSlug` / `intentContext`

### 自定义技能系统

- `skills` 表支持 `type: "builtin" | "custom" | "plugin"`
- 自定义技能有 `createdBy` 字段，标识创建者
- `getSkillsWithBindCount({ userId, mode: "own" })` 返回内置技能 + 用户自建的技能
- 技能绑定到员工通过 `employee_skills` 关联表

### 聊天模式

- `home-client.tsx` 有两种模式：`mode === "home"`（初始状态）和 `mode === "chat"`（对话中）
- 两种模式共享同一个 textarea，但绑定不同的 state（`inputValue` vs `chatInput`）
- `handleChatSend` 处理 chat 模式的发送，使用 `chat.sendMessage` Hook

## Goals / Non-Goals

**Goals:**
- `/` 菜单显示内置技能 + 用户创建的自定义技能
- `/` 和 `@` 在 chat 模式下也可使用
- chat 模式下选择技能/员工后正确传递参数

**Non-Goals:**
- 不修改 `CommandPopover` 组件本身（已满足需求）
- 不修改 `useCommandTrigger` Hook（已满足需求）
- 不实现插件技能的显示（只在 `/skills` 页面管理）
- 不修改群聊的 `@` 功能（已在 chat-panel.tsx 中实现）

## Decisions

### D1. 自定义技能数据获取：Server Component 预加载

**决策**：在 `page.tsx` 中调用 `getSkillsWithBindCount({ userId, mode: "own" })`，过滤出 `type === "custom"` 的技能，与内置技能合并后传给 `HomeClient`。

**理由**：与内置技能获取方式一致，在 Server Component 中预加载，不需要额外 API 路由。`mode: "own"` 确保只返回用户自己创建的自定义技能。

### D2. 技能列表合并与去重

**决策**：内置技能使用 `slug` 作为 id，自定义技能使用数据库 `id` 作为 id。合并后在 `CommandPopover` 中按分类分组显示，自定义技能标注 `[自定义]` 标签。

**理由**：两种技能的 id 体系不同，不会冲突。按分类分组让用户快速找到需要的技能。

### D3. Chat 模式下的发送逻辑

**决策**：`handleChatSend` 增加 `selectedTargetSlug` 支持。当 `selectedTargetSlug` 存在时，调用 `chat.sendMessage(text, undefined, { skipIntent: true, targetEmployeeSlug })`；否则正常发送。

**理由**：复用已有的 `sendMessage` 参数，不需要修改 Hook 层。

### D4. Chat 模式下技能选择后的处理

**决策**：选择技能后，在输入框上方显示一个 chip 标记已选技能名称，发送时将技能 slug 附加到 `intentContext.skills`。

**理由**：用户需要一个可见的反馈来确认已选择了哪个技能。chip 标记比 placeholder 更直观。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 自定义技能过多导致列表过长 | 按分类分组 + 模糊搜索，与内置技能统一体验 |
| 自定义技能与内置技能同名 | 显示类型标签区分，选择时优先匹配内置技能 |
| Chat 模式下误触发 | 保持与 home 模式相同的触发条件（行首/空格后 + IME-safe） |
| 多一次 DB 查询影响首页加载 | `getSkillsWithBindCount` 已有索引，与现有查询并行执行 |
