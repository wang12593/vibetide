# Vibetide 项目演进报告

> 从最初规划到当前状态的全面对比分析

---

## 一、项目演进总览

| 维度 | 最初规划（立项文档） | 当前状态 | 完成度 |
|------|---------------------|---------|--------|
| 核心功能模块 | 7 项需求（R-01~R-07） | 6/7 已实现 | **~85%** |
| 设计完成度 | 55 个设计项 | 41 完成 + 5 部分 + 9 未完成 | **74.5%** |
| Mock → 真实数据 | 18 个静态 mock 文件 | **100% 迁移到 DAL** | **100%** |
| 数据库规模 | 未定义 | 145+ 表 / 91 枚举 / 67 schema 文件 | — |
| 页面路由 | 未定义 | **50+ 路由**（7 主导航 + 43 隐藏/管理） | — |
| 安全指标 | SEC 系列要求 | 4 Critical + 6 High 安全问题 | **需修复** |

---

## 二、新增能力（立项文档中未规划）

### 1. 知识库管理模块（`/knowledge-bases`）

- 立项文档未规划，通过 OpenSpec 变更提案 `add-knowledge-base-module` 新增
- 完整 CRUD：创建/编辑/删除知识库
- 3 种文档摄入方式：手动粘贴、文件上传、URL 爬取（Jina Reader）
- Jina embeddings v3（1024 维）向量化 Pipeline
- 应用层余弦相似度检索
- Agent 集成：`kb_search` 工具自动注入

### 2. 产品落地页（Landing Page）

- 立项文档未规划，通过 `add-landing-page` 变更提案新增
- 7 个板块：Hero / AI 团队 / 四大引擎 / 工作流演示 / 数据统计 / 场景案例 / CTA
- Framer Motion 动画
- 未认证用户访问 `/` 自动展示落地页

### 3. 技能管理 UI + 技能包导入导出

- 原始设计：28 个技能硬编码在 `constants.ts`，只能通过 seed 脚本写入
- 当前：独立路由 `/skills`，支持可视化 CRUD、搜索筛选、分类浏览
- 技能包 ZIP 导入导出（新增 `skill_files` 表）
- 独立技能详情页 `/skills/[id]`
- 通过 3 个 OpenSpec 变更提案实现

### 4. 侧边栏品牌化重设计

- 原始：shadcn 默认样式，视觉粗糙
- 当前：品牌区域微光呼吸动效、分组主题色系、激活态渐变、暗色模式适配
- 通过 `redesign-sidebar-navigation` 变更提案实现

### 5. 穆兰（Mulan）智能调度系统

- 立项文档中只提了"主智能体统筹"
- 当前：独立子系统 `/mulan/chat` + `/mulan/missions`
- 三级意图路由：Level 0 规则引擎 → Level 1 轻量分类 → Level 2 完整规划
- 专用配置页 `/settings/mulan-config`

### 6. 群聊功能（部分完成）

- 立项文档未规划，通过 `permission-isolation-design.md` 新增
- 多员工协作对话：串行/并行/仲裁调度
- @提及、焦点员工衰减、进度可视化
- 引擎层已完成（group-router + group-dispatcher + 38 个测试）
- SSE 集成层断开，功能实际不可用

### 7. SSO 集成

- 立项文档未规划，后期新增
- 支持企业微信、飞书、钉钉 OAuth
- 路由：`/api/auth/sso/[provider]`
- 仅中间跳转，token exchange + 用户创建流程未完成

### 8. 权限隔离系统

- 立项文档只有基本的认证要求
- 当前：RBAC 细粒度权限（`system:manage_users` / `content:view_all` 等）
- 5 类内容（员工/工作流/知识库/技能/任务）新增 `createdBy` + `visibility` 字段
- `<PermissionGate>` 前端组件
- 8 个创建 Action 未自动填充隔离字段，隔离实际未生效

### 9. 研究工作台（`/research`）

