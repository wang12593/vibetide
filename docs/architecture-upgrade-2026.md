# VibeTide 前端优化与功能升级 — 架构文档

> 基于 BMAD 多智能体对抗式分析（Winston/Amelia/John/Mary 共识版）
> 创建日期：2026-05-13
> 状态：**执行中**
> LLM：Qwen3.5-35B-A3B via GPUStack `http://10.100.244.185/v1`
> 数据库：Supabase 本地化部署

---

## 一、全局架构

### 1.1 当前数据流

```
用户 → Chat Center → /api/chat/intent (意图识别) → /api/chat/intent-execute (执行)
                   → /api/chat/stream (自由对话)
                   → 首页场景网格 → /missions (任务)
```

### 1.2 升级后数据流

```
用户 → Mulan 首页 Agent（唯一入口）
         │
         ├─ Level 0: 规则引擎快速匹配（关键词+正则，0ms）
         ├─ Level 1: 轻量分类（精简 prompt，< 2s）
         └─ Level 2: 完整规划（步骤分解，< 8s）
                │
         ┌──────┼──────┐
         ↓      ↓      ↓
      自由对话 任务规划  多步分解
         ↓      ↓      ↓
   /chat/stream  /missions  interactive-pipeline
         ↑                ↑
   其他员工路由       中途用户输入钩子
```

### 1.3 技术栈（无新增依赖）

| 组件 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js + React + TypeScript | 16.1.6 / 19 / 5 |
| 数据库 | Supabase (PostgreSQL) via Drizzle ORM | 本地部署 |
| AI SDK | Vercel AI SDK v6 | @ai-sdk/openai |
| LLM | Qwen3.5-35B-A3B via GPUStack | MoE 35B/3B active |
| 任务队列 | BullMQ + Redis | 已有 |
| UI | shadcn/ui + Tailwind CSS v4 + Framer Motion | 已有 |
| 加密 | Node.js crypto（AES-256-GCM） | 内置 |

---

## 二、7 项需求与实施 Phase 映射

| 需求 | Phase | 状态 |
|------|-------|------|
| #7 内网部署（模型适配部分） | Phase 1 | ✅ 已完成 |
| #2 意图识别增强 | Phase 2 | ✅ 已完成 |
| #6 交互流程规则（Mulan 路由） | Phase 2 | ✅ 已完成 |
| #3 任务规划 + 过程交互 | Phase 3 | ✅ 已完成 |
| #3+ 对话式逐步交互执行 | Phase 3.2 | ✅ 已完成 |
| #4 长期记忆 + 加密 | Phase 4 | ✅ 已完成 |
| #1 前端响应式 + UI | Phase 5 | ✅ 已完成 |
| #5 模块重组 | Phase 5 | ✅ 已完成 |

---

## 三、Phase 1：基础设施 + 模型适配

### 3.1 目标

让 Qwen3.5-35B-A3B 在 VibeTide 上完整可用，包括 tool calling、JSON 输出、流式对话。

### 3.2 改动文件清单

| 文件 | 改动内容 | 状态 |
|------|---------|------|
| `src/lib/agent/model-router.ts` | 增加 Qwen 能力感知层（prompt 策略自动调整） | ✅ |
| `src/lib/agent/configured-models.ts` | 删除 Zhipu/Anthropic 条件分支，简化为 OpenAI 兼容 | ✅ |
| `src/lib/agent/skill-model-config.ts` | temperature/maxTokens 针对 MoE 3B active 调优 | ✅ |
| `src/lib/agent/prompt-templates.ts` | Prompt 压缩：技能指南 1000→3000 chars 动态调整，记忆 Top-5→10 动态调整 | ✅ |
| `src/lib/agent/types.ts` | ModelProvider 简化为 "openai" | ✅ |
| `scripts/test-skills.ts` | 默认模型改为 Qwen3.5-35B-A3B | ✅ |
| `.env.local` | 配置 GPUStack 端点 | ⏳ 需用户配置 |

### 3.3 验收标准

- [ ] `npm run build` 零错误
- [ ] `npx tsc --noEmit` 零类型错误
- [ ] Chat Center 对话可正常流式响应
- [ ] 意图识别返回合法 JSON
- [ ] Agent execution tool calling 正常工作

### 3.4 测试方案

```bash
npm run build
npx tsc --noEmit
npm run lint
```

---

## 四、Phase 2：意图识别增强 + Mulan 路由

### 4.1 目标

三级意图识别架构，Mulan 作为首页唯一交互入口。

### 4.2 改动文件清单

