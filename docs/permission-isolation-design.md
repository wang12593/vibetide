# VibeTide 系统设计方案

> 生成日期：2026-05-14
> 更新日期：2026-05-14（新增群聊功能设计 + 用户体系演进）
> 状态：待实施
> 来源：BMAD Party Mode 多 Agent 讨论（Winston / Sally / Amelia / Mary）

---

## 第一部分：权限隔离与管理系统

### 一、项目背景

#### 1.1 现状

VibeTide 当前的内容隔离仅到**组织级（organization_id）**，同一组织内所有用户看到的内容完全相同。没有用户级别的隔离机制。

#### 1.2 核心问题

| 问题 | 影响 |
|------|------|
| 用户创建的测试内容对所有人可见 | 干扰协作、不敢自由试验 |
| 无"我的"与"组织的"区分 | 内容管理混乱 |
| 管理员无法全局管控 | 缺乏管理视图 |
| 无导入导出 | 内容不可迁移 |
| 无审计日志 | 管理操作无追溯 |

#### 1.3 目标

1. 个人账号创建的自定义内容仅创建者可见
2. 管理员可查看和管理所有用户的内容
3. 支持一键升级为组织共享（不可逆）
4. 支持导入导出
5. 管理员操作留审计日志

---

### 二、隔离范围

#### 2.1 四张核心表

| 内容类型 | 隔离方式 | 预设/内置 | 自定义 |
|---------|---------|----------|--------|
| **AI 员工** (ai_employees) | 新增隔离 | 组织级（所有人可见） | 仅创建者 + admin |
| **工作流模板** (workflow_templates) | 已有 `created_by` | 组织级 | 仅创建者 + admin |
| **知识库** (knowledge_bases) | 新增隔离 | — | 仅创建者 + admin |
| **技能** (skills) | 新增隔离 | — | 仅创建者 + admin |
| **任务** (missions) | 新增隔离 | — | 仅创建者 + admin |

#### 2.2 不做隔离的内容

| 内容 | 原因 |
|------|------|
| 预设 AI 员工（is_preset=1） | 组织基础设施，8 个预设员工所有人共用 |
| 内置工作流（is_builtin=true） | 系统级模板 |
| 组织配置 | 天然组织级 |
| 对话记录 | 独立管理，不在本次范围 |

---

### 三、数据模型设计

#### 3.1 新增枚举

```typescript
// src/db/schema/enums.ts
export const contentVisibilityEnum = pgEnum("content_visibility", [
  "personal",
  "org",
]);
```

#### 3.2 Schema 变更

##### ai_employees（新增两个字段）

```typescript
// src/db/schema/ai-employees.ts
createdBy: uuid("created_by"),
visibility: contentVisibilityEnum("visibility").default("org"),
```

##### missions（新增两个字段）

```typescript
// src/db/schema/missions.ts
createdBy: uuid("created_by"),
visibility: contentVisibilityEnum("visibility").default("org"),
```

##### knowledge_bases（新增两个字段）

```typescript
// src/db/schema/knowledge-bases.ts
createdBy: uuid("created_by"),
visibility: contentVisibilityEnum("visibility").default("org"),
```

##### skills（新增两个字段）

```typescript
// src/db/schema/skills.ts
createdBy: uuid("created_by"),
visibility: contentVisibilityEnum("visibility").default("org"),
```

#### 3.3 迁移 SQL

```sql
CREATE TYPE content_visibility AS ENUM ('personal', 'org');

ALTER TABLE ai_employees ADD COLUMN created_by uuid;
ALTER TABLE ai_employees ADD COLUMN visibility content_visibility NOT NULL DEFAULT 'org';

ALTER TABLE missions ADD COLUMN created_by uuid;
ALTER TABLE missions ADD COLUMN visibility content_visibility NOT NULL DEFAULT 'org';

ALTER TABLE knowledge_bases ADD COLUMN created_by uuid;
ALTER TABLE knowledge_bases ADD COLUMN visibility content_visibility NOT NULL DEFAULT 'org';

ALTER TABLE skills ADD COLUMN created_by uuid;
ALTER TABLE skills ADD COLUMN visibility content_visibility NOT NULL DEFAULT 'org';
```

**向后兼容保证：** `DEFAULT 'org'` 确保现有数据全部对组织可见，零行为变化。

---

### 四、核心模块设计

#### 4.1 visibility-filter.ts

```
文件：src/lib/dal/visibility-filter.ts
```

```typescript
import { and, or, eq } from "drizzle-orm";
import { isSuperAdmin } from "@/lib/rbac";

type VisibilityTable = {
  organizationId: any;
  createdBy: any;
  visibility: any;
};

export async function buildVisibilityCondition(opts: {
  userId: string;
  orgId: string;
  table: VisibilityTable;
  mode: "all" | "own" | "org";
}) {
  const { userId, orgId, table, mode } = opts;
  const orgScope = eq(table.organizationId, orgId);

  switch (mode) {
    case "own":
      return and(orgScope, eq(table.createdBy, userId));
    case "org":
      return and(orgScope, eq(table.visibility, "org"));
    case "all":
    default:
      return and(
        orgScope,
        or(
          eq(table.visibility, "org"),
          eq(table.createdBy, userId)
        )
      );
  }
}

export function buildEmployeeVisibilityCondition(opts: {
  userId: string;
  orgId: string;
  table: VisibilityTable & { isPreset: any };
  isAdmin: boolean;
}) {
  const { userId, orgId, table, isAdmin } = opts;
  const orgScope = eq(table.organizationId, orgId);

  if (isAdmin) return orgScope;

  return and(
    orgScope,
    or(
      eq(table.isPreset, 1),
      eq(table.createdBy, userId)
    )
  );
}
```

