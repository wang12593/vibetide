# VibeTide 实施方案 V2（基于 permission-isolation-design.md）

> 生成日期：2026-05-14
> 基于设计文档：`docs/permission-isolation-design.md`
> 上一轮实施进度：Schema + 核心模块已完成，集成层和 UI 层存在 15 项差距
> 目标：补齐所有差距，实现设计方案完整交付

---

## 一、现状评估

### 已完成的基础设施

| 模块 | 状态 | 说明 |
|------|------|------|
| Schema 变更（8 枚举 + 6 表 + 10 字段） | ✅ 完成 | `content_visibility` enum + 4 表 `createdBy`/`visibility` + 群聊 3 表 + SSO 表 |
| `visibility-filter.ts` | ✅ 完成 | `buildVisibilityCondition` + `buildEmployeeVisibilityCondition` |
| `group-router.ts` 消息路由引擎 | ✅ 完成 | 6 条路由规则 + 焦点衰减 + 22 测试 |
| `group-dispatcher.ts` 调度引擎 | ✅ 完成 | 串行 + 并行 + 仲裁 + 16 测试 |
| `assembleGroupContext()` | ✅ 完成 | LRU 缓存 + 并发 assembly |
| RBAC 常量 | ✅ 完成 | `CONTENT_VIEW_ALL` + `CONTENT_CHANGE_VISIBILITY` |
| `upgradeContentVisibility()` | ✅ 完成 | personal → org + 审计日志 |
| `content-export.ts` / `content-import.ts` | ✅ 完成 | 导出/导入 + 安全校验 |
| SSO Provider 接口 + 3 个实现 | ✅ 完成 | 企业微信/飞书/钉钉 |
| 群聊 UI 组件库 | ✅ 完成 | ChainProgress / ParallelProgress / ArbitrationCard / StepReviewCard / MentionPopover / EmployeeSelector / VisibilityBadge / VisibilityFilter |
| 群聊 Server Actions | ✅ 完成 | createGroupChat / addGroupParticipant / archiveGroupChat / createMissionGroupChat |
| 群聊 Hooks | ✅ 完成 | use-group-chat / use-chat-participants |
| 左侧面板三 Tab | ✅ 完成 | 员工/群聊/收藏 + 建群弹窗 |
| SSO 登录页按钮 | ✅ 完成 | 飞书/钉钉/企业微信 + 分割线 |
| 管理页面 | ✅ 完成 | /admin/content-management |
| 侧边栏入口 | ✅ 完成 | "内容管理" 已加入 ADMIN_ITEMS |

### 15 项待补齐差距

| # | 类别 | 差距 | 优先级 |
|---|------|------|--------|
| G1 | 权限隔离 | `getMissions()` / `getMissionById()` 无 visibility 过滤 | P1 |
| G2 | 权限隔离 | `getSkillsWithBindCount()` 无 visibility 过滤 | P1 |
| G3 | 权限隔离 | 8 个创建 action 未自动填充 `createdBy` + `visibility: "personal"` | P1 |
| G4 | 权限隔离 | 6 个删除/编辑 action 无归属校验 | P1 |
| G5 | 权限隔离 | `assembly.ts` 未跳过 personal KB | P1 |
| G6 | 权限隔离 | 管理员查看个人内容未写审计日志 | P3 |
| G7 | 群聊集成 | `stream/route.ts` 未集成 group-router/dispatcher | P0 |
| G8 | 群聊集成 | `use-chat-stream.ts` 未处理群聊 SSE 事件 | P0 |
| G9 | 群聊集成 | `chat-panel.tsx` 缺少群聊可视化组件 | P0 |
| G10 | 群聊集成 | 群聊消息未按 senderId 分组渲染 | P0 |
| G11 | 群聊集成 | 缺少 @提及输入集成和焦点员工提示条 | P1 |
| G12 | SSO | OAuth 完整流程未实现 | P1 |
| G13 | UI 集成 | 5 个列表页未集成 VisibilityBadge | P2 |
| G14 | UI 集成 | 5 个列表页未集成 VisibilityFilter | P2 |
| G15 | 数据库 | Schema 变更未推送到 Supabase | P0 |

