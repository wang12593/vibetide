# VibeTide 实施文档

> 基于设计方案：`docs/permission-isolation-design.md`
> 生成日期：2026-05-14
> 状态：待实施
> 原则：严格按方案实施，每节点全量测试，方向变化及时反馈

---

## 实施纪律

### 代码质量守则

1. **每个节点完成后必须执行全量检查：**
   ```bash
   npx tsc --noEmit          # TypeScript 类型检查
   npm run lint               # ESLint 代码规范检查
   npm run build              # 生产构建
   npm test                   # Vitest 单元测试
   ```
   **四项全部通过才能进入下一节点。**

2. **TypeScript strict 模式零容忍：** 不允许 `any`、不允许 `@ts-ignore`、不允许类型断言绕过。

3. **遵循设计系统规则：** 使用 shadcn/ui 组件（Button/Input/Select/Textarea 等），不手写原生标签。遵循 GlassCard/PageHeader 等共享组件规范。

4. **Server/Client 组件边界：** page.tsx（Server）拉数据，*-client.tsx（Client）做交互。**严禁在 Client 组件中 import DAL 代码。**

5. **所有 UI 文本使用中文。**

6. **不添加任何注释**，除非用户要求。

### 方向变化反馈机制

以下情况必须暂停并向用户反馈，不得自行决策：

- 设计方案与现有代码架构冲突（如 schema 字段已存在、API 路由已占用）
- 实施过程中发现设计方案有遗漏或矛盾
- 需要新增设计文档未覆盖的表/字段/API
- 预计工期偏差超过 50%
- 发现存量数据迁移风险

### 节点验收模板

每个节点完成后输出以下格式的验收报告：

```
## 节点 X.Y 验收报告

### 执行结果
- [ ] tsc --noEmit 通过
- [ ] lint 通过
- [ ] build 通过
- [ ] test 通过

### 新增/修改文件清单
| 文件 | 操作 | 说明 |
|------|------|------|
| ... | 新增/修改 | ... |

### 测试覆盖
- 新增测试 N 个，全部通过
- 存量测试 M 个，全部通过

### 风险/偏差
- 无 / [描述偏差和原因]
```

---

## 实施路线图

按设计方案综合优先级，分 **6 个阶段（Stage）**、**21 个节点（Node）** 执行：

```
Stage 1: 数据基础（P0）
  Node 1.1 → 权限隔离 Schema + Migration
  Node 1.2 → 群聊 Schema + Migration
  Node 1.3 → 数据迁移脚本

Stage 2: 群聊核心引擎（P0）
  Node 2.1 → SSE 事件类型扩展
  Node 2.2 → 消息路由引擎
  Node 2.3 → 群聊调度引擎（串行）
  Node 2.4 → Agent Assembly 适配

Stage 3: 群聊 UI（P0）
  Node 3.1 → 左侧面板三 Tab 改造
  Node 3.2 → 群聊消息面板
  Node 3.3 → 手动建群 UI
  Node 3.4 → 群聊流程可视化

Stage 4: 权限隔离 + 群聊进阶（P1）
  Node 4.1 → 权限隔离 DAL 过滤层
  Node 4.2 → 权限隔离 Server Actions + RBAC
  Node 4.3 → @提及 + 焦点路由
  Node 4.4 → Step Review 群内共享

Stage 5: 权限隔离 UI + SSO（P1-P2）
  Node 5.1 → VisibilityBadge + 筛选组件
  Node 5.2 → 管理页面
  Node 5.3 → SSO Provider 抽象层
  Node 5.4 → SSO Callback 路由 + 登录页

Stage 6: 进阶功能（P2-P3）
  Node 6.1 → 群聊并行执行引擎
  Node 6.2 → 任务自动建群
  Node 6.3 → 导入导出
  Node 6.4 → 结构化争议仲裁（实验性）
```

---

## Stage 1: 数据基础

### Node 1.1 — 权限隔离 Schema + Migration

**目标：** 为 4 张核心表新增 `created_by` + `visibility` 字段