#### 4.2 DAL 层改造

| 文件 | 函数 | 修改内容 |
|------|------|---------|
| `src/lib/dal/employees.ts` | `getEmployees()` | 加 employee visibility filter |
| 同上 | `getEmployee(slug)` | 加 visibility 检查 |
| 同上 | `getEmployeeFullProfile(slug)` | 加 visibility 检查 |
| `src/lib/dal/missions.ts` | `getMissions()` | 加 visibility filter |
| 同上 | `getMissionById()` | 加 visibility 检查 |
| `src/lib/dal/knowledge-bases.ts` | `listKnowledgeBaseSummariesByOrg()` | 加 visibility filter |
| 同上 | `getKnowledgeBaseById()` | 加 visibility 检查 |
| `src/lib/dal/skills.ts` | `getSkillsWithBindCount()` | 加 visibility filter |
| `src/lib/dal/workflow-templates.ts` | `listWorkflowTemplatesByOrg()` | 加 visibility filter |
| `src/lib/agent/assembly.ts` | `assembleAgent()` | 跳过 personal KB；加载 employee 时检查 visibility |

#### 4.3 Server Actions 权限守卫

**创建时自动填充：**

```typescript
await db.insert(table).values({
  ...data,
  createdBy: userId,
  visibility: "personal",
});
```

**删除/编辑时校验归属：**

```typescript
if (item.visibility === "personal" && item.createdBy !== userId) {
  const isAdmin = await isSuperAdmin(userId);
  if (!isAdmin) throw new Error("无权操作他人的个人内容");
}
```

**新增统一可见性升级 Action：**

```typescript
// src/app/actions/content-visibility.ts
export async function upgradeContentVisibility(
  contentType: "employee" | "mission" | "knowledge_base" | "skill",
  id: string
) {
  // 1. 校验：只有创建者或 admin 能升级
  // 2. 校验：已经是 org 的不能再升
  // 3. 更新：visibility = 'org'
  // 4. 审计：写入 content_trail_logs
}
```

**不可逆规则：** `org → personal` 降级被禁止。

#### 4.4 RBAC 扩展

```
文件：src/lib/rbac-constants.ts
```

```typescript
CONTENT_VIEW_ALL: "content:view_all",
CONTENT_MANAGE_ALL: "content:manage_all",
CONTENT_CHANGE_VISIBILITY: "content:change_visibility",
```

| 角色 | 权限 |
|------|------|
| viewer | content:view_own |
| editor | content:view_own + content:view_org |
| admin | 全部权限 + content:view_all + content:change_visibility |

---

### 五、管理页面设计

#### 5.1 路由

```
src/app/(dashboard)/admin/content-management/
├── page.tsx           → 服务端，requirePermission(CONTENT_VIEW_ALL)
└── content-client.tsx → DataTable 管理界面
```

#### 5.2 页面布局

**顶部工具栏：**

```
[ 类型: 全部 ▾ ]  [ 可见性: 全部 ▾ ]  [ 创建者: 全部 ▾ ]  [ 🔍 搜索... ]  [ 导出 ]
```

**表格列：**

| 列 | 内容 |
|----|------|
| 选择框 | checkbox，支持全选 |
| 名称 | 内容标题，可点击跳转 |
| 类型 | 知识库 / 工作流 / 技能 / 员工 / 任务 |
| 可见性 | 🔒 个人 / 🌐 组织 Badge |
| 创建者 | 头像 + 用户名 |
| 创建时间 | 相对时间 |
| 操作 | 升级为组织级 / 导出 / 删除 |

#### 5.3 侧边栏入口

在 `ADMIN_ITEMS` 中新增：

```typescript
{ label: "内容管理", href: "/admin/content-management", icon: Database },
```

---

### 六、UI 组件设计

#### 6.1 VisibilityBadge 组件

```
文件：src/components/shared/visibility-badge.tsx
```

```
🔒 个人 → 灰色/琥珀色小锁 Badge
🌐 组织 → 蓝色/天蓝色小地球 Badge
```

#### 6.2 列表页筛选 Toggle

```
[ 全部 | 仅我的 | 组织共享 ]    [ 🔍 搜索... ]
```

#### 6.3 一键升级按钮

- 仅 `visibility = 'personal'` 且 `createdBy === currentUser` 时显示
- 点击弹出确认框："升级后组织内所有成员可见，此操作不可撤销"

#### 6.4 员工列表页

- 预设员工始终显示，不可切换可见性
- 自定义员工按 visibility 过滤
- 管理员看到所有自定义员工

---

### 七、导入导出设计

#### 7.1 导出格式

```json
{
  "version": "1.0",
  "exportedAt": "2026-05-14T10:00:00Z",
  "exportedBy": "user-uuid",
  "items": [
    {
      "type": "knowledge_base",
      "name": "重庆时政报道规范",
      "visibility": "personal",
      "data": {}
    }
  ]
}
```

#### 7.2 导出/导入操作

```typescript
// src/app/actions/content-export.ts
export async function exportPersonalContent() { /* ... */ }
export async function exportSelectedContent(ids: string[], types: string[]) { /* ... */ }

// src/app/actions/content-import.ts
export async function importContent(jsonString: string) { /* ... */ }
```

#### 7.3 安全校验

- JSON schema 验证（版本号、结构完整性）
- 字段白名单过滤
- 长度限制（单条内容不超过 1MB）
- 数量限制（单次导入不超过 100 条）

---

### 八、审计日志

#### 8.1 复用现有 content_trail_logs