---

## 二、实施路线图

### 分 4 个阶段、15 个任务节点执行

```
Stage A: 权限隔离集成层（G1-G5, G13-G14）— 5 个节点
Stage B: 群聊 SSE 集成（G7-G11）— 4 个节点
Stage C: SSO 完整流程（G12）— 1 个节点
Stage D: 数据库迁移 + 收尾（G6, G15）— 2 个节点
```

---

## Stage A: 权限隔离集成层

### Node A.1 — Missions DAL visibility 过滤

**目标：** `getMissions()` 和 `getMissionById()` 加入 visibility 过滤

**修改文件：**

| 文件 | 修改内容 |
|------|---------|
| `src/lib/dal/missions.ts` | `getMissions(orgId, opts?)` 加入 `{userId, mode}` 参数，调用 `buildVisibilityCondition` |
| 同上 | `getMissionById(id, opts?)` 加入 visibility 检查，非创建者不可见 personal 任务 |

**实施要点：**
- `getMissions()` 新增可选参数 `opts: { userId?: string; mode?: "all" | "own" | "org" }`
- 默认 `mode: "all"`（兼容现有调用），展示 org + 自己的 personal
- `getMissionById()` 返回后检查 `if (mission.visibility === "personal" && mission.createdBy !== userId)` 则返回 null

**验收：**
- [ ] tsc 通过
- [ ] build 通过
- [ ] personal 任务仅创建者 + admin 可见
- [ ] 现有 mission 列表页不受影响

---

### Node A.2 — Skills DAL visibility 过滤

**目标：** `getSkillsWithBindCount()` 加入 visibility 过滤

**修改文件：**

| 文件 | 修改内容 |
|------|---------|
| `src/lib/dal/skills.ts` | `getSkillsWithBindCount(orgId, opts?)` 加入 visibility 条件 |

**实施要点：**
- 新增可选参数 `opts: { userId?: string; mode?: "all" | "own" | "org" }`
- 使用 `buildVisibilityCondition` 或在现有 `buildSkillScopeCondition` 中扩展
- 内置技能（`type: "builtin"`）始终可见（跳过 visibility 过滤）

**验收：**
- [ ] tsc 通过
- [ ] build 通过

---

### Node A.3 — 创建 Actions 自动填充 createdBy + visibility

**目标：** 所有创建 action 自动设置 `createdBy = userId, visibility = "personal"`

**修改文件：**

| 文件 | Action | 修改 |
|------|--------|------|
| `src/app/actions/skills.ts` | `createSkill` | insert 时加入 `createdBy: userId, visibility: "personal"` |
| 同上 | `registerPluginSkill` | 同上 |
| 同上 | `importSkillPackage` | 同上 |
| 同上 | `importSkillMd` | 同上 |
| `src/app/actions/missions.ts` | `startMission` | insert 时加入 `createdBy: userId, visibility: "personal"` |
| 同上 | `startMissionFromModule` | `visibility: "org"`（模块触发为组织级） |
| `src/app/actions/knowledge-bases.ts` | `createKnowledgeBase` | insert 时加入 `createdBy: userId, visibility: "personal"` |
| `src/app/actions/employees.ts` | `createEmployee` | insert 时加入 `createdBy: userId, visibility: "personal"` |
| 同上 | `cloneEmployee` | 同上 |

**实施要点：**
- 统一模式：先 `requireAuth()` 拿到 `userId`，insert 时附加字段
- `startMissionFromModule` 是系统内部调用，设 `visibility: "org"`

**验收：**
- [ ] tsc 通过
- [ ] build 通过
- [ ] 新建内容默认 visibility = "personal"

---

### Node A.4 — 删除/编辑 Actions 归属校验

**目标：** 删除/编辑 personal 内容时校验归属

**修改文件：**