- 立项文档未规划，独立模块
- 新闻搜索（地区 + 媒体 + 文章）
- 媒体机构管理、研究任务、研究话题
- 5 个 DAL 文件 + 5 个 schema 文件

### 10. 内网部署 + 模型适配

- 立项文档未指定具体模型
- 当前：Qwen3.5-35B-A3B via GPUStack（MoE 架构，35B/3B active）
- 已从多模型路由（Zhipu + Anthropic）简化为纯 OpenAI 兼容 API

---

## 三、加强/升级的能力

### 1. 数据层：从 Mock 到真实数据库

```
最初：18 个静态 Mock 文件（src/data/）  →  当前：60+ DAL 文件 + 145+ 数据库表
```

- 100% 迁移率：所有页面已从 `@/data/` 替换为 `@/lib/dal/`
- 189 处 DAL 引用分布在 100 个消费文件中
- 18 个 mock 文件成为死代码（仍保留在仓库中）

### 2. AI Agent 系统：从简单对话到 7 层智能组装

```
最初：单层 Prompt 对话  →  当前：7 层 Prompt + 17+ 工具 + 知识库检索
```

- 7 层 Prompt：身份 → 技能+熟练度 → 权限 → 敏感话题 → 知识 → 记忆(Top-10) → 输出+质量自评
- 17+ 工具注册：kb_search / web_search / content_generate 等
- 三层意图识别：规则引擎 → 轻量分类 → 完整规划

### 3. 工作流系统：从硬编码到数据库驱动

```
最初：SCENARIO_CONFIG 常量（10 个场景）  →  当前：workflow_templates 表（27+ 内置模板）
```

- B.1 统一架构：`workflow_templates` 成为场景唯一来源
- 12 种场景分类
- mission 双写 `scenario` slug + `workflowTemplateId`
- 可视化编辑器 `/workflows/[id]/edit`

### 4. CMS 集成：从无到完整管线

```
最初：无  →  当前：完整 CMS 集成层（src/lib/cms/）
```

- 9 个 APP 栏目 slug 严格锁定
- 文章入库 `publishArticleToCms()`
- 栏目同步 `syncCmsCatalogs()`
- 状态轮询（5 次指数退避）+ 失败重试（3 次）
- 每日 02:00 自动同步

### 5. 后台任务：从 Inngest 到 BullMQ

```
最初：Inngest（16 个事件驱动函数）  →  当前：BullMQ（6 队列 + 7 Worker）
```

- 更适合自部署场景
- 覆盖：内容管线 / 任务引擎 / AI 操作 / 监控 / 知识库向量化

### 6. UI 组件库：从基础到 Glass 设计体系

```
最初：shadcn 默认组件  →  当前：45 个共享组件 + Glass UI 设计语言
```

- GlassCard 毛玻璃效果
- 6 种 Button 变体（液态玻璃半透明风格）
- ESLint 强制禁止原生 HTML 标签
- 图表组件（Area / Bar / Donut / Gauge / Radar / HeatCurve）
- Framer Motion 动画体系

---

## 四、尚未完成/存在差距的部分

### P0 — 功能不可用

| 问题 | 说明 |
|------|------|
| 群聊 SSE 集成断开 | 引擎层已完成但 stream/route.ts → use-chat-stream.ts → chat-panel.tsx 链路未打通 |

### P1 — 功能不完整

| 问题 | 说明 |
|------|------|
| 权限隔离未生效 | 8 个创建 Action 未自动填充 createdBy + visibility |
| SSO 流程不完整 | 仅有中间跳转，未做 token exchange + 用户创建 |
| 数据反馈闭环（R-07） | 立项文档要求阅读量/互动率闭环优化，尚未实现 |
| B.2 清理未执行 | SCENARIO_CONFIG 常量未删除、下游未迁到 workflowTemplateId |

### Critical — 安全问题

