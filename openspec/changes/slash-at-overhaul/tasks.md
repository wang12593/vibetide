## 1. Bug Fix: Chat 模式 `/` 和 `@` 可用

- [x] 1.1 修改 `home-client.tsx`：`CommandPopover` 的 `visible` 从 `mode === "home" && ...` 改为直接使用 `slashTrigger.visible`（`@` 同理）
- [x] 1.2 修改 `home-client.tsx`：textarea `onChange` 中 chat 模式也调用 `slashTrigger.handleChange` 和 `atTrigger.handleChange`
- [x] 1.3 修改 `home-client.tsx`：textarea `onKeyDown` 统一检查弹出菜单状态，不再区分 home/chat 模式
- [x] 1.4 修改 `home-client.tsx`：textarea `onCompositionStart/End` 已统一（无需改动，之前就是统一的）

## 2. Feature: 选择后 chip 反馈

- [x] 2.1 新增 `selectedSkill` state 和 `clearSelections` 辅助函数
- [x] 2.2 `/` 技能 `onSelect`：设置 `selectedSkill`，清除输入框中的 `/搜索文本`，聚焦输入框
- [x] 2.3 `@` 员工 `onSelect`：设置 `selectedTargetSlug`，清除输入框中的 `@搜索文本`，聚焦输入框
- [x] 2.4 在 textarea 上方添加选中状态 chips（紫色技能 chip + 蓝色员工 chip），包含 × 关闭按钮
- [x] 2.5 `handleSubmit` 和 `handleChatSend` 发送后调用 `clearSelections()` 自动清除

## 3. Feature: 合并自定义技能到 `/` 菜单

- [x] 3.1 修改 `page.tsx`：调用 `getSkillsWithBindCount({ mode: "own" })` 获取自定义技能，传给 `HomeClient` 作为 `customSkills` props
- [x] 3.2 修改 `home-client.tsx`：`skillItems` 合并 `builtinSkills` + `customSkills`，自定义技能标注 `[自定义]`

## 4. Feature: 自定义 `/` 命令

- [x] 4.1 `skillItems` 中自定义技能如果有 `content`（指令模板），description 标注 "· 指令模板"
- [x] 4.2 `handleChatSend` 和 `pendingSend` effect 中，如果 `selectedSkill.isCustom` 且有 `content`，拼接模板 + 用户消息后发送

## 5. 验证

- [x] 5.1 运行 `npx tsc --noEmit` 确保零类型错误
- [x] 5.2 运行 `npm run build` 确保生产构建通过
- [ ] 5.3 手动验证：home 模式 `/` 选择技能 → chip 显示 → 发送 → chip 清除
- [ ] 5.4 手动验证：home 模式 `@` 选择员工 → chip 显示 → 发送 → chip 清除
- [ ] 5.5 手动验证：chat 模式 `/` 和 `@` 弹出菜单正常工作
- [ ] 5.6 手动验证：chat 模式选择技能/员工后发送正确
