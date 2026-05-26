## ADDED Requirements

### Requirement: 选择后显示 chip 反馈

系统 SHALL 在用户通过 `/` 选择技能或通过 `@` 选择员工后，在输入区域上方显示一个 chip 标签表示选中状态。

#### Scenario: 选择技能后显示 chip

- **WHEN** 用户通过 `/` 菜单选择了一个技能
- **THEN** 输入区域上方显示 chip 标签（如 `⚡ 全网搜索`），`/` 字符从输入框中移除
- **AND** 输入框获得焦点，placeholder 变为 "输入消息内容…"

#### Scenario: 选择员工后显示 chip

- **WHEN** 用户通过 `@` 菜单选择了一个员工
- **THEN** 输入区域上方显示 chip 标签（如 `👤 小雷`），`@` 字符从输入框中移除
- **AND** 输入框获得焦点，placeholder 变为 "和 小雷 对话…"

#### Scenario: 点击 chip 的 × 取消选择

- **WHEN** 用户点击 chip 标签上的 × 按钮
- **THEN** chip 消失，选择状态重置，placeholder 恢复默认

#### Scenario: 发送后 chip 自动清除

- **WHEN** 用户在有 chip 的情况下发送消息
- **THEN** 消息发送后，chip 自动清除，选择状态重置

---

### Requirement: `/` 菜单合并显示自定义技能

系统 SHALL 在 `/` 技能选择弹出菜单中，同时显示内置技能和当前用户创建的自定义技能。

#### Scenario: 显示内置 + 自定义技能

- **WHEN** 用户触发 `/` 技能菜单
- **THEN** 菜单显示内置技能和用户自建的自定义技能，自定义技能标注 `[自定义]` 标签

#### Scenario: 只显示自己创建的

- **WHEN** 其他用户创建了自定义技能
- **THEN** 当前用户看不到其他用户的个人技能（`visibility: "personal"`），但能看到组织共享的