**修改文件：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/db/schema/enums.ts` | 修改 | 新增 `contentVisibilityEnum` |
| `src/db/schema/ai-employees.ts` | 修改 | 新增 `createdBy` + `visibility` |
| `src/db/schema/missions.ts` | 修改 | 新增 `createdBy` + `visibility` |
| `src/db/schema/knowledge-bases.ts` | 修改 | 新增 `createdBy` + `visibility` |
| `src/db/schema/skills.ts` | 修改 | 新增 `createdBy` + `visibility` |

**实施步骤：**

1. 在 `enums.ts` 中新增枚举：
   ```typescript
   export const contentVisibilityEnum = pgEnum("content_visibility", [
     "personal",
     "org",
   ]);
   ```

2. 在 4 张表的 schema 中各新增两个字段：
   ```typescript
   createdBy: uuid("created_by"),
   visibility: contentVisibilityEnum("visibility").default("org"),
   ```

3. 确认 `DEFAULT 'org'` 保证向后兼容（现有数据零行为变化）

4. 执行 `npm run db:generate` 生成迁移文件

5. **全量测试检查点：**
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run build
   npm test
   ```

**验收标准：**
- [ ] 4 张表各新增 `created_by`(uuid, nullable) + `visibility`(enum, default 'org')
- [ ] 迁移文件生成成功
- [ ] tsc / lint / build / test 四项通过
- [ ] 存量功能不受影响（DEFAULT 'org' 兼容）

**风险点：**
- 如果某张表已有 `created_by` 字段（如 workflow_templates），跳过该字段只加 `visibility`
- 枚举名称冲突检查：确认 `content_visibility` 在 PostgreSQL 中不存在

---

### Node 1.2 — 群聊 Schema + Migration

**目标：** 新增 `conversation_participants` 和 `conversation_messages` 两张表，改造 `saved_conversations`

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/db/schema/conversation-participants.ts` | 群聊参与者表 |
| `src/db/schema/conversation-messages.ts` | 独立消息表 |

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/db/schema/saved-conversations.ts` | 新增 `is_group` / `group_mode` / `leader_employee_slug` |
| `src/db/schema/index.ts` | 导出新增的两个 schema |
| `src/db/schema/enums.ts` | 新增群聊相关枚举 |

**实施步骤：**

1. 新增枚举：
   ```typescript
   export const groupModeEnum = pgEnum("group_mode", ["serial", "parallel"]);
   export const participantRoleEnum = pgEnum("participant_role", ["leader", "member"]);
   export const participantTypeEnum = pgEnum("participant_type", ["ai_employee", "human"]);
   export const senderTypeEnum = pgEnum("sender_type", ["human", "ai_employee", "system"]);
   export const messageTypeEnum = pgEnum("message_type", [
     "text", "action", "step_review", "task_result", "system_notice"
   ]);
   ```

2. 新建 `conversation-participants.ts`：
   - `id` (uuid, PK, defaultRandom)
   - `conversationId` (uuid, FK → saved_conversations, CASCADE)
   - `participantType` (participantTypeEnum, NOT NULL)
   - `participantId` (text, NOT NULL) — employeeSlug 或 userId
   - `role` (participantRoleEnum, default 'member')
   - `joinedAt` (timestamp, defaultNow)
   - `organizationId` (uuid, FK → organizations)
   - UNIQUE 约束: (conversation_id, participant_type, participant_id)

3. 新建 `conversation-messages.ts`：
   - `id` (uuid, PK, defaultRandom)
   - `conversationId` (uuid, FK → saved_conversations, CASCADE)
   - `seqNum` (integer, NOT NULL)
   - `role` (text, NOT NULL) — 'user' | 'assistant' | 'system'
   - `content` (text, NOT NULL)
   - `senderType` (senderTypeEnum)
   - `senderId` (text)
   - `messageType` (messageTypeEnum, default 'text')
   - `metadata` (jsonb, default '{}')
   - `parentMessageId` (uuid, nullable)
   - `createdAt` (timestamp, defaultNow)
   - `organizationId` (uuid, FK → organization)
   - UNIQUE 约束: (conversation_id, seq_num)

4. 改造 `saved-conversations.ts`：
   - `employeeSlug` 改为 nullable
   - 新增 `isGroup` (boolean, default false)
   - 新增 `groupMode` (groupModeEnum, default 'serial')
   - 新增 `leaderEmployeeSlug` (text, nullable)

5. 在 `index.ts` 中导出新增 schema

6. 执行 `npm run db:generate`

7. **全量测试检查点**