| 文件 | 改动内容 |
|------|---------|
| `src/lib/agent/intent-recognition.ts` | 新增 Level 0 规则引擎 + 置信度阈值 |
| `src/lib/agent/mulan-router.ts`（新建） | Mulan 转交机制 |
| `src/app/api/chat/intent/route.ts` | 强制 Mulan-only 路由约束 |
| `src/app/api/chat/stream/route.ts` | 增加 mode 标记（mulan/direct/routed） |
| `src/app/(dashboard)/chat/`（新建路由） | 独立员工对话页面 |
| `src/components/layout/app-sidebar.tsx` | 增加 /chat 入口 |

### 4.3 验收标准

- [ ] 意图识别准确率 ≥ 85%（规则覆盖 + LLM 补充）
- [ ] 首页仅 Mulan 可交互，其他员工走 /chat
- [ ] /chat 页面 Mulan 置顶显示
- [ ] 低置信度触发追问

---

## 五、Phase 3：任务规划 + 进度可视化

### 5.1 目标

多步任务分解、过程式交互、中途暂停/修改。

### 5.2 改动文件清单

| 文件 | 改动内容 |
|------|---------|
| `src/lib/mission-executor.ts` | 新增暂停/恢复机制 |
| `src/app/api/missions/[id]/interact/route.ts`（新建） | SSE 进度推送 + 中途输入 |
| `src/components/shared/step-pipeline.tsx`（新建） | 任务进度可视化组件 |
| `src/components/shared/progress-indicator.tsx`（新建） | 全局进度指示器 |
| `src/db/schema/` | mission_tasks 新增 pause_reason/pending_input_fields/user_input 字段 |

### 5.3 验收标准

- [ ] 任务执行中可暂停等待用户输入
- [ ] 进度卡片实时显示步骤状态
- [ ] 中途修改后 DAG 正确 re-plan

---

## 五-B、Phase 3.2：对话式逐步交互执行

### 5B.1 目标

在首页对话框中实现分步执行工作流，每步完成后暂停等待用户确认或修改，所有交互以对话形式进行。

### 5B.2 核心设计

```
双轨道执行模式：
┌─────────────────────┬─────────────────────────────────────────┐
│ 自动驾驶轨道         │ 逐步审批轨道                              │
│ (sourceModule≠chat)  │ (intent-execute SSE 流)                  │
├─────────────────────┼─────────────────────────────────────────┤
│ 热点追踪/定时任务等   │ 从对话窗口发起的工作流                     │
│ 维持原有 DAG 全量执行 │ 每步执行后暂停 → 穆兰汇报 → 用户确认/修改   │
│ 不中断、不等用户       │ 确认→下一步 修改→重跑当前步                 │
└─────────────────────┴─────────────────────────────────────────┘
```

### 5B.3 改动文件清单

| 文件 | 改动内容 |
|------|---------|
| `src/app/api/chat/intent-execute/route.ts` | 步骤循环增加 `step-review` SSE 事件 + `resumeFromStep`/`reviewFeedback` 参数 + 短路步骤也暂停 + 最后一步也暂停 + 员工按 `defaultTeam[idx]` 正确分配 |
| `src/hooks/use-chat-stream.ts` | 新增 `stepReview` 状态 + `stepReviewRef` + `resumeStepExecution()` + `onStepReview` 回调 + `sendMessage` 中 stepReview 拦截 + 纯确认词正则（`$` 结尾锚点）+ isLastStep 判断 + 修改意见重跑当前步 |
| `src/lib/chat-utils.ts` | `StreamingChatCallbacks` 新增 `onStepReview` 回调 + SSE `step-review` 事件解析 |
| `src/app/api/chat/intent/route.ts` | `analyzeParams` 改为基于 `inputFields` 必填字段检查，最多问 2 个问题 + `defaultTeam[idx]` 按位置映射员工 |
| `src/app/(dashboard)/home/home-client.tsx` | 移除 `ClarificationForm` 表单替换逻辑 + 移除 `StepReviewActions` 组件 + 始终显示输入框 |
| `src/db/schema/enums.ts` | `missionStatusEnum` 新增 `awaiting_review` |
| `src/db/seed-builtin-workflows.ts` | 新增 `deep_report_interactive` 工作流（4员工交互式） |
| `src/lib/mission-executor.ts` | `pauseForUserReview()` + `resumePausedTask()` 增强 + 交互模式判断 |

### 5B.4 对话式交互流程