| 操作 | action 值 | metadata |
|------|-----------|----------|
| 升级可见性 | `edit` | `{ visibilityChange: 'personal→org' }` |
| 管理员查看个人内容 | `review` | `{ adminView: true }` |
| 批量删除 | `delete` | `{ batchCount: N }` |
| 导出 | `export` | `{ exportCount: N }` |
| 导入 | `create` | `{ importSource: 'file', importCount: N }` |

---

### 九、Edge Cases 与安全风险

| # | 风险 | 缓解措施 |
|---|------|----------|
| 1 | `getMissionById` 返回了 personal 内容给非创建者 | DAL 层 visibility filter |
| 2 | `org → personal` 降级导致引用断裂 | 禁止降级 |
| 3 | legacy 数据 `createdBy = NULL` | NULL 视为 org 级别 |
| 4 | 批量删除误删他人 personal 内容 | 加 `createdBy` 检查 |
| 5 | AI Agent 执行时读取 personal KB | assembly.ts 跳过 personal KB |
| 6 | 自定义员工在 org workflow 中引用 | UI 禁止选个人员工加入 org workflow |
| 7 | 并发创建同名 skill | 唯一索引兜底 |
| 8 | 管理员越权 | RBAC 权限限制 + 审计日志 |

---

### 十、权限隔离实施计划

#### Phase 1：Schema + Migration

| 任务 | 文件 |
|------|------|
| 新增 `content_visibility` enum | `src/db/schema/enums.ts` |
| 四张表各加 `created_by` + `visibility` | 对应 schema 文件 |
| 执行 DB 迁移 | SQL 脚本 |

#### Phase 2：DAL 过滤层

| 任务 | 文件 |
|------|------|
| 新建 visibility-filter.ts | `src/lib/dal/visibility-filter.ts` |
| 改造所有 DAL 查询函数 | 对应 DAL 文件 |
| 改造 assembleAgent | `src/lib/agent/assembly.ts` |

#### Phase 3：Server Actions + RBAC

| 任务 | 文件 |
|------|------|
| 新增 RBAC 权限常量 | `src/lib/rbac-constants.ts` |
| 新增 upgradeContentVisibility | `src/app/actions/content-visibility.ts` |
| 改造创建/删除/编辑 actions | 多个 action 文件 |

#### Phase 4：UI 组件

| 任务 | 文件 |
|------|------|
| VisibilityBadge 组件 | `src/components/shared/visibility-badge.tsx` |
| 列表页筛选 Toggle | 各 client 组件 |
| 卡片加可见性 Badge | 各列表页卡片 |
| 详情页升级按钮 | 各详情页 |

#### Phase 5：管理页面 + 导入导出

| 任务 | 文件 |
|------|------|
| admin/content-management 页面 | `src/app/(dashboard)/admin/content-management/` |
| 侧边栏加入口 | `src/components/layout/app-sidebar.tsx` |
| 导出/导入 actions | `src/app/actions/content-export.ts` / `content-import.ts` |

---

### 十一、权限隔离验收标准

- [ ] 四张表各新增 `created_by` + `visibility` 字段
- [ ] 所有 legacy 数据 `visibility = 'org'`
- [ ] 新建内容自动填入 `createdBy = currentUser` + `visibility = 'personal'`
- [ ] 普通用户只能看到自己的 personal 内容 + 全部 org 内容
- [ ] Admin 可以看到所有用户的所有内容
- [ ] 一键升级 personal → org（不可逆），操作写入审计日志
- [ ] 列表页每条数据标注可见性 Badge
- [ ] Admin 内容管理页 DataTable 展示所有用户内容
- [ ] 个人内容导出/导入含安全校验

---
---

## 第二部分：员工群聊功能设计

> 来源：BMAD Party Mode 第二轮讨论（Winston / Sally / Amelia / Mary）
> 优先级：**P0**（核心体验升级）
> 核心理念：群聊的本质不是"多人聊天室"，而是"任务上下文的共享空间"

### 一、背景与价值

#### 1.1 当前痛点

VibeTide 的典型工作流涉及 5-6 个员工协作（热点发现→策划→采集→写作→审核→分发），但当前交互模式是用户在 `/chat` 中与单个员工**一对一**对话。用户充当了"人肉消息总线"：

1. 跟小雷聊热点 → 手动复制结论
2. 切到小策聊策划 → 粘贴热点信息 → 手动复制策划案
3. 切到小资聊素材 → 粘贴策划案 → 手动整理素材
4. ... 以此类推

#### 1.2 群聊解决的核心价值

| 价值维度 | 具体收益 | 预期指标 |
|----------|----------|----------|
| 降低用户操作成本 | 1 次群聊代替 5-6 次一对一切换 | 单条内容生产时间 ↓ 40-60% |
| 减少信息损耗 | 员工间直接传递上下文，无人工中转 | 信息完整度提升 |
| 提升 AI 协作质量 | 员工能看到彼此输出，形成共享上下文 | 内容审核通过率提升 |
| 降低使用门槛 | 用户不需要记住"该找谁" | 新用户激活率提升 |

#### 1.3 竞品差异化

| 竞品 | 协作模式 | VibeTide 差异化 |
|------|----------|-----------------|
| 飞书/钉钉群聊 | 人类群聊 + Bot 插件 | AI 员工原生协作，非 Bot 挂载 |
| CrewAI | 代码定义的 Agent Pipeline | 可视化群聊 UI，非技术用户可用 |
| AutoGen | 多 Agent 对话框架（开发者工具） | 面向内容生产垂直场景，开箱即用 |
| Coze/扣子 | 单 Bot + 插件 | 多角色 AI 员工，有人格化分工 |

---

### 二、执行模式设计

群聊支持三种执行模式，按优先级分阶段交付：

#### 2.1 串行接力（Phase 1 — P0 优先交付）