| 文件 | Action | 修改 |
|------|--------|------|
| `src/app/actions/skills.ts` | `deleteSkill` / `updateSkill` | 先查记录，检查 `visibility === "personal" && createdBy !== userId` 则拒绝 |
| `src/app/actions/missions.ts` | `deleteMission` | 同上 |
| `src/app/actions/knowledge-bases.ts` | `deleteKnowledgeBase` / `updateKnowledgeBase` | 同上 |
| `src/app/actions/employees.ts` | `deleteEmployee` | 同上 |

**实施要点：**
- 抽取通用守卫函数 `assertContentOwnership(item, userId)` 放在 `src/lib/dal/visibility-filter.ts`
- admin 角色跳过归属校验

**验收：**
- [ ] tsc 通过
- [ ] build 通过
- [ ] 非创建者无法删除/编辑 personal 内容

---

### Node A.5 — assembly.ts 跳过 personal KB + 列表页 Visibility 集成

**目标：** Agent 执行时跳过 personal 知识库；5 个列表页集成 VisibilityBadge + VisibilityFilter

**修改文件：**

| 文件 | 修改 |
|------|------|
| `src/lib/agent/assembly.ts` | 加载员工绑定的知识库时，过滤 `visibility !== "personal"` 或 `createdBy === userId` |
| 技能列表页 client 组件 | 导入并使用 `<VisibilityBadge>` 和 `<VisibilityFilter>` |
| 知识库列表页 client 组件 | 同上 |
| 工作流列表页 client 组件 | 同上 |
| 任务列表页 client 组件 | 同上 |
| 员工列表页 client 组件 | 同上 |

**实施要点：**
- `assembly.ts` 在加载 KB 时：`if (kb.visibility === "personal" && kb.createdBy !== userId) continue`
- 各列表页顶部加 `<VisibilityFilter>`，每行/卡片加 `<VisibilityBadge>`
- page.tsx（Server）传递 `userId` 给 client 组件用于过滤

**验收：**
- [ ] tsc 通过
- [ ] build 通过
- [ ] personal KB 不被 AI Agent 读取
- [ ] 列表页每条数据标注可见性 Badge
- [ ] 筛选 Toggle 正常工作

---

## Stage B: 群聊 SSE 集成

### Node B.1 — stream/route.ts 群聊分支

**目标：** SSE stream 路由支持群聊模式

**修改文件：**

| 文件 | 修改内容 |
|------|---------|
| `src/app/api/chat/stream/route.ts` | 根据 `conversation.isGroup` 分支：单聊走现有逻辑，群聊走 group-dispatcher |

**实施要点：**
- 从 DB 查询 `saved_conversations` 记录，检查 `isGroup` 字段
- 群聊模式：
  1. 使用 `group-router.resolveRoute()` 确定目标员工
  2. 使用 `planFromTemplate()` 构建执行计划
  3. 根据 `mode` 调用 `executeSerialPlan()` 或 `executeParallelPlan()`
  4. SSE 事件写入 `conversation_messages` 表
- 单聊模式保持不变
- 群聊 SSE 事件增加 `senderId` 字段

**验收：**
- [ ] tsc 通过
- [ ] build 通过
- [ ] 单聊功能不受影响
- [ ] 群聊 SSE 事件携带 senderId

---

### Node B.2 — use-chat-stream.ts 群聊事件处理

**目标：** 前端 Hook 处理群聊 SSE 事件

**修改文件：**

| 文件 | 修改内容 |
|------|---------|
| `src/hooks/use-chat-stream.ts` | 新增群聊 SSE 事件处理：participant_start/end、chain_progress、parallel_merge、arbitration 系列事件 |

**实施要点：**
- `participant_start` → 设置 `activeSpeaker`，开始新的消息块
- `participant_end` → 结束当前消息块
- `text-delta` → 按 `senderId` 归属到对应消息
- `chain_progress` / `parallel_merge` / `arbitration_*` → 更新执行状态
- 保持单聊模式完全兼容（`senderId` 缺失时归入默认员工）
- 与 `use-group-chat.ts` 联动更新群聊状态

**验收：**
- [ ] tsc 通过
- [ ] build 通过
- [ ] 单聊不受影响
- [ ] 群聊事件正确触发状态更新

---