**验收标准：**
- [ ] 两张新表创建成功，字段/约束/索引完整
- [ ] `saved_conversations` 新增 3 个字段，`employeeSlug` 改为 nullable
- [ ] 迁移文件生成成功
- [ ] tsc / lint / build / test 四项通过
- [ ] 现有单聊功能不受影响（isGroup=false 路径不变）

**风险点：**
- `saved_conversations.employeeSlug` 从 NOT NULL 改为 nullable 需要确认 Drizzle 的 ALTER 语法
- `conversation_messages` 的 `seqNum` 需要应用层保证递增（非数据库自增）

---

### Node 1.3 — 数据迁移脚本

**目标：** 将现有 `saved_conversations.messages` jsonb 展开为 `conversation_messages` 行，并为每条对话创建 `conversation_participants` 记录

**新增文件：**

| 文件 | 说明 |
|------|------|
| `scripts/migrate-conversations.ts` | 一次性迁移脚本 |

**实施步骤：**

1. 查询所有 `saved_conversations` 记录
2. 对每条记录：
   - 将 `messages` jsonb 数组按索引展开为 `conversation_messages` 行（`seqNum` = 数组下标）
   - 根据 `employeeSlug` 创建一条 `conversation_participants` 记录（`participantType = 'ai_employee'`）
   - 根据 `userId` 创建一条 `conversation_participants` 记录（`participantType = 'human'`）
3. 使用事务保证原子性
4. 迁移完成后输出统计（迁移对话数、消息数、参与者数）

**验收标准：**
- [ ] 迁移脚本执行成功
- [ ] 消息数与原始 jsonb 数组长度一致
- [ ] 每条对话有恰好 2 个 participants（1 human + 1 ai_employee）
- [ ] 迁移是**追加式**的（不删除原始 jsonb，不修改原始记录）

---

## Stage 2: 群聊核心引擎

### Node 2.1 — SSE 事件类型扩展

**目标：** 扩展 `chat-utils.ts` 的 SSE 事件类型，支持群聊多参与者

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/chat-utils.ts` | 扩展 SSE 事件类型，新增 `senderId`、`participant_start/end` 等 |
| `src/hooks/use-chat-stream.ts` | 适配新事件类型，按 `senderId` 分拣消息 |

**实施步骤：**

1. 在 `chat-utils.ts` 中扩展 SSE 事件类型：
   - 所有现有事件增加可选 `senderId` 字段
   - 新增 `participant_start` 事件：`{ type, participantId, participantName }`
   - 新增 `participant_end` 事件：`{ type, participantId, summary? }`
   - 新增 `chain_progress` 事件：`{ type, current, total }`

2. 新增 `GroupChatMessage` 接口（扩展 `ChatMessage`）：
   - `senderId: string`
   - `senderType: 'human' | 'ai_employee' | 'system'`
   - `senderName: string`

3. 在 `use-chat-stream.ts` 中：
   - SSE 事件解析逻辑兼容新事件类型
   - `participant_start` 时设置 `activeSpeaker`
   - `participant_end` 时清除 `activeSpeaker`
   - `text-delta` 按 `senderId` 归属到正确的消息

4. **保持向后兼容**：`senderId` 为可选字段，单聊时不需要发送

5. **全量测试检查点**

**验收标准：**
- [ ] SSE 事件类型扩展完成，新增 3 种事件
- [ ] 单聊功能完全不受影响（senderId 为可选）
- [ ] tsc / lint / build / test 四项通过

---

### Node 2.2 — 消息路由引擎

**目标：** 实现三层层级路由（显式@ → 焦点员工 → 穆兰意图分发）

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/chat/group-router.ts` | 消息路由引擎 |
| `src/lib/chat/__tests__/group-router.test.ts` | 路由引擎测试 |

**实施步骤：**

1. 定义 `ChatContext` 类型：
   ```typescript
   type ChatContext = {
     focusEmployeeId: string | null;
     focusReason: 'active_step' | 'recent_interaction' | null;
     focusSetAt: number;
     lastInteractionMap: Record<string, number>;
   };
   ```

2. 实现 6 条路由规则（按优先级）：
   - `routeByMention()` — 解析消息中的 @提及
   - `routeByActiveStep()` — 串行执行中的接力棒规则
   - `routeByIntent()` — 关键词→角色映射
   - `routeByRecentInteraction()` — 最近对话规则（带衰减窗口）
   - `routeByBroadcast()` — "大家/所有人"广播检测
   - `routeFallback()` — 默认接待员（小策/穆兰）

