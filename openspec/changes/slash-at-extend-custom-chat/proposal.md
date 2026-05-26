## Why

当前 `/` 技能选择和 `@` 员工选择功能（`slash-at-mention-commands` 变更已实现）有两个限制：

1. **只支持内置技能**：`/` 菜单只显示文件系统中的内置技能（`getAllBuiltinSkills()`），不包含用户在 `/skills` 页面创建的自定义技能。用户无法通过 `/` 快速调用自己创建的技能。
2. **只在首页初始输入时可用**：`/` 和 `@` 弹出菜单只在 `mode === "home"` 时激活，当用户和穆兰开始对话后（`mode === "chat"`），输入框切换到 `chatInput` 绑定，弹出菜单不再响应。

本变更扩展 `/` 和 `@` 功能，使其支持自定义技能并在对话模式下也可使用。

## What Changes

- `/` 技能菜单合并显示**内置技能 + 用户创建的自定义技能**，自定义技能标记来源标签（"自定义"）
- `/` 和 `@` 弹出菜单在 `mode === "chat"` 对话模式下也可触发，复用相同的 `CommandPopover` 和 `useCommandTrigger`
- `mode === "chat"` 时 `/` 选择技能后，通过 `chat.sendMessage` 的 `intentContext` 传递技能参数
- `mode === "chat"` 时 `@` 选择员工后，设置 `targetEmployeeSlug` 并跳过意图识别
- 自定义技能数据从数据库 `skills` 表获取（`getSkillsWithBindCount({ mode: "own" })`），与内置技能合并去重

## Capabilities

### Modified Capabilities
- `slash-skill-selector`: 扩展数据源为内置技能 + 自定义技能，扩展触发范围为 home + chat 模式
- `at-mention-selector`: 扩展触发范围为 home + chat 模式

## Impact

- **UI 组件**: 修改 `home-client.tsx` 中的 `CommandPopover` 触发条件，从 `mode === "home"` 改为 `mode === "home" || mode === "chat"`
- **数据**: `page.tsx` 需额外获取用户创建的自定义技能列表（`getSkillsWithBindCount({ userId, mode: "own" })`），传给 `HomeClient`
- **Hook**: `useCommandTrigger` 无需修改，`handleSubmit` / `handleChatSend` 需支持 `selectedTargetSlug`
- **回滚方案**: 仅修改触发条件和数据源，向后兼容
