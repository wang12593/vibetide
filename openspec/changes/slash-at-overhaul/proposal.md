## Why

当前 `/` 技能选择和 `@` 员工提及功能存在多个严重的交互缺陷：

1. **选择后无反馈直接消失**：用户通过 `/` 选择技能后，弹出菜单关闭、输入框被清空，但没有留下任何选中状态的视觉反馈（如 chip 标签），用户不知道自己选了什么，也不知道接下来该做什么
2. **Chat 模式完全不可用**：`CommandPopover` 的 `visible` 条件硬编码了 `mode === "home"`，导致用户和穆兰开始对话后，`/` 和 `@` 功能完全失效
3. **Chat 模式键盘冲突**：`onKeyDown` 在 chat 模式使用 `handleChatKeyDown`，不检查弹出菜单是否可见，导致弹出菜单时按 Enter 直接触发发送而非选择
4. **不支持自定义命令**：用户无法封装自己的常用指令为 `/` 命令，只能使用系统内置技能
5. **交互体验不够直觉**：应参考 Trae IDE 等工具的 autocompletion 体验，选择后在输入区域上方显示 chip，可取消

## What Changes

### Bug Fixes
- 修复 `CommandPopover` 在 chat 模式下不触发的问题（移除 `mode === "home"` 限制）
- 修复 chat 模式 `onKeyDown` 不拦截弹出菜单 Enter/Escape 的问题
- 修复选择技能/员工后无视觉反馈的问题

### Enhancements
- 选择技能/员工后，在输入区域上方显示 chip 标签（如 `⚡ 全网搜索` 或 `👤 小雷`），点击 × 可取消
- 合并内置技能 + 用户自建的自定义技能到 `/` 菜单，自定义技能标注 `[自定义]`
- 支持用户创建自定义 slash 命令：封装常用指令为 `/命令名 指令模板`，存储到数据库
- 自定义命令数据来源：`getSkillsWithBindCount({ mode: "own" })` 过滤 `type === "custom"`

## Capabilities

### New Capabilities
- `custom-slash-commands`: 用户可创建自定义 `/` 命令（封装指令模板），在 `/` 菜单中显示和调用

### Modified Capabilities
- `slash-skill-selector`: 扩展到 chat 模式 + 合并自定义技能 + chip 反馈
- `at-mention-selector`: 扩展到 chat 模式 + chip 反馈

## Impact

- **UI**: `home-client.tsx` 的输入区域增加 chip 显示区；`CommandPopover` visible 条件修改
- **数据**: `page.tsx` 额外获取自定义技能列表；新建 `custom_commands` 表（或复用 `skills` 表）
- **Hook**: `useCommandTrigger` 无需修改；`handleSubmit` / `handleChatSend` 支持 chip 状态
- **回滚方案**: 所有修改向后兼容，chip 不显示时等同于当前行为