3. 实现 `resolveRoute()` 主函数：依次尝试各规则，返回第一个匹配结果

4. 实现 `updateFocus()` — 更新焦点员工状态
5. 实现 `clearFocus()` — 焦点清除逻辑

6. 编写测试覆盖：
   - @小文 → 返回 xiaowen
   - 串行执行中步骤 2 属于小文 → 返回 xiaowen
   - 消息含"写稿" → 返回 xiaowen
   - 最近 3 条都是小文 → 返回 xiaowen
   - "大家觉得" → 返回 ALL
   - 无任何线索 → 返回默认接待员
   - 焦点衰减：5 条消息后清除

7. **全量测试检查点**

**验收标准：**
- [ ] 6 条路由规则全部实现
- [ ] 焦点员工衰减机制工作正常
- [ ] 测试覆盖率 > 90%
- [ ] tsc / lint / build / test 四项通过

---

### Node 2.3 — 群聊调度引擎（串行）

**目标：** 实现串行接力执行引擎，支持多步骤按序执行、步骤间上下文传递

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/chat/group-dispatcher.ts` | 群聊调度引擎 |
| `src/lib/chat/__tests__/group-dispatcher.test.ts` | 调度引擎测试 |

**实施步骤：**

1. 定义核心接口：
   ```typescript
   interface GroupDispatchPlan {
     conversationId: string;
     triggerMessage: { content: string; senderId: string };
     participants: Array<{ participantId: string; participantType: string; role: string }>;
     mode: 'serial' | 'parallel';
     executionOrder: string[];
   }
   ```

2. 实现 `planExecution()` — 根据 intent 结果生成执行计划
3. 实现 `executeSerial()` — 串行执行生成器：
   - 按 `executionOrder` 依次执行
   - 每步开始发送 `participant_start` 事件
   - 每步执行中发送 `text-delta` 事件（带 `senderId`）
   - 每步结束发送 `participant_end` 事件
   - 发送 `chain_progress` 事件
   - 上一步输出作为下一步上下文

4. 实现 feedback 队列机制：
   - 执行中收到的用户消息标记为 feedback
   - 步骤完成后检查 feedback
   - "停/等一下/暂停"触发 pause

5. 编写测试：
   - 3 步串行执行，验证每步收到前步上下文
   - 中间插入 feedback，验证步骤完成后处理
   - 空执行计划处理
   - 单步执行（退化为普通对话）

6. **全量测试检查点**

**验收标准：**
- [ ] 串行接力执行引擎完成
- [ ] 步骤间上下文传递正确
- [ ] SSE 事件按规范发送
- [ ] feedback 队列机制正常
- [ ] tsc / lint / build / test 四项通过

---

### Node 2.4 — Agent Assembly 适配

**目标：** 为群聊场景提供多员工并行 assembly 能力

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/agent/assembly.ts` | 新增 `assembleGroupContext()` 函数 |

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/agent/__tests__/assembly-group.test.ts` | 群聊 assembly 测试 |

**实施步骤：**

1. 新增 `assembleGroupContext()` 函数：
   - 接收 participants 数组 + 共享对话历史
   - 对每个 ai_employee participant 并行执行 assembly pipeline
   - 返回 `Map<string, AssembledAgent>`
   - 共享对话历史作为每个 agent 的上下文前缀

2. 新增 LRU 缓存（`employeeSlug → AssembledAgent`，TTL 5 分钟）：
   - 避免每次消息都重新加载 skills/knowledgeBases/memories
   - 缓存 key 包含 orgId + employeeSlug

3. 性能优化：`Promise.all` 并发 assembly

4. 编写测试

5. **全量测试检查点**

**验收标准：**
- [ ] `assembleGroupContext()` 正常工作
- [ ] 多员工并行 assembly 不报错
- [ ] LRU 缓存命中/失效逻辑正确
- [ ] tsc / lint / build / test 四项通过

---

## Stage 3: 群聊 UI

### Node 3.1 — 左侧面板三 Tab 改造

**目标：** 将员工列表的双 Tab（员工/收藏）改为三 Tab（员工/群聊/收藏）

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/app/(dashboard)/chat/employee-list-panel.tsx` | 新增「群聊」Tab |
| `src/app/(dashboard)/chat/chat-center-client.tsx` | 状态管理适配群聊 Tab |