### Node B.3 — chat-panel.tsx 群聊 UI 集成

**目标：** 右侧聊天面板支持群聊模式

**修改文件：**

| 文件 | 修改内容 |
|------|---------|
| `src/app/(dashboard)/chat/chat-panel.tsx` | 群聊模式：顶部群名+成员头像、ChainProgress、消息按 senderId 分组、焦点提示条 |

**实施要点：**
- 根据 `conversation.isGroup` 切换单聊/群聊布局
- 群聊头部：群名 + 成员头像横排 + `[+]` 邀请按钮
- 群聊头部下方：`<ChainProgress>`（串行）或 `<ParallelProgress>`（并行）
- 消息渲染：每条 AI 消息带头像 + 员工名 + 角色标签
- Step Review 消息以 `<StepReviewCard>` 卡片形式展示
- 仲裁消息以 `<ArbitrationCard>` 卡片展示
- 输入框上方：焦点员工提示 "💬 正在与小文对话"
- `<MentionPopover>` 集成到输入框

**验收：**
- [ ] tsc 通过
- [ ] build 通过
- [ ] 群聊消息按 senderId 正确归属
- [ ] 进度条/并行轨道/仲裁卡片正确展示
- [ ] 单聊面板不受影响

---

### Node B.4 — @提及输入集成 + 焦点路由

**目标：** 群聊输入框集成 @提及和焦点员工提示

**修改文件：**

| 文件 | 修改内容 |
|------|---------|
| `src/app/(dashboard)/chat/chat-panel.tsx` | 输入框监听 `@` 弹出 MentionPopover，发送时解析 @提及 |
| `src/hooks/use-group-chat.ts` | 焦点员工提示随路由结果动态更新 |

**实施要点：**
- 输入框 `onChange` 检测 `@` 字符，定位光标位置
- 弹出 `<MentionPopover>`，选择后插入 `@员工名` 到输入框
- 发送消息时提取 `@提及` 传递给 group-router
- 焦点员工提示条：`<div>💬 正在与{focusName}对话</div>`
- 焦点员工随 SSE 事件（participant_start/end）自动更新

**验收：**
- [ ] tsc 通过
- [ ] build 通过
- [ ] @弹出员工选择浮窗
- [ ] @提及正确路由
- [ ] 焦点提示条动态更新

---

## Stage C: SSO 完整流程

### Node C.1 — SSO OAuth 完整流程实现

**目标：** 实现 SSO 登录的完整 OAuth 流程

**修改文件：**

| 文件 | 修改内容 |
|------|---------|
| `src/app/api/auth/sso/[provider]/route.ts` | 完善 GET handler：code → token → userInfo → 创建/关联 Supabase 用户 → session → 重定向 |

**实施要点：**
1. GET（发起）：生成 `state` + `nonce`，存入 cookie，302 到 OAuth URL
2. GET callback（回调）：
   - 验证 `state` cookie
   - 调用 `provider.exchangeToken(code)` 获取 access_token
   - 调用 `provider.getUserInfo(accessToken)` 获取用户信息
   - 查询 `sso_connections` 表是否已关联
   - 已关联：直接设置 Supabase session
   - 未关联：通过 Supabase Admin API 创建用户，写入 `sso_connections`
   - 设置 session cookie
   - 302 → `/home`
3. 错误处理：OAuth 失败 → 302 → `/login?sso=error`

**验收：**
- [ ] tsc 通过
- [ ] build 通过
- [ ] SSO 登录流程完整（至少 mock 测试）
- [ ] Email/Password 登录不受影响
- [ ] 下游 `requireAuth()` 无需修改

---

## Stage D: 数据库迁移 + 收尾

### Node D.1 — 数据库 Schema 推送

**目标：** 将所有 Schema 变更推送到 Supabase

**执行命令：**
```bash
npm run db:generate    # 生成 SQL 迁移文件
npm run db:push        # 推送到 Supabase（dev）
```