```
用户指令 → Leader 规划 → 员工A执行 → 员工B执行 → 员工C执行 → 输出结果
```

- **描述**：按预设顺序依次执行，上一步输出作为下一步输入
- **覆盖场景**：80% 的业务场景（审稿链、选题→写稿、素材→成文）
- **实现复杂度**：低，复用现有 `intent-execute` 的 step-execute 机制
- **关键**：每步切换员工时，新员工自动获得前序所有步骤的上下文

#### 2.2 并行执行（Phase 2）

```
用户指令 → Leader 规划 → ┬→ 员工A执行 ──┐
                          ├→ 员工B执行 ──┼→ 结果合并 → 输出
                          └→ 员工C执行 ──┘
```

- **描述**：同一任务同时发给多个员工，结果汇总后输出
- **覆盖场景**：多视角分析、多人头脑风暴、多渠道素材同步采集
- **实现复杂度**：中，需要 `Promise.allSettled()` + 结果合并 + 冲突处理
- **关键**：结果合并策略——多个员工返回不同方案时，由 leader 员工或用户做裁决

#### 2.3 自由讨论（不做 / 远期实验）

**团队一致判断：纯自由讨论在 VibeTide 场景中价值存疑，不纳入路线图。**

理由：

| 维度 | 串行接力 | 自由讨论 |
|------|---------|---------|
| 产出结构 | 结构化（每步有明确 output） | 非结构化（对话流） |
| 可度量性 | 高（每步可设 KPI） | 低（无法衡量"讨论质量"） |
| 编排复杂度 | 低（线性 DAG） | 高（需收敛机制、防死循环） |
| 错误定位 | 容易 | 困难 |

**替代方案——结构化争议仲裁（P2）：**

当工作流步骤之间出现冲突时（如小策选了选题 A，但小文发现信息源不足建议换 B），系统自动触发受限的多角色讨论：

- 系统检测到"观点冲突"后自动触发
- 参与者严格限定为相关员工
- 轮次上限固定（最多 3 轮）
- 最终输出结构化结论：`{推荐方案, 理由, 反对意见摘要}`
- 不设计成"群聊功能"，设计成"工作流引擎的冲突解决步骤"

---

### 三、数据模型设计

#### 3.1 核心改造：拆 `saved_conversations` 为多表

当前 `saved_conversations` 表每条记录绑定单一 `employeeSlug`，消息打包在 jsonb 字段中。群聊需要打破这个单员工假设。

**方案：新增两张表 + 改造现有表**

##### conversation_participants（新增）

```
文件：src/db/schema/conversation-participants.ts
```

```sql
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES saved_conversations(id) ON DELETE CASCADE,
  participant_type VARCHAR(16) NOT NULL,  -- 'ai_employee' | 'human'
  participant_id VARCHAR(64) NOT NULL,    -- employeeSlug 或 user_id
  role VARCHAR(16) DEFAULT 'member',      -- 'leader' | 'member'
  joined_at TIMESTAMPTZ DEFAULT now(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  UNIQUE(conversation_id, participant_type, participant_id)
);
```

##### conversation_messages（新增）

```
文件：src/db/schema/conversation-messages.ts
```

```sql
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES saved_conversations(id) ON DELETE CASCADE,
  seq_num INTEGER NOT NULL,               -- 严格递增，用于排序
  role VARCHAR(16) NOT NULL,              -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  sender_type VARCHAR(16),                -- 'human' | 'ai_employee' | 'system'
  sender_id VARCHAR(64),                  -- 具体谁发的（employeeSlug / userId）
  message_type VARCHAR(32) DEFAULT 'text', -- 'text' | 'action' | 'step_review' | 'task_result' | 'system_notice'
  metadata JSONB DEFAULT '{}',            -- token_usage, model, latency, thinkingSteps 等
  parent_message_id UUID,                 -- 支持引用/回复
  created_at TIMESTAMPTZ DEFAULT now(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  UNIQUE(conversation_id, seq_num)
);
```

##### saved_conversations（改造）

```diff
- employee_slug VARCHAR(64) NOT NULL
+ employee_slug VARCHAR(64)              -- nullable，群聊时为 null
+ is_group BOOLEAN DEFAULT false
+ group_mode VARCHAR(16) DEFAULT 'serial' -- 'serial' | 'parallel'
+ leader_employee_slug VARCHAR(64)        -- 群聊主持人/调度者
```

`messages` jsonb 字段**保留但降级为缓存/快照**，实时读写走 `conversation_messages`。

##### 数据迁移

一次性将现有 `saved_conversations.messages` jsonb 数组展开为 `conversation_messages` 独立行。同时为每条现有对话创建一条 `conversation_participants` 记录（`participant_type = 'ai_employee'`, `participant_id = employeeSlug`）。

#### 3.2 类型定义扩展

```typescript
// src/lib/chat-utils.ts 扩展

interface GroupChatMessage extends ChatMessage {
  senderId: string;                       // 发送者标识
  senderType: 'human' | 'ai_employee' | 'system';
  senderName: string;
  senderAvatar?: string;
}

// SSE 事件类型扩展
type ChatStreamEvent =
  | { type: 'text-delta'; content: string; senderId: string }
  | { type: 'thinking'; tool: string; label: string; senderId: string }
  | { type: 'participant_start'; participantId: string; participantName: string }
  | { type: 'participant_end'; participantId: string; summary?: string }
  | { type: 'chain_progress'; current: number; total: number }
  | { type: 'step-review'; stepIndex: number; ...; senderId: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
```

---

### 四、消息路由引擎

#### 4.1 三层层级路由