**实施步骤：**

1. 新增「群聊」Tab，位于「员工」和「收藏」之间
2. 群聊 Tab 内容：
   - 顶部「+ 发起群聊」按钮（仅群聊 Tab 显示）
   - 群聊列表：按 updatedAt 降序
   - 每条显示：群名 + 成员数 + 最新消息预览 + 时间
3. 点击群聊条目 → 切换到该群聊的对话面板
4. 使用现有 Tabs 组件（`variant="default"`），不手写 Tab 样式

5. **全量测试检查点**

**验收标准：**
- [ ] 三 Tab 切换正常
- [ ] 群聊列表展示正确
- [ ] 一对一聊天功能不受影响
- [ ] tsc / lint / build / test 四项通过

---

### Node 3.2 — 群聊消息面板

**目标：** 群聊模式下右侧聊天面板支持多员工消息展示

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/app/(dashboard)/chat/chat-panel.tsx` | 群聊消息渲染 |
| `src/hooks/use-group-chat.ts` | 新建群聊状态 Hook |

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/hooks/use-chat-participants.ts` | 参与者状态 Hook |

**实施步骤：**

1. 新建 `use-group-chat.ts`：
   ```typescript
   interface GroupChatState {
     participants: Map<string, ParticipantState>;
     activeSpeaker: string | null;
     executionQueue: string[];
     mode: 'serial' | 'parallel';
     phase: 'idle' | 'planning' | 'executing' | 'summarizing';
     focusEmployeeId: string | null;
   }
   ```

2. 新建 `use-chat-participants.ts`：管理参与者列表、加入/离开

3. 改造 `chat-panel.tsx`：
   - 群聊模式：顶部显示群名 + 成员头像横排 + 流程进度条
   - 消息按 `senderId` 分组渲染
   - 每个 AI 员工消息带头像 + 名称 + 角色标签
   - 输入框上方显示焦点员工提示

4. 使用现有 `EmployeeAvatar` 组件显示员工头像

5. **全量测试检查点**

**验收标准：**
- [ ] 群聊消息按 senderId 正确归属
- [ ] 多员工消息视觉区分清晰（头像 + 名称 + 颜色）
- [ ] 焦点员工提示动态更新
- [ ] 单聊面板不受影响
- [ ] tsc / lint / build / test 四项通过

---

### Node 3.3 — 手动建群 UI

**目标：** 实现手动选择员工创建群聊 + 对话中拉人

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/app/(dashboard)/chat/chat-center-client.tsx` | 建群状态管理 |
| `src/app/(dashboard)/chat/chat-panel.tsx` | 邀请加入按钮 |

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/components/shared/employee-selector.tsx` | 员工选择浮层组件 |
| `src/app/actions/group-chat.ts` | 群聊 CRUD Server Actions |

**实施步骤：**

1. 新建 `employee-selector.tsx`：
   - 展示全部 8 个预设员工卡片（头像 + 名称 + 角色）
   - 支持多选（2-6 人）
   - 底部显示已选人数 + 确认按钮
   - 使用 GlassCard 样式

2. 新建 `group-chat.ts` Server Actions：
   - `createGroupChat(params)` — 创建群聊对话 + participants
   - `addParticipant(params)` — 对话中拉人
   - `archiveGroupChat(id)` — 归档群聊

3. 「+ 发起群聊」按钮点击 → 弹出 EmployeeSelector → 确认 → 创建群聊 → 切换到群聊面板

4. 群聊面板顶部头像横排右端 `[+]` → 弹出 EmployeeSelector → 添加成员

5. **全量测试检查点**

**验收标准：**
- [ ] 手动建群：选择 2-6 个员工 → 创建成功 → 切换到群聊面板
- [ ] 对话中拉人：点击 [+] → 选择员工 → 加入群聊
- [ ] 群名自动生成：`{场景名}（{N}人）`
- [ ] tsc / lint / build / test 四项通过

---

### Node 3.4 — 群聊流程可视化

**目标：** 串行进度条 + Step Review 群内卡片

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/app/(dashboard)/chat/chat-panel.tsx` | 集成进度条和 Step Review 卡片 |

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/components/shared/chain-progress.tsx` | 串行流程进度条组件 |
| `src/components/shared/step-review-card.tsx` | Step Review 群内卡片组件 |