| 问题 | 严重性 |
|------|--------|
| AI Chat 接口无认证 | Critical |
| Chat Stream 认证失败静默降级 | Critical |
| Mission interact POST 无认证 | Critical |
| 文章阅读器 XSS 风险 | Critical |
| 加密密钥硬编码 | High |

### 立项文档中未启动的需求

| 需求编号 | 内容 | 状态 |
|---------|------|------|
| R-07 | 数据反馈闭环（阅读量、互动率） | ❌ 未启动 |
| DEP-01~06 | 容器化部署/高可用/弹性伸缩 | ❌ 未启动 |
| SEC-LLM-01~04 | 安全过滤量化指标（违规拦截 ≥99%） | ⚠️ 部分实施 |

---

## 五、演进时间线

```
📋 立项阶段
  └─ 7 项核心需求（R-01~R-07）+ 安全需求 + 部署需求

🏗️ Phase 0 — 静态原型
  ├─ 18 个 mock 数据文件
  ├─ SCENARIO_CONFIG 硬编码常量
  └─ 纯前端展示，无数据库

📦 Phase 1 — 数据库落地
  ├─ 145+ 张表 / 91 枚举 / 67 schema 文件
  ├─ 60+ DAL 文件替代全部 mock
  ├─ CMS 集成层 MVP
  └─ Agent 7 层 Prompt 系统

🔄 Phase B.1 — Scenario/Workflow 统一
  ├─ workflow_templates 成为场景唯一来源
  ├─ 27+ 内置模板替代硬编码常量
  └─ 6 个 OpenSpec 变更提案全部交付

🔐 权限隔离 + 群聊
  ├─ RBAC 权限系统（Schema 层完成）
  ├─ 群聊引擎层完成（38 个测试）
  └─ SSE 集成层断开（功能不可用）

⏳ Phase B.2 — 待执行清理
  ├─ 删除 SCENARIO_CONFIG 常量
  ├─ 下游迁到 workflowTemplateId
  ├─ CMS appsecret 明文 → KMS
  └─ 3 个 skill subtemplate stub 待填充

⚠️ 当前瓶颈
  ├─ 4 个 Critical 安全漏洞
  ├─ 群聊 SSE 集成断开
  └─ 权限隔离集成层缺口
```

---

## 六、关键数据对比

| 指标 | 最初 | 当前 | 变化 |
|------|------|------|------|
| 数据库表 | 0 | 145+ | +145 |
| 枚举类型 | 0 | 91 | +91 |
| DAL 查询文件 | 0 | 60+ | +60 |
| 页面路由 | ~10 | 50+ | +40 |
| 共享组件 | ~10 | 45 | +35 |
| Mock 数据文件 | 18 | 18（死代码） | 0（已替代） |
| AI Agent Prompt 层 | 1 | 7 | +6 |
| 内置技能 | 28（硬编码） | 28+（数据库） | 管理化 |
| 场景模板 | 10（常量） | 27+（数据库） | +17 |
| 后台任务 | 0 | 16 | +16 |
| 安全漏洞 | — | 4 Critical | 需修复 |

---

## 七、总结

项目已完成初始规划的 **~80%**，核心 AI 员工体系、对话系统、知识库、技能管理、CMS 集成、工作流引擎等基础架构已全部落地，并超额交付了 **10 项立项文档未规划的新能力**（知识库、落地页、技能管理 UI、穆兰调度、群聊引擎、SSO、权限隔离、研究工作台、内网部署、侧边栏品牌化）。

数据层实现了 **100% 的 Mock → DAL 迁移**，从纯前端原型演进为完整的全栈应用。

当前最大瓶颈：
1. **4 个 Critical 安全漏洞**（AI Chat 无认证、XSS、硬编码密钥）
2. **群聊 SSE 集成断开**（引擎层完成但链路未打通）
3. **权限隔离集成层缺口**（Schema 完成但 Action 未接入）