```
用户消息 → 层级1: 显式 @ → 直达目标员工
         → 层级2: 上下文焦点 → 当前活跃员工
         → 层级3: 穆兰意图识别 → 分发给最合适的员工
```

#### 4.2 焦点员工机制

```typescript
// src/lib/chat/group-router.ts

type ChatContext = {
  focusEmployeeId: EmployeeId | null;
  focusReason: 'active_step' | 'recent_interaction' | null;
  focusSetAt: number;
  lastInteractionMap: Record<EmployeeId, number>;
};
```

**焦点判定规则（按优先级）：**

| 优先级 | 规则 | 触发条件 | 谁响应 |
|--------|------|----------|--------|
| 1 | **显式 @** | 消息中包含 `@员工名` | 被 @的员工 |
| 2 | **接力棒规则** | 串行任务正在执行 | 当前步骤的执行者 |
| 3 | **意图匹配规则** | 消息含明确工作意图词（写/审/发/策划…） | 意图对应的角色 |
| 4 | **最近对话规则** | 以上不满足，有员工刚回复过 | 最后回复的员工（带衰减窗口：5 条消息 / 30 秒） |
| 5 | **广播规则** | 出现"大家/所有人/都" | 全体成员简短轮次回复 |
| 6 | **默认接待员** | 全部不满足 | 小策（策划协调者）或穆兰（leader） |

**焦点清除条件：**
- 用户 @了另一个员工（焦点切换）
- 工作流步骤完成且超过 30 秒无新消息
- 用户发送"新任务"/"重新开始"等重置意图

#### 4.3 串行执行中的消息处理

用户在串行执行过程中发消息时，采用**不中断但记录反馈**策略：

- 当前步骤继续执行，不 pause
- 用户消息标记为 `feedback`，关联到当前步骤
- 步骤完成后检查 feedback 队列，决定是否修改输出
- 只有"停/等一下/暂停"等中断意图才真正 pause

#### 4.4 实现路径

```
文件：src/lib/chat/group-dispatcher.ts
```

核心接口：

```typescript
interface GroupDispatchPlan {
  conversationId: string;
  triggerMessage: ConversationMessage;
  participants: ConversationParticipant[];
  mode: 'serial' | 'parallel';
  executionOrder: string[];
}

async function* executeGroupPlan(
  plan: GroupDispatchPlan,
  ctx: { orgId: string; userId: string }
): AsyncGenerator<ChatStreamEvent>
```

**串行引擎：**

```
用户消息 → leader 收到 → leader 决定调用链
  → employee_1 生成回复（SSE stream，带 senderId）
  → employee_1 回复结束 → 写入 conversation_messages
  → 触发 employee_2（以 employee_1 的输出作为上下文）
  → ... 链结束 → leader 总结
```

**并行引擎（Phase 2）：**

```
用户消息 → leader 规划并行任务
  → Promise.allSettled([employee_1, employee_2, employee_3])
  → 收集所有结果 → leader 合并/裁决 → 输出
```

---

### 五、群聊触发场景

#### 5.1 四种进群方式

| 入口 | 触发方式 | 用户场景 | 实现优先级 |
|------|---------|----------|-----------|
| **手动建群** | 员工列表右上角「+ 发起群聊」 | 主编主动组建选题策划群 | Phase 1 |
| **对话中拉人** | 聊天面板顶部「邀请加入」图标 | 正在跟小文聊稿子，需要小深拉数据 | Phase 1 |
| **@提及触发** | 输入框 `@` 弹出选择，自动升级为群聊 | 一对一聊天中 @了第三个人 | Phase 2 |
| **任务自动建群** | 场景模板自动组建，发任务卡片 | 发起"深度报道"场景，系统自动拉群 | Phase 2 |

#### 5.2 触发场景优先级（Mary 商业分析）

**Tier 1 — MVP 必须覆盖（高频 + 高价值）：**

| 场景 | 参与员工 | 商业价值 |
|------|----------|----------|
| 热点→发稿 | 小雷→小策→小文→小检→小发 | 最核心的日频场景，直接产出内容 |
| 策划会 | 小策+小文+小检 | 决定内容方向，高决策价值 |
| 审稿反馈 | 小文+小检 | 质量把关关键环节 |

**Tier 2 — MVP 后第二批：**

| 场景 | 参与员工 |
|------|----------|
| 数据复盘 | 小神+小策+小发 |
| 素材协作 | 小资+小文 |
| 知识库问答 | 小书+任意员工 |

**Tier 3 — 远期：**

| 场景 | 参与员工 |
|------|----------|
| Leader 全流程编排 | 穆兰+全体 |
| 跨团队协作 | 多个团队员工 |

---

### 六、UI 交互设计

#### 6.1 左侧面板改造

当前双 Tab（员工/收藏）改为**三 Tab**：

```
┌─────────────────────────────────────────────┐
│  [员工]  [群聊]  [收藏]        [+ 发起群聊] │
├─────────────────────────────────────────────┤
│  群聊 Tab 内容：                              │
│  👥 两会深度解读（4人）                      │
│    小审: "内容合规，建议调整标题"     11:20  │
│  ─────────────────────────────────────────  │
│  👥 短视频制作（3人）                        │
│    🤖 小剪正在生成视频封面...        10:45   │
└─────────────────────────────────────────────┘
```

- 「员工」Tab：保持现有行为，展示最近一对一对话
- 「群聊」Tab：按最近活跃时间排序，显示群名 + 成员数 + 最新消息预览
- 「+ 发起群聊」按钮仅在「群聊」Tab 下显示

#### 6.2 右侧聊天面板

群聊模式下右侧面板改造：

