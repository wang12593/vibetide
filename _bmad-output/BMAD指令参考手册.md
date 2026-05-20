# BMAD Method 指令参考手册

> VibeTide 项目 — BMAD Method v6.6.0 完整指令清单
>
> 更新日期：2026-05-12

---

## 快速入门

在 Trae IDE 中直接对我说以下指令即可触发对应的 BMAD 能力。**指令不区分大小写**，支持模糊匹配。

**日常 90% 的场景只需要记住这 5 个：**

| 指令 | 用途 |
|------|------|
| `"bmad help"` | 不知道做什么时问它 |
| `"quick dev [需求]"` | 快速开发任何功能 |
| `"创建 PRD"` | 写需求文档 |
| `"创建架构文档"` | 设计技术方案 |
| `"叫 [Agent名] 来"` | 和特定角色对话 |

---

## 一、随时可用（Anytime）

这些指令在任何阶段都可以使用。

| 指令 | 菜单代码 | Skill 名称 | 说明 |
|------|----------|------------|------|
| `"bmad help"` | `BH` | `bmad-help` | 分析当前项目状态，推荐下一步操作 |
| `"quick dev [需求]"` | `QQ` | `bmad-quick-dev` | 快速开发：意图进、代码出，跳过规划直接实现 |
| `"correct course"` | `CC` | `bmad-correct-course` | 纠正方向：处理需求变更、重新规划 |
| `"document project"` | `DP` | `bmad-document-project` | 分析现有代码库生成文档 |
| `"生成项目上下文"` | `GPC` | `bmad-generate-project-context` | 扫描代码库生成 project-context.md |
| `"customize bmad"` | `BC` | `bmad-customize` | 自定义 Agent 行为、模板、配置 |
| `"索引文档"` | `ID` | `bmad-index-docs` | 索引文档目录，让 AI 了解可用文档 |
| `"拆分文档 [路径]"` | `SD` | `bmad-shard-doc` | 拆分过大文档（>500 行） |
| `"精馏文档 [路径]"` | `DG` | `bmad-distillator` | 压缩文档为 token 高效格式 |
| `"检查点预览"` | `CK` | `bmad-checkpoint-preview` | 查看 PR/分支的变更预览 |

---

## 二、Phase 1 — 分析阶段

用于项目早期探索和需求发现。

| 指令 | 菜单代码 | Skill 名称 | 说明 |
|------|----------|------------|------|
| `"头脑风暴"` | `BP` | `bmad-brainstorming` | 引导式头脑风暴，支持多种创意技法 |
| `"市场调研"` | `MR` | `bmad-market-research` | 市场分析、竞争格局、用户需求和趋势 |
| `"领域调研"` | `DR` | `bmad-domain-research` | 行业深度分析、专业术语和领域知识 |
| `"技术调研"` | `TR` | `bmad-technical-research` | 技术可行性、架构选项、实现方案研究 |
| `"创建产品简报"` | `CB` | `bmad-product-brief` | 精炼产品想法，生成简报文档 |
| `"PRFAQ 挑战"` | `WB` | `bmad-prfaq` | Working Backwards 方法验证产品概念 |

---

## 三、Phase 2 — 规划阶段

用于创建产品需求文档和 UX 设计。

| 指令 | 菜单代码 | Skill 名称 | 说明 | 必需前置 |
|------|----------|------------|------|----------|
| `"创建 PRD"` | `CP` | `bmad-create-prd` | 产品需求文档（12 步引导流程） | — |
| `"验证 PRD [路径]"` | `VP` | `bmad-validate-prd` | 验证 PRD 质量和完整性 | 创建 PRD |
| `"编辑 PRD [路径]"` | `EP` | `bmad-edit-prd` | 修改已有 PRD | 验证 PRD |
| `"创建 UX 设计"` | `CU` | `bmad-create-ux-design` | UX 设计文档（14 步引导流程） | 创建 PRD |

---

## 四、Phase 3 — 方案阶段

用于技术架构设计和任务拆分。

| 指令 | 菜单代码 | Skill 名称 | 说明 | 必需前置 |
|------|----------|------------|------|----------|
| `"创建架构文档"` | `CA` | `bmad-create-architecture` | 技术架构设计（8 步引导流程） | — |
| `"创建 Epic 和 Story"` | `CE` | `bmad-create-epics-and-stories` | 拆分 Epic 和用户故事 | 创建架构文档 |
| `"检查实施就绪度"` | `IR` | `bmad-check-implementation-readiness` | 检查 PRD/UX/架构/Epic 是否对齐 | 创建 Epic 和 Story |

---

## 五、Phase 4 — 实施阶段

用于 Sprint 管理和代码开发。

| 指令 | 菜单代码 | Skill 名称 | 说明 | 必需前置 |
|------|----------|------------|------|----------|
| `"Sprint 规划"` | `SP` | `bmad-sprint-planning` | 生成 Sprint 状态跟踪文件 | — |
| `"Sprint 状态"` | `SS` | `bmad-sprint-status` | 查看 Sprint 进度和下一步路由 | Sprint 规划 |
| `"创建 Story"` | `CS` | `bmad-create-story` | 创建下一个开发 Story（含完整上下文） | Sprint 规划 |
| `"验证 Story"` | `VS` | `bmad-create-story` | 验证 Story 是否准备就绪 | 创建 Story |
| `"开发 Story"` | `DS` | `bmad-dev-story` | 执行 Story 开发实现 | 验证 Story |
| `"代码审查"` | `CR` | `bmad-code-review` | 审查已完成的代码 | 开发 Story |
| `"生成 E2E 测试"` | `QA` | `bmad-qa-generate-e2e-tests` | 生成自动化 API/E2E 测试 | 开发 Story |
| `"回顾"` | `ER` | `bmad-retrospective` | Epic 完成后的回顾总结 | 代码审查 |

