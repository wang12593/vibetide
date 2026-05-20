# 穆兰(Mulan)员工推荐与多轮确认功能 — 技术方案

> 基于 Agent Skills 团队博弈三轮讨论的最终裁定
> 日期：2026-05-12

---

## 一、需求概述

| # | 需求 | 优先级 |
|---|------|--------|
| 1 | 穆兰员工推荐：多员工协作→自动创建群组；单员工→展示信息卡片（可跳转 /chat，带上下文） | P1 |
| 2 | 多轮对话确认机制：消息分发前必须与用户确认关键信息 | P1 |
| 3 | 工作流执行界面约束：所有流程在穆兰界面内完成，不得跳转外部页面 | P0 |
| 4 | 临时群组：任务完成后归档，不复用 | P1 |
| 5 | ChainProgress 进度显示修复 | P0 |

---

## 二、核心架构决策

### 2.1 意图识别增强

**方案：** `employees.length > 1` 直接走 LLM intent 解析，不使用连接词检测。

**理由：** 连接词匹配（并/同时/然后）存在中文分词边界问题，误判率高。LLM 一次调用即可拆分多步意图，无需二次正则匹配。

**实现位置：** `src/lib/agent/intent-recognition.ts`

```
Level 0: 正则匹配 → 单员工 → 直接返回
Level 0+: COMPLEX_TASK_RULES → 多员工 → 返回 steps[]
Level 1: LLM 判断 → 返回 steps[]（单或多）

判断逻辑：
  steps.length === 0  → general_chat（穆兰自己回答）
  steps.length === 1  → 单员工沟通
  steps.length >= 2   → 多员工协作 → 触发确认面板
```

**派生函数（不新增字段）：**

```typescript
function needsGroupConfirmation(steps: IntentStep[]): boolean {
  return steps.length > 1;
}
```

### 2.2 任务队列

**方案：** 使用 BullMQ（用户指定，内网部署限制不用 Inngest）。

**新增 queue：** `intent-dispatch`

```
用户确认 → 创建 N 个 BullMQ job
         → 每个 job: { employeeId, intent, context, organizationId }
         → worker 消费 → 调用 agent execution pipeline
         → 实时状态通过 SSE 推回穆兰界面
```

### 2.3 不引入的新抽象

| 被否决的方案 | 否决理由 |
|-------------|---------|
| FSM 状态机 | 现有散落状态够用，重构风险大于收益 |
| `groupConfirmation` 数据库字段 | UI 状态不应持久化，用派生函数 |
| 连接词降 confidence | 中文分词边界模糊，误判率高 |
| AI 摘要生成 | 取最近 15 条消息即可，零额外成本 |
| `target="_blank"` | 违反 SPA 惯例和需求 3 约束 |
| Inngest | 用户明确要求 BullMQ |

---

## 三、数据流（完整流程）

```
用户输入一句话
  │
  ▼
/api/chat/intent → recognizeIntent()
  │
  ├─ steps.length === 0 → 穆兰直接回复（general_chat）
  │
  ├─ steps.length === 1 → 单员工流
  │     │
  │     ▼
  │   弹出 Sheet 抽屉（三层信息）
  │     │
  │     ▼ 用户点击"开始对话"
  │   saveConversation()（带上下文）
  │     │
  │     ▼ SPA 导航到对话视图
  │
  └─ steps.length >= 2 → 多员工流
        │
        ▼
      IntentConfirmation 组件（Pipeline 视觉）
        │
        ▼ 用户确认
      createGroupChat()（已有 action）
        │
        ▼
      BullMQ intent-dispatch jobs 创建
        │
        ▼
      穆兰界面内展示执行进度
```

---

## 四、组件设计

### 4.1 IntentConfirmation（合并组件）

**位置：** `src/components/chat/intent-confirmation.tsx`（新建）

**内部状态机：**

```
idle → parsing → (单 intent) → direct_execute
               → (多 intent) → group_confirm → execute
               → (低 confidence) → clarify → re_parse
```