```
┌─────────────────────────────────────────────┐
│ 👥 两会深度解读    [小策][小文][小检][+]    │  ← 群名 + 成员头像横排
│                    4 位成员 · 进行中          │
│  ① 找选题 ✅ → ② 写稿 🔄 → ③ 审核 ⏳     │  ← 流程进度条
├─────────────────────────────────────────────┤
│                                             │
│  小策 10:30                                  │
│  为你找到了 3 个两会相关热点：               │
│  1. 代表提案数据分析...                      │
│                                             │
│  @小文 建议从第 2 个角度切入                 │  ← @提及高亮
│                                             │
│  小文 10:45                                  │
│  收到，我根据小策的选题开始写稿              │
│                                             │
│  [Step Review 卡片]                         │
│  小字提交了初稿，请确认：                    │
│  [查看全文]  [确认通过]  [修改建议]          │
│                                             │
├─────────────────────────────────────────────┤
│  💬 正在与小文对话                           │  ← 焦点员工提示
│  输入消息...                       [发送]    │
│  @提及员工                                   │  ← 快捷操作
└─────────────────────────────────────────────┘
```

#### 6.3 消息归属展示

- **用户消息**：靠右对齐，蓝色气泡
- **AI 员工消息**：靠左对齐，每条消息左上角 `[头像] 名称 · 角色标签 + 时间`
- **系统消息**：居中展示（任务流转通知、成员变动），细线分隔
- **@提及**：被 @的员工名称用主题色高亮
- **等待确认**：需要用户操作的消息左侧加橙色竖条提醒

#### 6.4 串行/并行可视化

**串行进度条（群名下方）：**

```
① 找选题 ✅ → ② 写稿 🔄 → ③ 审核 ⏳
```

- ✅ 已完成（绿色）
- 🔄 当前活跃（脉冲动画）
- ⏳ 等待中（灰色）
- 点击某步骤可展开查看详细产出

**并行轨道（Phase 2）：**

```
     ├── ②A 小文 · 写稿 🔄 ──┐
① ✅ ┤                          ├── ④ 汇总
     └── ②B 小神 · 数据分析 🔄 ──┘
```

#### 6.5 焦点员工提示

输入框上方动态提示当前焦点员工：

```
💬 正在与小文对话
```

- 随上下文切换自动更新
- 用户看到即知道"系统认为我在跟谁说话"
- 打 `@` 弹出员工列表可切换

#### 6.6 群管理（轻量化）

群聊是**任务驱动的临时协作空间**，管理操作极简：

- **群名**：自动生成 `{场景名称}（{N}人）`，可自定义修改
- **成员管理**：顶部头像横排右端 `[+]` 添加，成员不可移除
- **生命周期**：活跃态（任务执行中）→ 已归档（任务完成后，可查看历史）
- **操作入口**：群名右侧 `···` 菜单：重命名、添加成员、归档

#### 6.7 Step Review 在群聊中的表现

```
┌─ 📋 小字提交了初稿 ──────────────────────┐
│  "两会代表提案数据深度分析..."（800字摘要）│
│  [查看全文]                               │
│  等待 @主编 确认                          │
│  [✅ 确认通过]  [✏️ 修改建议]  [🔄 重写]   │
└──────────────────────────────────────────┘
```

只有被 @的人或任务发起人能操作按钮。

#### 6.8 穆兰（Leader）的整合

- **默认：隐式调度** — 穆兰不加入群聊，在背后做意图分发。用户感知为"我说了一句话，群里的员工各自开始干活了"
- **复杂任务：显式协调** — 任务超过 3 个步骤或有并行分支时，穆兰以"主持人"角色加入，发结构化的任务分配消息

---

### 七、技术实现路径

#### 7.1 通信层：保持 SSE，不需要 WebSocket

AI 员工回复是任务驱动的，不存在多人同时推消息的实时需求。SSE 实现成本比 WebSocket 低一个数量级。在现有 `/api/chat/stream` 基础上扩展 `conversationId` 参数和 `senderId` 字段即可。

#### 7.2 Agent Assembly 适配

```
文件：src/lib/agent/assembly.ts
```

群聊场景需要为每个 participant 独立走 assembly pipeline，但**共享对话历史**：

```typescript
async function assembleGroupContext(
  participants: ConversationParticipant[],
  conversationHistory: ConversationMessage[],
  options: { orgId: string; includeCrossMemory: boolean }
): Promise<Map<string, AssembledAgent>>
```

性能优化：`Promise.all` 并发 + LRU 缓存（`employeeSlug → AssembledAgent`，TTL 5 分钟）。

#### 7.3 前端 Hook 拆分

`use-chat-stream.ts`（1032 行）不能再继续堆砌，拆分为：

```
src/hooks/
  use-chat-stream.ts          → 保留，底层 SSE 连接管理
  use-group-chat.ts            → 新建，群聊状态机
  use-chat-participants.ts     → 新建，参与者状态
```

`use-group-chat.ts` 核心状态：

```typescript
interface GroupChatState {
  participants: Map<string, ParticipantState>;
  activeSpeaker: string | null;
  executionQueue: string[];
  mode: 'serial' | 'parallel';
  phase: 'idle' | 'planning' | 'executing' | 'summarizing';
  focusEmployeeId: EmployeeId | null;
}
```

#### 7.4 API 路由设计

在现有 `stream/route.ts` 里通过 `conversation.isGroup` 判断走单聊还是群聊分支，复用 SSE 连接：

```
src/app/api/chat/
  stream/route.ts        → 现有，扩展 group 模式
  intent/route.ts        → 现有，扩展 create_group 意图
  intent-execute/route.ts → 现有，扩展多 participant 执行
```

#### 7.5 SSE 事件流格式（群聊）