**检查项：**
- [ ] `content_visibility` enum 创建成功
- [ ] 4 张表新增 `created_by` + `visibility` 字段
- [ ] `conversation_participants` + `conversation_messages` 表创建
- [ ] `sso_connections` 表创建
- [ ] `saved_conversations` 新增 `is_group` / `group_mode` / `leader_employee_slug`
- [ ] 现有数据 `visibility` 默认值为 `org`（向后兼容）

**风险：**
- Supabase PgBouncer 需 `prepare: false`（已在 `src/db/index.ts` 配置）
- 迁移期间服务短暂不可用

---

### Node D.2 — 审计日志补齐 + 全量验收

**目标：** 补齐管理员查看个人内容的审计日志，执行全量验收

**修改文件：**

| 文件 | 修改内容 |
|------|---------|
| `src/app/actions/content-visibility.ts` | 管理员查看个人内容时写入审计日志（action: "review", metadata: {adminView: true}） |

**全量验收清单：**

### 权限隔离验收
- [ ] 四张表各新增 `created_by` + `visibility` 字段
- [ ] 所有 legacy 数据 `visibility = 'org'`
- [ ] 新建内容自动填入 `createdBy = currentUser` + `visibility = 'personal'`
- [ ] 普通用户只能看到自己的 personal 内容 + 全部 org 内容
- [ ] Admin 可以看到所有用户的所有内容
- [ ] 一键升级 personal → org（不可逆），操作写入审计日志
- [ ] 列表页每条数据标注可见性 Badge
- [ ] Admin 内容管理页 DataTable 展示所有用户内容
- [ ] 个人内容导出/导入含安全校验

### 群聊验收
- [ ] `conversation_participants` 和 `conversation_messages` 表创建完成
- [ ] 现有一对一对话数据无损迁移
- [ ] 用户可手动选择 2-6 个员工创建群聊
- [ ] 群聊中消息按 `senderId` 正确归属展示
- [ ] 串行接力模式：员工按序执行，上下文自动传递
- [ ] 并行执行模式：多员工并发，Leader 汇总
- [ ] @提及正确路由到指定员工
- [ ] 不 @时按焦点员工规则正确路由
- [ ] Step Review 在群聊中正确展示和操作
- [ ] SSE 事件流正确携带 `senderId`

### SSO 验收
- [ ] SSO 登录入口出现在登录页
- [ ] 企业微信/飞书/钉钉 OAuth 流程跑通
- [ ] SSO 登录后自动创建/关联 Supabase 用户
- [ ] Email/Password 登录继续正常工作
- [ ] 下游 `requireAuth()` 无需修改

### 代码质量验收
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过
- [ ] `npm test` 通过（新增测试全部通过）

---

## 三、进度安排

| 阶段 | 节点 | 优先级 | 前置依赖 | 说明 |
|------|------|--------|---------|------|
| **Stage A** | A.1 Missions DAL | P1 | 无 | 权限隔离生效 |
| | A.2 Skills DAL | P1 | 无 | 权限隔离生效 |
| | A.3 创建 Actions | P1 | 无 | 新内容默认隔离 |
| | A.4 编辑/删除 Actions | P1 | A.3 | 归属校验 |
| | A.5 assembly + UI 集成 | P1 | A.1, A.2 | Agent 安全 + 可视化 |
| **Stage B** | B.1 stream/route.ts | P0 | 无 | 群聊核心集成 |
| | B.2 use-chat-stream.ts | P0 | B.1 | 前端事件处理 |
| | B.3 chat-panel.tsx | P0 | B.2 | 群聊 UI 渲染 |
| | B.4 @提及 + 焦点 | P1 | B.3 | 交互增强 |
| **Stage C** | C.1 SSO 完整流程 | P1 | 无 | 企业客户准入 |
| **Stage D** | D.1 DB 迁移 | P0 | A.1-A.5 | Schema 推送 |
| | D.2 审计 + 验收 | P2 | 全部 | 收尾 |

### 建议执行顺序

