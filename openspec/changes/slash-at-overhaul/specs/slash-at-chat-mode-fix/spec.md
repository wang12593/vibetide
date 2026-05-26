## MODIFIED Requirements

### Requirement: Chat 模式下 `/` 和 `@` 弹出菜单可触发

系统 SHALL 在首页聊天输入框的 home 和 chat 两种模式下，都支持 `/` 和 `@` 触发弹出菜单。

#### Scenario: Chat 模式输入 `/`

- **WHEN** 用户已与穆兰开始对话（chat 模式），在输入框中输入 `/`
- **THEN** 系统显示技能选择弹出菜单，内容与 home 模式相同

#### Scenario: Chat 模式输入 `@`

- **WHEN** 用户已与穆兰开始对话（chat 模式），在输入框中输入 `@`
- **THEN** 系统显示员工选择弹出菜单

#### Scenario: Chat 模式弹出菜单中键盘操作

- **WHEN** 弹出菜单可见时用户按 Enter
- **THEN** 选中当前高亮项而非触发消息发送

#### Scenario: Chat 模式弹出菜单中 Escape

- **WHEN** 弹出菜单可见时用户按 Escape
- **THEN** 关闭弹出菜单，不触发其他操作