```
data: {"type": "participant_start", "participantId": "xiaowen", "participantName": "小文"}
data: {"type": "text-delta", "content": "好的，", "senderId": "xiaowen"}
data: {"type": "text-delta", "content": "我来写这篇稿件", "senderId": "xiaowen"}
data: {"type": "participant_end", "participantId": "xiaowen"}
data: {"type": "participant_start", "participantId": "xiaojian", "participantName": "小检"}
data: {"type": "text-delta", "content": "我已审核完毕", "senderId": "xiaojian"}
data: {"type": "participant_end", "participantId": "xiaojian"}
data: {"type": "done"}
```

---

### 八、群聊实施计划

#### Phase 1：数据模型 + 串行接力（4-6 周）

| 任务 | 文件 |
|------|------|
| 新建 `conversation_participants` 表 | `src/db/schema/conversation-participants.ts` |
| 新建 `conversation_messages` 表 | `src/db/schema/conversation-messages.ts` |
| 改造 `saved_conversations` 加字段 | `src/db/schema/saved-conversations.ts` |
| 数据迁移（jsonb 展开为独立行） | 迁移脚本 |
| 新建 `group-dispatcher.ts` 调度引擎 | `src/lib/chat/group-dispatcher.ts` |
| 新建 `group-router.ts` 消息路由 | `src/lib/chat/group-router.ts` |
| SSE 事件类型扩展 | `src/lib/chat-utils.ts` |
| 手动建群 + 对话中拉人 UI | `src/app/(dashboard)/chat/` |
| 串行接力执行 | `src/app/api/chat/intent-execute/route.ts` 扩展 |

#### Phase 2：@提及 + Step Review + 并行执行（3-4 周）

| 任务 | 文件 |
|------|------|
| @提及触发建群 | `chat-panel.tsx` / `use-group-chat.ts` |
| 焦点员工路由引擎 | `src/lib/chat/group-router.ts` |
| Step Review 群内共享卡片 | `chat-panel.tsx` |
| 并行执行模式 | `src/lib/chat/group-dispatcher.ts` |
| 前端 Hook 拆分 | `src/hooks/use-group-chat.ts` |

#### Phase 3：任务自动建群 + 流程可视化（3-4 周）

| 任务 | 文件 |
|------|------|
| 场景模板关联群聊 | `workflow_templates` 扩展 |
| Mission 创建时自动建群 | Mission executor |
| 串行/并行流程可视化组件 | `src/components/shared/` |
| 穆兰隐式调度集成 | `intent-recognition.ts` 扩展 |

#### Phase 4：争议仲裁（实验性）

| 任务 | 文件 |
|------|------|
| 冲突检测机制 | `group-dispatcher.ts` 扩展 |
| 结构化仲裁步骤 | 工作流引擎步骤类型扩展 |
| 仲裁结果卡片 UI | `chat-panel.tsx` |

---

### 九、群聊验收标准

- [ ] `conversation_participants` 和 `conversation_messages` 表创建完成
- [ ] 现有一对一对话数据无损迁移
- [ ] 用户可手动选择 2-6 个员工创建群聊
- [ ] 群聊中消息按 `senderId` 正确归属展示
- [ ] 串行接力模式：员工按序执行，上下文自动传递
- [ ] @提及正确路由到指定员工
- [ ] 不 @时按焦点员工规则正确路由
- [ ] Step Review 在群聊中正确展示和操作
- [ ] SSE 事件流正确携带 `senderId`
- [ ] `npx tsc --noEmit && npm run build` 通过

---
---

## 第三部分：用户体系演进设计

> 来源：BMAD Party Mode 第二轮讨论（Winston / Amelia）
> 优先级：**P1**（不阻塞核心体验，但为商业化做准备）

### 一、演进路线

```
Phase 1（当前）        → Phase 2（SSO）         → Phase 3（外部对接）      → Phase 4（开放生态）
Email/Password 单一登录  钉钉/飞书/企业微信 SSO   外部平台用户体系双向同步    第三方开发者自定义员工
```

### 二、Phase 2：SSO 单点登录

#### 2.1 架构设计

VibeTide 作为 SP（Service Provider），外部平台作为 IdP（Identity Provider）：

```
外部平台登录 → OAuth 授权 → VibeTide /api/auth/sso/callback
  → 验证 token → 创建/关联 Supabase 用户 → 设置 session → 302 /home
```

现有 Email/Password **保留**作为 fallback 和开发环境认证方式。两个入口最终都落到 Supabase session，下游 `requireAuth()` 完全不用改。

```
登录页 → [Email/Password] ──→ Supabase Auth (现有)
      → [SSO 登录] ────────→ /api/auth/sso/callback → 创建/关联 Supabase 用户
```

#### 2.2 SSO Provider 抽象层

```
文件：src/lib/sso/providers/base.ts
```

```typescript
interface SsoProvider {
  name: string;
  getAuthUrl(state: string, redirectUri: string): string;
  exchangeToken(code: string): Promise<SsoTokenResult>;
  getUserInfo(accessToken: string): Promise<SsoUserInfo>;
  refreshAccessToken(refreshToken: string): Promise<SsoTokenResult>;
}

interface SsoTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

interface SsoUserInfo {
  externalId: string;
  name: string;
  email?: string;
  avatar?: string;
  orgId?: string;
}
```

各平台实现：

```
src/lib/sso/providers/
  base.ts              → 统一接口
  wechat-work.ts       → 企业微信
  feishu.ts            → 飞书
  dingtalk.ts          → 钉钉
```