```
第 1 批（可并行）：
  ├── A.1 Missions DAL
  ├── A.2 Skills DAL
  ├── A.3 创建 Actions
  └── B.1 stream/route.ts

第 2 批（依赖第 1 批）：
  ├── A.4 编辑/删除 Actions（依赖 A.3）
  ├── A.5 assembly + UI 集成（依赖 A.1, A.2）
  ├── B.2 use-chat-stream.ts（依赖 B.1）
  └── C.1 SSO 完整流程（独立）

第 3 批（依赖第 2 批）：
  ├── B.3 chat-panel.tsx（依赖 B.2）
  └── D.1 DB 迁移（依赖 A.1-A.5）

第 4 批（收尾）：
  ├── B.4 @提及 + 焦点（依赖 B.3）
  └── D.2 审计 + 验收（依赖全部）
```

---

## 四、风险与缓解

| # | 风险 | 缓解措施 |
|---|------|---------|
| 1 | `use-chat-stream.ts`（1032 行）改动可能引入回归 | 先加群聊分支（if isGroup），不动单聊逻辑 |
| 2 | `stream/route.ts` 群聊模式与单聊 SSE 格式不同 | 群聊事件新增 `senderId`，单聊不发送 |
| 3 | DB 迁移 `saved_conversations.employeeSlug` 改 nullable 可能影响存量查询 | 已在前一轮添加 null 保护（6 处） |
| 4 | SSO OAuth 需要外部平台配置 | 先实现完整流程，Provider 可 mock 测试 |
| 5 | 5 个列表页集成 VisibilityBadge 工作量大 | 抽取通用 HOC 或 wrapper 减少重复代码 |

---

## 五、文件变更预估

### 修改文件（约 20 个）

| 文件 | Stage | 修改范围 |
|------|-------|---------|
| `src/lib/dal/missions.ts` | A.1 | +visibility 过滤 |
| `src/lib/dal/skills.ts` | A.2 | +visibility 过滤 |
| `src/lib/dal/visibility-filter.ts` | A.4 | +assertContentOwnership 守卫函数 |
| `src/app/actions/skills.ts` | A.3, A.4 | 4 个创建 action +createdBy；2 个删除/编辑 action +校验 |
| `src/app/actions/missions.ts` | A.3, A.4 | 2 个创建 action +createdBy；1 个删除 action +校验 |
| `src/app/actions/knowledge-bases.ts` | A.3, A.4 | 1 个创建 +createdBy；2 个删除/编辑 +校验 |
| `src/app/actions/employees.ts` | A.3, A.4 | 2 个创建 +createdBy；1 个删除 +校验 |
| `src/lib/agent/assembly.ts` | A.5 | +personal KB 过滤 |
| 5 个列表页 client 组件 | A.5 | +VisibilityBadge + VisibilityFilter |
| `src/app/api/chat/stream/route.ts` | B.1 | +群聊分支（group-router/dispatcher） |
| `src/hooks/use-chat-stream.ts` | B.2 | +群聊 SSE 事件处理 |
| `src/app/(dashboard)/chat/chat-panel.tsx` | B.3, B.4 | +群聊 UI（进度条/消息分组/焦点提示/@提及） |
| `src/hooks/use-group-chat.ts` | B.4 | +焦点提示联动 |
| `src/app/api/auth/sso/[provider]/route.ts` | C.1 | 完善 OAuth 流程 |
| `src/app/actions/content-visibility.ts` | D.2 | +管理员查看审计日志 |

---

## 六、与上一轮实施的关系

上一轮 `implementation-plan.md`（6 Stage / 23 Node）已完成**基础设施层**：
- Schema 定义（8 枚举 + 6 新表 + 10 新字段）
- 核心工具模块（visibility-filter / group-router / group-dispatcher / SSO providers）
- UI 组件库（10+ 个独立组件）
- Server Actions 骨架（group-chat CRUD / content-export / content-import）

本轮聚焦**集成层**——将已完成的模块接入现有业务流程：
- DAL 查询函数接入 visibility 过滤
- CRUD Actions 接入 createdBy 自动填充 + 归属校验
- SSE stream 接入群聊调度引擎
- 前端 Hook 接入群聊 SSE 事件
- 聊天面板接入群聊可视化组件
- SSO 接入完整 OAuth 流程
- 列表页接入可见性组件