**多员工确认模式（Pipeline 视觉）：**

```
┌─────────────────────────────────────────┐
│  🎯 我理解您需要多位员工协作完成这个任务  │
│                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐          │
│  │ 小策 │→│ 小文 │→│ 小审 │          │
│  │策划  │  │写作  │  │审核  │          │
│  └──────┘  └──────┘  └──────┘          │
│                                         │
│  [ 修改顺序 ]         [ 确认开始 ]       │
└─────────────────────────────────────────┘
```

**关键设计：**
- 默认全选（用户说了要做，默认相信）
- 用户可取消某个节点（点 X 或 toggle）
- 每个节点可点击展开 Sheet 看详情
- 澄清模式复用 `ClarificationForm` 的交互模式

### 4.2 员工 Sheet 抽屉（单员工场景）

**位置：** `src/components/chat/employee-recommend-sheet.tsx`（新建）

**三层信息结构：**

```
┌─────────────────────────────────┐
│  ← 返回                         │
│                                 │
│  第一层：身份卡片（信任感）       │
│  ┌──────────────────────────┐   │
│  │  🧑‍💼 小文 · 内容写作专家    │   │
│  │  擅长：新闻稿、深度报道     │   │
│  │  技能：12 个              │   │
│  └──────────────────────────┘   │
│                                 │
│  第二层：任务理解摘要（对齐感）   │
│  ┌──────────────────────────┐   │
│  │  主题：垃圾分类             │   │
│  │  类型：深度报道             │   │
│  └──────────────────────────┘   │
│                                 │
│  第三层：补充建议（引导感）       │
│  💡 你可以这样补充：             │
│  · "重点对比上海和北京的政策"     │
│                                 │
│  ┌─────────────────────────┐    │
│  │    开始对话               │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

**技术作用：** Sheet 作为异步创建对话的容器。点击"开始对话"后：
1. `saveConversation()` 创建带上下文的对话（包含穆兰的分析结果）
2. SPA 导航到对话视图（`router.push`，不跳转外部页面）

---

## 五、上下文传递方案

### 5.1 单员工跳转带上下文

**方案：** 先创建 conversation 再导航（不使用 URL 参数，避免长度限制）。

```typescript
const handleOpenChat = async () => {
  const { id } = await saveConversation({
    employeeSlug: recommendedEmployee.employeeSlug,
    title: `穆兰推荐：${recommendedEmployee.taskDescription}`,
    messages: [
      { role: "system", content: `穆兰转交：用户需要${taskDescription}` },
      { role: "assistant", content: `你好！穆兰把你推荐给我来处理这个任务。` },
    ],
  });
  router.push(`/mulan/chat?conversation=${id}`);
};
```

**上下文内容（取最近 15 条消息，不做 AI 摘要）：**

```typescript
const recentMessages = messages.slice(-15);
const context = recentMessages
  .map(m => `${m.senderId}: ${m.content.slice(0, 100)}`)
  .join("\n");
```

### 5.2 临时群组归档

**生命周期：** 创建 → 活跃 → 归档（不物理删除）

**触发：** 最后一个 chain step 执行完毕 → BullMQ `chat/archive-group` job

**前端感知：**
- 侧边栏灰显 + "已归档" 标签（不静默消失）
- 归档后对话变为只读
- 7 天后移入"已完成"折叠区域

---

## 六、ChainProgress 进度显示修复

### 根因

`chat-panel.tsx` 中 `ChainProgress` 组件从 `gc.participants`（已完成的参与者列表）构建步骤条，而不是从 `chainProgress.total` 构建固定长度的步骤条。导致只显示已完成的步骤，未完成的不显示。

### 修复

**位置：** `src/app/(dashboard)/chat/chat-panel.tsx` 第 835-840 行

```typescript
// 修复前
const steps = (gc.participants as any[]).map((p) => ({
  label: p.status === "done" ? "完成" : "处理中",
  employeeName: p.participantName,
  status: ...,
}));