| 平台 | OAuth 入口 | Token API | Userinfo API |
|------|-----------|-----------|-------------|
| 企业微信 | `open.weixin.qq.com/enterprise/oauth2` | `/gettoken` + `/getuserdetail` | `/user/get` |
| 飞书 | `open.feishu.cn/open-apis/authen` | `/authen/v1/oidc/access_token` | `/authen/v1/user_info` |
| 钉钉 | `oapi.dingtalk.com/connect` | `/gettoken` + `/getuserinfo` | `/topapi/v2/user/get` |

#### 2.3 API 路由

```
文件：src/app/api/auth/sso/[provider]/route.ts
```

```typescript
// GET /api/auth/sso/wechat-work
// 1. 生成 state + nonce，存入 cookie
// 2. 302 重定向到企业微信 OAuth URL

// GET /api/auth/sso/wechat-work/callback
// 1. 验证 state
// 2. 用 code 换 access_token
// 3. 获取用户信息
// 4. 查找或创建 Supabase 用户（通过 admin API）
// 5. 写入 sso_connections 表
// 6. 设置 Supabase session cookie
// 7. 302 → /home
```

#### 2.4 数据库扩展

```sql
-- sso_connections：外部身份映射
CREATE TABLE sso_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  provider VARCHAR(32) NOT NULL,          -- 'wechat_work' | 'feishu' | 'dingtalk'
  external_user_id VARCHAR(128) NOT NULL,
  external_org_id VARCHAR(128),
  access_token TEXT,                       -- encrypted
  refresh_token TEXT,                      -- encrypted
  token_expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, external_user_id)
);

-- user_profiles 扩展
ALTER TABLE user_profiles ADD COLUMN sso_providers JSONB DEFAULT '{}';
-- 格式: { "wechat_work": { "external_id": "xxx", "linked_at": "..." } }
```

**核心原则：不让外部平台的用户 ID 泄漏到 VibeTide 的业务逻辑中。** 所有业务表继续用 `user_profiles.id`，身份映射在 `sso_connections` 层完成。

### 三、Phase 3：外部平台对接

#### 3.1 对接模式

当客户要求将 VibeTide 的 AI 员工能力嵌入他们自己的编辑系统时：

```
外部系统 → OAuth 2.0 授权 → VibeTide API Token → 调用 VibeTide API
```

#### 3.2 API Token 体系

```sql
CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) NOT NULL,
  name VARCHAR(64) NOT NULL,
  token_hash VARCHAR(128) NOT NULL,        -- SHA-256 hash
  scopes TEXT[] NOT NULL,                   -- ['chat:read', 'chat:write', 'mission:read', ...]
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  organization_id UUID REFERENCES organizations(id) NOT NULL
);
```

#### 3.3 统一集成层

复用 CMS 集成层（`src/lib/cms/`）的模式，抽取通用 HTTP client：

```
src/lib/integrations/
  base-client.ts          → 通用 HTTP client + retry + error typing
  sso/
    providers/            → SSO Provider 实现
    callback-handler.ts   → 统一回调处理
```

### 四、用户体系实施计划

#### Phase 2：SSO（2-3 周）

| 任务 | 文件 |
|------|------|
| SSO Provider 接口定义 | `src/lib/sso/providers/base.ts` |
| 企业微信 Provider | `src/lib/sso/providers/wechat-work.ts` |
| 飞书 Provider | `src/lib/sso/providers/feishu.ts` |
| 钉钉 Provider | `src/lib/sso/providers/dingtalk.ts` |
| SSO callback 路由 | `src/app/api/auth/sso/[provider]/route.ts` |
| `sso_connections` 表 | `src/db/schema/sso-connections.ts` |
| 登录页加 SSO 入口 | `src/app/(auth)/login/page.tsx` |

#### Phase 3：外部对接（4-6 周）

| 任务 | 文件 |
|------|------|
| API Token 体系 | `src/db/schema/api-tokens.ts` |
| Token 管理 API | `src/app/api/auth/tokens/` |
| 权限 Scope 定义 | `src/lib/rbac-constants.ts` 扩展 |
| 统一集成层抽取 | `src/lib/integrations/base-client.ts` |
| 用户权限体系（主编/编辑/实习生） | RBAC 扩展 |

### 五、用户体系验收标准

- [ ] SSO 登录入口出现在登录页
- [ ] 企业微信/飞书/钉钉 OAuth 流程跑通
- [ ] SSO 登录后自动创建/关联 Supabase 用户
- [ ] `sso_connections` 表正确存储外部身份映射
- [ ] Email/Password 登录继续正常工作
- [ ] 下游 `requireAuth()` 无需修改
- [ ] `npx tsc --noEmit && npm run build` 通过

---

## 附录：综合实施优先级总览

| 优先级 | 模块 | 预计周期 | 核心价值 |
|--------|------|---------|---------|
| **P0** | 权限隔离 Schema + Migration | 1 周 | 内容隔离基础 |
| **P0** | 群聊数据模型（拆表 + 迁移） | 1-2 周 | 群聊的前置依赖 |
| **P0** | 群聊串行接力 + 手动建群 | 3-4 周 | 80% 业务价值 |
| **P1** | 权限隔离 DAL + Server Actions | 2 周 | 查询隔离生效 |
| **P1** | SSO Provider + 回调路由 | 2-3 周 | 企业客户准入 |
| **P1** | 群聊 @提及 + 焦点路由 | 2 周 | 协作流畅度 |
| **P2** | 权限隔离 UI 组件 + 管理页 | 2 周 | 可视化管理 |
| **P2** | 群聊并行执行 + 自动建群 | 3-4 周 | 复杂任务编排 |
| **P2** | 结构化争议仲裁（实验性） | 1-2 周 | 冲突解决 |
| **P3** | 导入导出 + 审计日志 | 2 周 | 数据迁移 |
| **P3** | 外部平台 API Token 对接 | 4-6 周 | 嵌入式集成 |
