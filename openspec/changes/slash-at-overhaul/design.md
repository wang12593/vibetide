## Context

### 当前 Bug 根因分析

**Bug 1: 选择后消失**
- `home-client.tsx` 中 `onSelect` 回调：`slashTrigger.handleSelect(); setInputValue("");`
- 问题：清空了输入框，没有设置任何选中状态变量，用户看不到反馈
- 修复：选择后设置 `selectedSkill` / `selectedTargetSlug` state，显示 chip

**Bug 2: Chat 模式不可用**
- `CommandPopover` 的 `visible` 硬编码 `mode === "home" && slashTrigger.visible`
- `onChange` 中只在 `!mode === "chat"` 时调用 `slashTrigger.handleChange`
- 修复：移除 `mode === "home"` 条件限制

**Bug 3: Chat 模式键盘冲突**
- `onKeyDown` 在 chat 模式使用 `handleChatKeyDown`，不检查 `slashTrigger.visible`
- 修复：统一在两个模式的 `onKeyDown` 中先检查弹出菜单状态

### 自定义命令需求

用户希望能封装常用指令为 `/` 命令。例如：
- `/review` → "请帮我审核以下内容的质量、准确性和可读性"
- `/seo` → "请帮我进行 SEO 优化分析，包括关键词、标题、描述"
- `/daily` → "帮我整理今日 AI 领域的热点新闻"

这些本质上是"指令模板"，和 `skills` 表的 `custom` 类型技能结构非常相似。**复用现有 `skills` 表**而非新建表，通过 `runtimeConfig.type === "prompt_template"` 区分。

### 约束

- 不新建数据库表（复用 `skills` 表的 custom 类型）
- 不修改 `CommandPopover` 和 `useCommandTrigger` 的核心逻辑
- 不影响群聊中已有的 `@` 功能（`chat-panel.tsx`）

## Goals / Non-Goals

**Goals:**
- 修复 3 个 Bug（选择消失、chat 模式不可用、键盘冲突）
- 选择后显示 chip 反馈，可取消
- 合并内置技能 + 自定义技能 + 自定义命令
- Chat 模式完全可用 `/` 和 `@`
- 用户可创建自定义 `/` 命令（指令模板）

**Non-Goals:**
- 不修改群聊的 `@` 功能
- 不实现嵌套命令参数（如 `/search query`）
- 不实现命令别名或快捷键绑定

## Decisions

### D1. 选中状态反馈：chip 标签

**决策**：在输入框上方（attachment chips 同行）显示已选技能/员工的 chip 标签，包含名称和 × 关闭按钮。

**理由**：与附件 chips 的 UI 模式一致，用户熟悉。chip 在发送后自动清除。

### D2. 自定义命令复用 skills 表

**决策**：复用 `skills` 表的 `type: "custom"` 记录，`content` 字段存储指令模板文本，`runtimeConfig.type` 设为 `"prompt_template"` 以区分普通技能。

**理由**：避免新建表，复用已有的技能管理页面（`/skills`）来管理自定义命令。`content` 字段已经存在，可以直接存储指令模板。

### D3. Chat 模式触发条件统一

**决策**：移除所有 `mode === "home"` 限制，`/` 和 `@` 在 home 和 chat 模式下都可用。通过同一个 textarea 的 onChange/onKeyDown 统一处理。

**理由**：两种模式共享同一个 textarea 和 `CommandPopover`，只是绑定不同的 state（`inputValue` vs `chatInput`）。

### D4. Chat 模式发送逻辑

**决策**：`handleChatSend` 增加 `selectedTargetSlug` 和 `selectedSkill` 参数支持。发送时如果有 `selectedTargetSlug`，调用 `chat.sendMessage(text, undefined, { skipIntent: true, targetEmployeeSlug })`。如果有 `selectedSkill` 且是自定义命令（`prompt_template`），将指令模板内容拼接为完整 prompt 发送。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 自定义技能/命令过多导致列表过长 | 按分类分组 + 模糊搜索 |
| Chat 模式误触发 | 保持相同触发条件（行首/空格后 + IME-safe） |
| 复用 skills 表可能混淆技能和命令 | 通过 `runtimeConfig.type` 区分，UI 上用不同图标 |
| Chip 占用输入区域空间 | Chip 区域最大高度限制，可滚动 |