---

## 六、Agent 召唤

召唤特定角色的 AI Agent 进行对话。

| 指令 | 图标 | Agent 名称 | 角色定位 | 沟通风格 |
|------|------|------------|----------|----------|
| `"叫 Mary 来"` | 📊 | 业务分析师 | 战略分析、市场洞察、数据驱动 | 探险家式的叙述者 |
| `"叫 John 来"` | 📋 | 产品经理 | 需求挖掘、PRD、用户价值优先 | 侦探式的追问者 |
| `"叫 Winston 来"` | 🏗️ | 架构师 | 技术选型、架构设计、权衡分析 | 资深工程师白板讨论 |
| `"叫 Amelia 来"` | 💻 | 开发者 | TDD、精确编码、文件级实现 | 终端提示符般的精确 |
| `"叫 Sally 来"` | 🎨 | UX 设计师 | 用户体验、交互设计、同理心 | 电影导演式的场景描述 |
| `"叫 Paige 来"` | 📚 | 技术文档 | 文档编写、图表生成、质量审查 | 耐心的老师 |

召唤后 Agent 会以对应角色和你对话，并提供操作菜单。Agent 会保持角色直到你结束对话。

---

## 七、文档工具

| 指令 | 菜单代码 | Skill 名称 | 说明 |
|------|----------|------------|------|
| `"写文档 [描述]"` | `WD` | `bmad-agent-tech-writer` | 描述需求，Agent 按文档最佳实践生成 |
| `"生成 Mermaid 图"` | `MG` | `bmad-agent-tech-writer` | 根据描述生成架构图/流程图 |
| `"验证文档 [路径]"` | `VD` | `bmad-agent-tech-writer` | 检查文档质量，给出改进建议 |
| `"解释概念 [主题]"` | `EC` | `bmad-agent-tech-writer` | 用通俗语言解释技术概念 |
| `"更新文档标准"` | `US` | `bmad-agent-tech-writer` | 更新 Agent 的文档偏好 |

---

## 八、审查工具

| 指令 | 菜单代码 | Skill 名称 | 说明 |
|------|----------|------------|------|
| `"散文审阅 [路径]"` | `EP` | `bmad-editorial-review-prose` | 润色文字内容，三栏修改建议表 |
| `"结构审阅 [路径]"` | `ES` | `bmad-editorial-review-structure` | 审查文档结构，优化组织方式 |
| `"对抗审阅 [路径]"` | `AR` | `bmad-review-adversarial-general` | 质量保证审查，挑战薄弱环节 |
| `"边缘案例审查 [路径]"` | `ECH` | `bmad-review-edge-case-hunter` | 发现边缘案例和潜在问题 |

---

## 九、辅助工具

| 指令 | 菜单代码 | Skill 名称 | 说明 |
|------|----------|------------|------|
| `"派对模式"` | `PM` | `bmad-party-mode` | 多个 Agent 一起讨论，获取多视角 |
| `"高级引导"` | — | `bmad-advanced-elicitation` | 深度需求挖掘，探索隐含需求 |

---

## 十、完整开发流程参考

### 小改动 / Bug 修复

```
"quick dev [需求描述]"
```

一条指令搞定：澄清 → 计划 → 实现 → 审查 → 完成。

### 新功能 / 中等规模

```
"创建 PRD" → "创建架构文档" → "创建 Epic 和 Story"
→ "Sprint 规划" → "创建 Story" → "开发 Story" → "代码审查"
```

### 大功能 / 新模块

```
Phase 1: "头脑风暴" → "市场调研" / "技术调研"
Phase 2: "创建 PRD" → "验证 PRD" → "创建 UX 设计"
Phase 3: "创建架构文档" → "创建 Epic 和 Story" → "检查实施就绪度"
Phase 4: "Sprint 规划" → 循环 { "创建 Story" → "开发 Story" → "代码审查" } → "回顾"
```

### 需求变更 / 方向调整

```
"correct course"
```

BMAD 会评估变更影响，决定是更新 PRD、重写架构、还是调整 Epic。

---

## CLI 命令参考

在终端中使用的 BMAD 命令：

```bash
# 查看所有可用 Agent
bmad-method list

# 检查安装状态
bmad-method status

# 安装或更新 BMAD
bmad-method install

# 将项目代码扁平化为 XML（给 AI 提供完整上下文）
bmad-method flatten
```

---

## 输出目录结构

BMAD 生成的所有文档存放在 `_bmad-output/` 目录：

```
_bmad-output/
├── project-context.md              # 项目上下文（已生成 ✅）
├── planning-artifacts/             # 规划产物
│   ├── prd.md                      # PRD
│   ├── architecture.md             # 架构文档
│   ├── epics.md                    # Epic 和 Story
│   └── ux-design.md               # UX 设计
└── implementation-artifacts/       # 实施产物
    ├── sprint-status.yaml          # Sprint 状态跟踪
    ├── 1-1-feature-name.md         # Story 文件
    └── 1-2-another-feature.md      # Story 文件
```
