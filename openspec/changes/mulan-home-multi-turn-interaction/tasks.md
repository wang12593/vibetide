## 1. 类型扩展 (types.ts)

- [x] 1.1 在 `IntentResult` 接口中新增 `clarificationHistory` 字段：`clarificationHistory?: Array<{ question: string; answer: string }>`
- [x] 1.2 新增 `MultiTurnState` 类型定义（用于前端状态管理）：`{ active: boolean; round: number; history: Array<{ question: string; answer: string }> }`
- [x] 1.3 更新 `needsClarification` 函数逻辑，标记 `clarificationHistory` 已有的情况下不再走旧表单分支

## 2. AI Prompt & API Route 修改

- [x] 2.1 修改 `intent-recognition.ts` prompt：新增多轮追问模式指令，指示 AI 只生成 1 个 `ClarificationQuestion`
- [x] 2.2 在 prompt 中加入 `clarificationHistory` 上下文：要求 AI 基于历史答案做判断，不重复已问过的问题
- [x] 2.3 修改 `/api/chat/intent` route 接收 `clarificationHistory` 请求参数，传递给 `recognizeIntent`

## 3. 新增 MultiTurnClarifyBubble 组件 (intent-bubble.tsx)

- [x] 3.1 新增 `MultiTurnClarifyBubble` 组件，支持选项按钮 + 自定义输入 + 跳过按钮 + 轮次计数
- [x] 3.2 导出 `MultiTurnClarifyBubble` 供 `embedded-chat-panel.tsx` 导入

## 4. 修改 use-chat-stream.ts - 多轮状态管理

- [x] 4.1 新增 `multiTurnState` 状态变量 + `skipClarifyRef` ref + `MAX_CLARIFY_ROUNDS` 常量
- [x] 4.2 修改 `sendMessage`：新消息时重置 `multiTurnState`
- [x] 4.3 新增 `handleMultiTurnClarify`：将回答作为用户消息发送 + 重新调用 `/api/chat/intent` + 判断下一轮还是推荐
- [x] 4.4 新增 `skipMultiTurnClarify`：跳过追问，直接进入推荐阶段
- [x] 4.5 导出 `multiTurnState` / `handleMultiTurnClarify` / `skipMultiTurnClarify` / `MAX_CLARIFY_ROUNDS`

## 5. 修改 embedded-chat-panel.tsx

- [x] 5.1 在 intent 渲染区域增加 `MultiTurnClarifyBubble` 渲染分支（`multiTurnState.active + needsClarification`）
- [x] 5.2 移除对 `ClarificationForm` 的导入引用（home-client.tsx 中已删除）

## 6. 清理废弃代码

- [x] 6.1 `clarification-form.tsx` 添加 `@deprecated` 注释
- [x] 6.2 移除 `home-client.tsx` 中 `ClarificationForm` 的导入
- [x] 6.3 `intent-bubble.tsx` 中 `ClarificationCard` 标记为 `@deprecated`

## 7. Feature Flag 支持（延后）

- [ ] 7.1 在 `.env.example` 中添加 `VIBETIDE_MULTI_TURN_CLARIFY_ENABLED` 环境变量（默认 `true`）
- [ ] 7.2 在 `use-chat-stream.ts` 中新增 `isMultiTurnEnabled` 守卫
- [ ] 7.3 验证 feature flag `false` 时回退到 `ClarificationCard` 单次表单逻辑

## 8. 类型检查与构建验证

- [x] 8.1 运行 `npx tsc --noEmit` — 零错误通过
- [x] 8.2 运行 `npm run build` — 生产构建通过