**实施步骤：**

1. 新建 `chain-progress.tsx`：
   - 横向进度条：`① 找选题 ✅ → ② 写稿 🔄 → ③ 审核 ⏳`
   - ✅ 已完成（绿色）、🔄 当前（脉冲动画）、⏳ 等待（灰色）
   - 点击某步骤可展开查看产出摘要

2. 新建 `step-review-card.tsx`：
   - 结构化卡片：提交者 + 产出摘要 + 操作按钮
   - 按钮：确认通过 / 修改建议 / 重写
   - 只有被 @的人或任务发起人能操作

3. 集成到 `chat-panel.tsx`：
   - 群名下方显示 ChainProgress
   - 消息流中 Step Review 以卡片形式展示

4. **全量测试检查点**

**验收标准：**
- [ ] 串行进度条正确反映当前执行状态
- [ ] Step Review 卡片在群聊中正确展示
- [ ] 操作按钮权限控制正确
- [ ] tsc / lint / build / test 四项通过

---

## Stage 4: 权限隔离 + 群聊进阶

### Node 4.1 — 权限隔离 DAL 过滤层

**目标：** 所有 DAL 查询函数加入 visibility 过滤

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/dal/visibility-filter.ts` | 统一过滤引擎 |

**修改文件：**

| 文件 | 修改 |
|------|------|
| `src/lib/dal/employees.ts` | getEmployees / getEmployee / getEmployeeFullProfile |
| `src/lib/dal/missions.ts` | getMissions / getMissionById |
| `src/lib/dal/knowledge-bases.ts` | listKnowledgeBaseSummariesByOrg / getKnowledgeBaseById |
| `src/lib/dal/skills.ts` | getSkillsWithBindCount |
| `src/lib/dal/workflow-templates.ts` | listWorkflowTemplatesByOrg |
| `src/lib/agent/assembly.ts` | 跳过 personal KB，employee visibility 检查 |

**实施步骤：**

1. 新建 `visibility-filter.ts`（代码见设计方案第四章 4.1）
2. 逐个改造 DAL 函数，在 WHERE 条件中加入 visibility filter
3. 改造 `assembly.ts`：加载 employee 时检查 visibility，加载 KB 时跳过 personal
4. 编写 DAL 测试：验证 personal 内容对非创建者不可见

5. **全量测试检查点**

**验收标准：**
- [ ] 所有 DAL 查询加入 visibility 过滤
- [ ] personal 内容仅创建者 + admin 可见
- [ ] assembly.ts 跳过 personal KB
- [ ] tsc / lint / build / test 四项通过

---

### Node 4.2 — 权限隔离 Server Actions + RBAC

**目标：** 创建/编辑/删除操作加入权限校验，新增 visibility 升级 Action

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/rbac-constants.ts` | 新增 3 个权限常量 |
| 多个 action 文件 | 创建时填 createdBy + visibility，删除/编辑时校验归属 |

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/app/actions/content-visibility.ts` | 升级可见性 Action |

**实施步骤：**

1. RBAC 新增：`content:view_all` / `content:manage_all` / `content:change_visibility`
2. 所有创建 action 自动填充 `createdBy = userId, visibility = 'personal'`
3. 所有删除/编辑 action 加入归属校验
4. 新增 `upgradeContentVisibility()` — personal → org（不可逆），写入审计日志
5. **全量测试检查点**

**验收标准：**
- [ ] 新建内容默认 visibility = 'personal'
- [ ] 非创建者无法编辑/删除 personal 内容
- [ ] visibility 升级不可逆
- [ ] tsc / lint / build / test 四项通过

---

### Node 4.3 — @提及 + 焦点路由

**目标：** 在群聊输入框中实现 @提及选择和焦点员工路由

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/app/(dashboard)/chat/chat-panel.tsx` | 输入框 @提及浮窗 |
| `src/hooks/use-group-chat.ts` | 焦点员工状态管理 |
| `src/app/api/chat/stream/route.ts` | 集成 group-router |

**实施步骤：**

1. 输入框监听 `@` 字符，弹出员工选择浮窗
2. 选择后插入 `@员工名` 到输入框
3. 发送时解析 @提及，传递给 group-router
4. 焦点员工提示条随路由结果动态更新
5. 集成 group-router 到 stream 路由

