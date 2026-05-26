## 1. 扩展 `/` 技能菜单数据源（自定义技能）

- [ ] 1.1 修改 `src/app/(dashboard)/home/page.tsx`：在 Server Component 中调用 `getSkillsWithBindCount({ userId: user?.id, mode: "own" })`，过滤出 `type === "custom"` 的技能，将 `customSkills: Array<{id: string; name: string; category: string; description: string; slug?: string}>` 作为新 props 传给 `HomeClient`
- [ ] 1.2 修改 `src/app/(dashboard)/home/home-client.tsx`：接收 `customSkills` props，将其与 `builtinSkills` 合并为完整的 `skillItems` 列表，自定义技能的 `category` 标注 `[自定义]`
- [ ] 1.3 修改 `src/app/(dashboard)/home/home-client.tsx`：技能选择后，区分内置技能（slug）和自定义技能（id），在 `sendMessage` 的 `intentContext` 中正确传递

## 2. 扩展 `/` 和 `@` 到 chat 模式

- [ ] 2.1 修改 `src/app/(dashboard)/home/home-client.tsx`：将 `CommandPopover` 的 `visible` 条件从 `mode === "home" && slashTrigger.visible` 改为 `slashTrigger.visible`（home 和 chat 模式都触发），`@` 同理
- [ ] 2.2 修改 `src/app/(dashboard)/home/home-client.tsx`：textarea 的 `onChange` 中，chat 模式也检测 `/` 和 `@` 触发
- [ ] 2.3 修改 `src/app/(dashboard)/home/home-client.tsx`：textarea 的 `onCompositionStart/End` 中，chat 模式也跟踪 composing 状态
- [ ] 2.4 修改 `src/app/(dashboard)/home/home-client.tsx`：textarea 的 `onKeyDown` 中，chat 模式下弹出菜单可见时阻止 Enter 发送

## 3. Chat 模式下选择状态反馈

- [ ] 3.1 修改 `src/app/(dashboard)/home/home-client.tsx`：新增 `selectedSkill` state，`/` 选择技能后设置 chip 显示，输入区域上方显示已选技能/员工的 chip
- [ ] 3.2 修改 `src/app/(dashboard)/home/home-client.tsx`：chip 可点击取消选择，取消后恢复默认模式

## 4. Chat 模式下发送逻辑

- [ ] 4.1 修改 `src/app/(dashboard)/home/home-client.tsx`：`handleChatSend` 支持 `selectedTargetSlug`，存在时调用 `chat.sendMessage(text, undefined, { skipIntent: true, targetEmployeeSlug: selectedTargetSlug })`
- [ ] 4.2 修改 `src/app/(dashboard)/home/home-client.tsx`：`handleChatSend` 支持 `selectedSkill`，存在时将技能 slug/id 传入 `intentContext`

## 5. 验证

- [ ] 5.1 运行 `npx tsc --noEmit` 确保零类型错误
- [ ] 5.2 运行 `npm run build` 确保生产构建通过
- [ ] 5.3 手动验证：home 模式 `/` 显示内置 + 自定义技能
- [ ] 5.4 手动验证：chat 模式 `/` 和 `@` 弹出菜单正常工作
- [ ] 5.5 手动验证：选择技能/员工后 chip 显示，发送后参数正确传递