// 修复后
const totalSteps = gc.chainProgress?.total ?? participants.length;
const steps = Array.from({ length: totalSteps }, (_, i) => ({
  label: i < participants.length ? "完成" : i === participants.length ? "处理中" : "等待中",
  employeeName: participants[i]?.participantName ?? `步骤 ${i + 1}`,
  status: i < participants.length ? "done" : i === participants.length ? "active" : "pending",
}));
```

---

## 七、文件改动清单

| 文件 | 操作 | 内容 | 行数估计 |
|------|------|------|---------|
| `src/lib/agent/intent-recognition.ts` | 修改 | 多员工判断逻辑优化 | +15 |
| `src/app/api/chat/intent/route.ts` | 修改 | 移除非 leader 跳过确认逻辑 | 改 3 行 |
| `src/components/chat/intent-confirmation.tsx` | **新建** | 合并确认组件（Pipeline + 澄清） | ~80 |
| `src/components/chat/employee-recommend-sheet.tsx` | **新建** | 单员工 Sheet 抽屉 | ~60 |
| `src/app/(dashboard)/home/home-client.tsx` | 修改 | 集成 IntentConfirmation 和 Sheet | +40 |
| `src/app/(dashboard)/chat/chat-panel.tsx` | 修改 | ChainProgress 修复 | 改 10 行 |
| `src/lib/queue/workers/intent-dispatch.ts` | **新建** | BullMQ worker | ~40 |
| `src/app/actions/group-chat.ts` | 修改 | 添加归档逻辑 | +15 |
| **总计** | **3 个新文件 + 5 个修改** | | **~280 行** |

---

## 八、实施步骤

```
Phase 0（P0，立即执行）：
  Step 0-1: ChainProgress 进度显示修复（3 行代码）
  Step 0-2: 移除非 leader 跳过确认逻辑（改 1 行）

Phase 1（P1，核心功能）：
  Step 1-1: needsGroupConfirmation() 派生函数
  Step 1-2: BullMQ intent-dispatch queue 注册
  Step 1-3: IntentConfirmation 组件（状态机 + Pipeline 视觉）
  Step 1-4: EmployeeRecommendSheet 组件（三层信息）
  Step 1-5: 串联：chat input → LLM intent → IntentConfirmation → BullMQ job

Phase 2（P1，体验优化）：
  Step 2-1: 上下文传递（saveConversation 带上下文）
  Step 2-2: 临时群组归档（BullMQ job + 前端灰显）
  Step 2-3: 任务状态 UI 反馈

Phase 3（V1.1，已知限制）：
  Step 3-1: 员工间交接卡片（context passing）
  Step 3-2: 中途修改（job cancellation + re-queue）
```

---

## 九、已知限制（V1 不实现）

| 限制 | 原因 | 计划 |
|------|------|------|
| 员工间上下文交接 | 需要 agent 编排层支持 | V1.1 |
| 中途修改任务分配 | BullMQ job cancellation 交互设计复杂 | V1.1 |
| 群组模板复用 | 用户明确要求临时使用 | 不做 |
| AI 摘要生成 | 最近 15 条消息足够，额外 LLM 调用成本不值得 | 不做 |

---

## 十、团队博弈结论

三轮辩论中，**Amelia（高级工程师）** 的方案获得最多采纳（减法思维，每处改动都是最小必要路径），**Sally（UX 设计师）** 的 UI 方案获采纳 2 项（Pipeline 视觉、Sheet 三层结构）。

| 角色 | 获采纳决策点 | 核心理念 |
|------|------------|---------|
| 💻 Amelia | 4 项 | 减法——能用现有代码解决的，不引入新抽象 |
| 🎨 Sally | 2 项 | 用户感知——每个中间步骤都要有清晰的视觉反馈 |
| 🏗️ Winston | 0 项 | 方向正确但实现过度，被更简洁方案替代 |
| 📋 John | 裁定者 | 用 JTBD 原则驱动决策，砍掉所有不必要的加法 |