6. **全量测试检查点**

**验收标准：**
- [ ] @弹出员工选择浮窗
- [ ] @提及正确路由到指定员工
- [ ] 不 @时按焦点规则路由
- [ ] 焦点提示条动态更新
- [ ] tsc / lint / build / test 四项通过

---

### Node 4.4 — Step Review 群内共享

**目标：** 群聊中的 Step Review 支持多人可见、指定人操作

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/app/api/chat/intent-execute/route.ts` | Step Review 事件携带 senderId + 指定审核人 |
| `src/hooks/use-chat-stream.ts` | 群聊 Step Review 处理 |
| `src/components/shared/step-review-card.tsx` | 权限控制按钮 |

**实施步骤：**

1. Step Review SSE 事件扩展：新增 `reviewerId`（指定审核人）
2. 前端根据当前用户是否为 reviewer 控制按钮显示
3. 非审核人看到"等待 @XX 确认"状态
4. **全量测试检查点**

**验收标准：**
- [ ] Step Review 正确指定审核人
- [ ] 非审核人无法操作按钮
- [ ] tsc / lint / build / test 四项通过

---

## Stage 5: 权限隔离 UI + SSO

### Node 5.1 — VisibilityBadge + 筛选组件

**目标：** 列表页标注可见性 Badge，支持筛选

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/components/shared/visibility-badge.tsx` | 可见性 Badge 组件 |

**修改文件：**

| 文件 | 说明 |
|------|------|
| 知识库/工作流/技能/任务列表页 client | 加筛选 Toggle + Badge |

**实施步骤：**

1. 新建 `visibility-badge.tsx`：🔒 个人（琥珀色）/ 🌐 组织（蓝色）
2. 各列表页顶部加筛选 Toggle：`[全部 | 仅我的 | 组织共享]`
3. 各卡片/行项目加 Badge 标注
4. **全量测试检查点**

---

### Node 5.2 — 管理页面

**目标：** Admin 内容管理页，支持查看/筛选/批量操作所有用户内容

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/app/(dashboard)/admin/content-management/page.tsx` | Server 页面 |
| `src/app/(dashboard)/admin/content-management/content-client.tsx` | Client 组件 |

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/components/layout/app-sidebar.tsx` | ADMIN_ITEMS 新增入口 |

**实施步骤：**

1. Server 页面：requirePermission(CONTENT_VIEW_ALL)，加载所有用户内容
2. Client 组件：DataTable 展示，支持按类型/可见性/创建者筛选
3. 批量操作：升级为组织级 / 导出 / 删除
4. 侧边栏加入口
5. **全量测试检查点**

---

### Node 5.3 — SSO Provider 抽象层

**目标：** 实现统一 SSO Provider 接口

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/sso/providers/base.ts` | SsoProvider 接口定义 |
| `src/lib/sso/providers/wechat-work.ts` | 企业微信 Provider |
| `src/lib/sso/providers/feishu.ts` | 飞书 Provider |
| `src/lib/sso/providers/dingtalk.ts` | 钉钉 Provider |
| `src/db/schema/sso-connections.ts` | SSO 连接表 |
| `src/lib/sso/__tests__/providers.test.ts` | Provider 测试 |

**实施步骤：**

1. 定义 `SsoProvider` / `SsoTokenResult` / `SsoUserInfo` 接口
2. 实现三个 Provider（OAuth URL 生成 + Token 交换 + UserInfo 获取）
3. 新建 `sso_connections` 表
4. 编写测试：OAuth URL 格式、Token 交换（mock HTTP）、UserInfo 解析
5. **全量测试检查点**

---

### Node 5.4 — SSO Callback 路由 + 登录页

**目标：** 实现 SSO 登录流程

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/app/api/auth/sso/[provider]/route.ts` | SSO 发起 + 回调路由 |

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/app/(auth)/login/page.tsx` | 新增 SSO 登录按钮 |
| `src/db/schema/index.ts` | 导出 sso_connections |

**实施步骤：**

1. GET `/api/auth/sso/[provider]` → 生成 state → 302 重定向到 OAuth URL
2. GET `/api/auth/sso/[provider]/callback` → 验证 state → 换 token → 获取用户信息 → 创建/关联 Supabase 用户 → 设置 session → 302 /home
3. 登录页新增 SSO 按钮（企业微信/飞书/钉钉图标）
4. Email/Password 登录保留不动
5. **全量测试检查点**

**验收标准：**
- [ ] SSO 登录入口出现在登录页
- [ ] OAuth 流程完整跑通（至少一个 Provider）
- [ ] SSO 登录后自动创建/关联用户
- [ ] Email/Password 登录不受影响
- [ ] 下游 requireAuth() 无需修改
- [ ] tsc / lint / build / test 四项通过

---

## Stage 6: 进阶功能

### Node 6.1 — 群聊并行执行引擎

**目标：** 实现并行执行模式

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/chat/group-dispatcher.ts` | 新增 `executeParallel()` |
| `src/components/shared/chain-progress.tsx` | 并行轨道可视化 |

