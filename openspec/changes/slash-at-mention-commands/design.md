## Context

### 当前聊天输入机制

项目中有 3 个聊天输入区域：
1. **首页嵌入式面板**（`home-client.tsx`）— textarea + `use-chat-stream` Hook
2. **聊天中心主面板**（`chat-panel.tsx`）— textarea，支持群聊/单聊切换
3. **文章 AI 助手**（`chat-input.tsx`）— 轻量 textarea

所有输入框都是纯文本，没有 `/` 命令或 `@` 提及功能。

### 已有组件

- `EmployeeInputBar`（`src/components/shared/employee-input-bar.tsx`）：`@` 触发的员工选择下拉，支持键盘导航和模糊搜索，用于任务控制台
- `MentionPopover`（`src/components/shared/mention-popover.tsx`）：通用员工提及弹出层，接收 `employees` props
- `getBuiltinSkillSlugToName()`（`src/lib/skill-loader.ts`）：返回所有内置技能 slug→名称映射
- `EMPLOYEE_META`（`src/lib/constants.ts`）：10 个员工的静态元数据

### 约束

- 不能破坏现有中文输入法（IME composing 状态下 `/` 和 `@` 不应触发弹出）
- 群聊中的 `@` 只显示群内成员，不是全部员工
- `/` 命令只在首页聊天中使用（群聊中不需要）
- 不需要数据库 schema 变更
- 不需要新的 API 路由

## Goals / Non-Goals

**Goals:**
- 首页输入框支持 `/` 弹出技能选择，选择后注入技能到意图上下文
- 首页输入框支持 `@` 弹出员工选择，选择后直接与指定员工对话
- 群聊输入框支持 `@` 弹出群内成员选择，选择后路由到指定员工
- 统一的弹出菜单组件，支持模糊搜索和键盘导航

**Non-Goals:**
- 不实现自定义命令注册系统（只支持技能列表）
- 不修改群聊的路由逻辑（`@` 提及路由已有实现）
- 不实现 `/` 命令的嵌套参数（如 `/search query`）
- 不修改文章 AI 助手的输入框（场景不同）

## Decisions

### D1. 触发检测：IME-safe 字符监听

**决策**：在 `onChange` 中检测输入文本的 `/` 或 `@` 字符（而非 `onKeyDown`），通过 `isComposing` 状态和 `compositionEnd` 事件过滤 IME 输入。

**理由**：中文输入法（拼音）在 composing 状态下按 `/` 键是合法的拼音分隔符。如果用 `onKeyDown` 监听，会在 composing 中误触发。`onChange` + `isComposing` 检测更可靠。

**替代方案**：`onKeyDown` 直接监听 → 简单但无法区分 IME。

### D2. 弹出组件：扩展现有 MentionPopover 模式

**决策**：创建通用的 `CommandPopover` 组件（接受 `items`、`onSelect`、`visible` props），分别用于 `/` 技能选择和 `@` 员工选择。

**理由**：已有 `MentionPopover` 和 `EmployeeInputBar` 的模式可以复用。创建一个更通用的 `CommandPopover` 比分别扩展两个组件更干净。

**替代方案**：直接复用 `MentionPopover` → 它只支持员工，不支持技能分类图标。

### D3. 技能选择后的处理方式

**决策**：选择技能后，将技能 slug 作为 `intentContext.skills` 传递给 `sendMessage`，跳过意图识别直接执行。

**理由**：用户明确选择了技能，不需要再走意图识别流程。已有的 `sendMessage` 的 `skipIntent + intentContext` 参数可以满足。

**替代方案**：将技能名插入文本 → 仍然需要意图识别，增加了不必要的步骤。

### D4. 群聊 @提及后的处理

**决策**：选择员工后，将 `@昵称` 文本插入输入框，发送时由后端 `routeByMention` 解析。

**理由**：群聊的路由逻辑已支持 `@mention` 解析（`group-router.ts` 的 `routeByMention` 函数），只需要在消息文本中包含 `@slug` 即可。

### D5. 技能数据获取：Server Component 预加载

**决策**：在首页 Server Component 中调用 `getBuiltinSkillSlugToName()`，将技能列表作为 props 传给 Client Component。

**理由**：`skill-loader.ts` 使用文件系统读取，只能在服务端运行。不需要 API 路由。`EMPLOYEE_META` 是前端常量，直接导入即可。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| IME composing 误触发 | 使用 `compositionStart/End` 事件 + `onChange` 检测，而非 `onKeyDown` |
| 弹出菜单遮挡聊天内容 | 弹出层定位在输入框上方（`bottom-full`），最大高度 240px 可滚动 |
| `/` 和 `@` 在非行首触发 | 只在光标前一个字符是空格或光标在行首时触发 |
| 技能列表过长 | 按分类分组显示，支持模糊搜索过滤 |
| 回归影响现有输入框 | 触发条件严格：空输入+`/` 或 空输入/空格+`@`，不影响正常打字 |
