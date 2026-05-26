## Why

当前聊天输入框是纯文本输入，用户无法在输入过程中快速指定要调用的技能或员工。用户必须等待意图识别结果，再被动接受系统推荐的步骤和员工。这导致交互链路长、缺乏主动控制感。通过引入 `/` 技能选择和 `@` 员工提及的快捷输入方式，用户可以在输入消息时主动指定技能和目标员工，缩短交互路径、提升操作效率。

## What Changes

- 在 `/home` 首页嵌入式聊天面板的输入框中，输入 `/` 时弹出技能选择下拉菜单（显示内置技能列表），选择后将技能 slug 注入意图上下文
- 在 `/home` 首页嵌入式聊天面板的输入框中，输入 `@` 时弹出员工选择下拉菜单（显示全部数字员工），选择后跳过意图识别直接与指定员工对话
- 在群聊输入框中，输入 `@` 时弹出群内成员选择下拉菜单（只显示当前群聊中的 AI 员工），选择后将 `@slug` 注入消息文本用于路由
- 新增 `SlashCommandPopover` 组件：统一的 `/` 命令弹出选择器，支持模糊搜索、键盘导航
- 复用已有的 `MentionPopover` / `EmployeeInputBar` 组件模式扩展 `@` 提及功能
- `use-chat-stream.ts` 的 `sendMessage` 需要识别消息中的 `/skill` 和 `@employee` 标记，传递给后端

## Capabilities

### New Capabilities
- `slash-skill-selector`: `/` 触发的技能选择弹出菜单，在首页聊天输入框中使用
- `at-mention-selector`: `@` 触发的员工提及弹出菜单，首页显示全部员工、群聊只显示群内成员

### Modified Capabilities

## Impact

- **UI 组件**: 新增 `SlashCommandPopover` 组件；修改首页输入框区域（`home-client.tsx`）和群聊输入框区域（`chat-panel.tsx`）添加 `/` 和 `@` 触发逻辑
- **Hook**: `use-chat-stream.ts` 的 `sendMessage` 需解析 `/skill` 和 `@employee` 标记
- **后端**: `/api/chat/stream` 需处理带技能覆盖和员工指定的请求参数
- **数据**: 技能列表来自 `skill-loader.ts` 的 `getAllBuiltinSkills()`；员工列表来自 `EMPLOYEE_META` 常量和群聊参与者数据
- **回滚方案**: 所有修改向后兼容，不影响现有输入框行为。`/` 和 `@` 只在输入框为空或光标在行首时触发，不影响正常文本输入。如需回滚，移除触发检测逻辑即可恢复纯文本输入
