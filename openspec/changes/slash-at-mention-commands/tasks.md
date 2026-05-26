## 1. 通用弹出菜单组件

- [x] 1.1 新增 `src/components/shared/command-popover.tsx`：通用 `CommandPopover` 组件，接受 `items`、`visible`、`onSelect`、`onClose`、`filterText` props，支持模糊搜索过滤、上下键导航、Enter 选择、Escape 关闭，定位在输入框上方，最大高度 240px 可滚动
- [x] 1.2 新增 `src/hooks/use-command-trigger.ts`：通用 Hook，接受 `{ triggerChar }`，在 textarea 的 `onChange` 中检测触发字符，考虑 IME composing 状态，返回 `{ visible, filterText, handleChange, handleSelect, resetTrigger }`

## 2. 首页 `/` 技能选择

- [x] 2.1 修改 `src/app/(dashboard)/home/page.tsx`：调用 `getAllBuiltinSkills()` 获取技能列表，将 `builtinSkills` 作为 props 传给 `HomeClient`
- [x] 2.2 修改 `src/app/(dashboard)/home/home-client.tsx`：接收 `builtinSkills` props，集成 `useCommandTrigger({ triggerChar: "/" })` 和 `CommandPopover`
- [x] 2.3 修改 `src/app/(dashboard)/home/home-client.tsx`：技能选择后清除输入框，placeholder 提示使用 `/` 和 `@`

## 3. 首页 `@` 员工选择

- [x] 3.1 修改 `src/app/(dashboard)/home/home-client.tsx`：集成 `useCommandTrigger({ triggerChar: "@" })` 和 `CommandPopover`，显示全部数字员工列表（来自 `EMPLOYEE_META`）
- [x] 3.2 修改 `src/app/(dashboard)/home/home-client.tsx`：员工选择后设置 `selectedTargetSlug`，发送消息时使用 `{ skipIntent: true, targetEmployeeSlug }` 参数

## 4. 群聊 `@` 员工提及

- [x] 4.1 修改 `src/app/(dashboard)/chat/chat-panel.tsx`：群聊模式集成 `useCommandTrigger({ triggerChar: "@" })` 和 `CommandPopover`，从 `viewingSaved.metadata.employeeSlugs` 获取群内成员
- [x] 4.2 修改 `src/app/(dashboard)/chat/chat-panel.tsx`：选择员工后插入 `@员工昵称` 文本，后端 `routeByMention` 自动解析

## 5. 验证

- [x] 5.1 运行 `npx tsc --noEmit` 确保零类型错误
- [x] 5.2 运行 `npm run build` 确保生产构建通过
- [ ] 5.3 手动验证：首页输入 `/` → 技能菜单弹出 → 选择技能 → 发送消息 → 确认使用指定技能执行
- [ ] 5.4 手动验证：首页输入 `@` → 员工菜单弹出 → 选择员工 → 发送消息 → 确认直接与指定员工对话
- [ ] 5.5 手动验证：群聊中输入 `@` → 只显示群内成员 → 选择并发送 → 确认路由到指定员工