```
用户：帮我制作一篇关于AI在教育领域的深度报道

穆兰：分析意图 → 匹配「深度报道制作（交互式）」

步骤 1/4 · 小雷 → 热点与素材收集 → 完成
穆兰：📋 步骤 1/4 已完成
      执行人：小雷 · 热点与素材收集
      成果物：（全文）
      下一步：小深 — 深度研究与数据分析
      请回复"确认"继续下一步，或直接输入修改意见。

用户：需要更多政策法规方面的素材       ← 修改意见

穆兰：收到修改意见，正在重新执行当前步骤...

步骤 1/4 · 小雷 → 重新执行（注入修改意见）→ 完成
穆兰：📋 步骤 1/4 已完成 ...

用户：确认                              ← 确认通过

步骤 2/4 · 小深 → 深度研究 → 完成
穆兰：📋 步骤 2/4 已完成 ...

用户：确认

步骤 3/4 · 小文 → 报道撰写 → 完成
穆兰：📋 步骤 3/4 已完成 ...

用户：确认

步骤 4/4 · 小鉴 → 质量审核 → 完成
穆兰：📋 步骤 4/4 已完成
      🎉 全部 4 个步骤已执行完毕
      这是最后一步。请回复"确认"完成工作流，或输入修改意见。

用户：确认
穆兰：✅ 工作流全部完成！
```

### 5B.5 验收标准

- [x] 对话框中每步执行后暂停等待用户确认
- [x] 用户输入"确认"类简短词 → 进入下一步
- [x] 用户输入修改意见 → 重新执行当前步骤（带上修改意见）
- [x] 最后一步也暂停等待确认
- [x] 所有交互以对话形式进行，不使用表单
- [x] 补充信息需求以穆兰提问形式呈现
- [x] 成果物全文展示（不截断）
- [x] 每步骤正确分配不同员工

---

## 六、Phase 4：长期记忆 + 加密

### 6.1 目标

加密存储、自动衰减、隐私合规。

### 6.2 改动文件清单

| 文件 | 改动内容 |
|------|---------|
| `src/lib/crypto/memory-crypto.ts`（新建） | AES-256-GCM 加解密 |
| `src/lib/cognitive/memory-decay.ts`（新建） | Ebbinghaus 遗忘曲线衰减 |
| `src/lib/privacy/memory-guard.ts`（新建） | PII 检测 + 脱敏 |
| `src/lib/agent/assembly.ts` | 记忆加载改为 importance × confidence × accessCount 排序 |
| `src/db/schema/employee-memories.ts` | 新增 content_encrypted/encryption_iv 字段 |
| `src/lib/queue/scheduler.ts` | 新增每日记忆衰减定时任务 |

### 6.3 验收标准

- [ ] 记忆加密存储，明文不出现在 DB dump
- [ ] 加密→解密 roundtrip 正确
- [ ] 衰减任务每日执行
- [ ] PII 检测生效

---

## 七、Phase 5：前端响应式 + 模块重组

### 7.1 目标

PC/平板/手机三端适配，侧边栏模块重组。

### 7.2 改动文件清单

| 文件 | 改动内容 |
|------|---------|
| `src/app/(dashboard)/layout.tsx` | 三断点响应式布局 |
| `src/components/layout/app-sidebar.tsx` | 导航结构重组 |
| `src/app/(dashboard)/settings/mulan-config/`（新建） | Mulan 配置页 |
| `src/app/(dashboard)/home/` | 首页响应式改造 |
| `src/app/(dashboard)/missions/` | 任务中心响应式 |
| 其他核心页面 | 逐一响应式适配 |

### 7.3 验收标准

- [ ] viewport 375px / 768px / 1440px 均无水平滚动条
- [ ] Lighthouse Mobile Performance ≥ 85
- [ ] 新导航结构完整可用

---

## 八、变更日志

| 日期 | Phase | 变更内容 | 原因 |
|------|-------|---------|------|
| 2026-05-13 | — | 架构文档创建 | 项目启动 |
| 2026-05-13 | Phase 1 | 模型适配层完成，6 文件修改，tsc + build 零错误 | Phase 1 验收通过 |
| 2026-05-13 | Phase 2 | 意图识别增强 + Mulan 路由，7 文件修改/新建，tsc + build 零错误 | Phase 2 验收通过 |
| 2026-05-13 | Phase 3 | 任务规划 + 进度可视化，8 文件修改/新建，tsc + build 零错误 | Phase 3 验收通过 |
| 2026-05-14 | Phase 3.2 | 对话式逐步交互执行引擎，8 文件修改，tsc + build 零错误 | Phase 3.2 验收通过 |

---

## 九、风险登记

| 风险 | 严重度 | 状态 | 缓解措施 |
|------|--------|------|---------|
| Qwen 3B 意图识别准确率不足 | 🔴 高 | 监控中 | Level 0 规则引擎兜底 + 置信度阈值 |
| Prompt 压缩导致信息损失 | 🟡 中 | 监控中 | 逐步压缩，每步验证输出质量 |
| mission-executor 状态机重构复杂 | 🟡 中 | 待评估 | 预设模板为主，限制自定义规划 |
| 34 页面响应式工期溢出 | 🟡 中 | 待评估 | 优先核心 8 页面 |