**实施步骤：**

1. `executeParallel()`：`Promise.allSettled()` 并发执行
2. 结果合并：leader 员工汇总所有并行结果
3. 并行轨道可视化：横向分支图
4. **全量测试检查点**

---

### Node 6.2 — 任务自动建群

**目标：** Mission 创建时根据场景自动组建群聊

**修改文件：**

| 文件 | 说明 |
|------|------|
| Mission executor | 创建时关联群聊 |
| `src/lib/dal/workflow-templates.ts` | 场景模板扩展 defaultTeam |

**实施步骤：**

1. 场景模板新增 `defaultTeam` 字段（员工列表）
2. Mission 创建时自动创建群聊 + participants
3. 群聊与 Mission 关联（metadata 中存 missionId）
4. **全量测试检查点**

---

### Node 6.3 — 导入导出

**目标：** 个人内容导出 JSON + 导入含安全校验

**新增文件：**

| 文件 | 说明 |
|------|------|
| `src/app/actions/content-export.ts` | 导出 Action |
| `src/app/actions/content-import.ts` | 导入 Action |

**实施步骤：**

1. 导出：查询所有 createdBy = userId 的内容 → 打包 JSON → 返回下载
2. 导入：解析 JSON → schema 验证 → 白名单过滤 → 逐条 insert
3. 安全校验：版本号、长度限制、数量限制
4. **全量测试检查点**

---

### Node 6.4 — 结构化争议仲裁（实验性）

**目标：** 工作流步骤冲突时自动触发受限讨论

**修改文件：**

| 文件 | 说明 |
|------|------|
| `src/lib/chat/group-dispatcher.ts` | 新增冲突检测 + 仲裁步骤 |

**实施步骤：**

1. 冲突检测：步骤输出与后续步骤约束矛盾时触发
2. 仲裁执行：限定参与者、最多 3 轮、输出结构化结论
3. 仲裁结果卡片 UI
4. **全量测试检查点**

---

## 测试策略总览

### 测试层级

| 层级 | 工具 | 覆盖范围 |
|------|------|---------|
| 单元测试 | Vitest | DAL 过滤、路由引擎、调度引擎、SSO Provider |
| 类型检查 | tsc --noEmit | 全量 TypeScript 严格模式 |
| 代码规范 | ESLint | 设计系统一致性 + 代码规范 |
| 构建验证 | npm run build | 生产构建零错误 |
| 手动验证 | 浏览器 | UI 交互、群聊流程、SSO 登录 |

### 每节点必执行

```bash
npx tsc --noEmit && npm run lint && npm run build && npm test
```

四项全部通过 = 节点完成。

### 关键测试场景

| 场景 | 验证点 |
|------|--------|
| 权限隔离 | personal 内容对非创建者不可见 |
| 群聊串行 | 3 步执行，上下文正确传递 |
| 消息路由 | 6 条规则按优先级命中 |
| @提及 | 消息正确路由到指定员工 |
| Step Review | 群内卡片权限控制 |
| SSO 流程 | OAuth 回调创建/关联用户 |
| 数据迁移 | 消息数与 jsonb 一致 |

---

## 方向变化反馈模板

```
## ⚠️ 方向变化反馈

### 触发节点
Node X.X — ...

### 变化描述
[描述与设计方案的偏差]

### 影响范围
[影响哪些文件/功能]

### 建议方案
[建议的调整方向]

### 需要用户确认
[ ] 同意调整
[ ] 需要讨论
[ ] 回退
```
