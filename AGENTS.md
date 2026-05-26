# VibeTide — Agent 行为准则

## 12 条不可协商规则

以下规则源自 Karpathy 4-rule 基线 + claude-code-pro-pack 扩展，覆盖 AI 编程 Agent 的核心失败模式。

1. **编码前先思考。** 陈述假设，暴露权衡，不确定时先问不要猜。
2. **简单优先。** 只写解决问题所需的最少代码。不做推测性功能。
3. **外科手术式修改。** 只碰必须碰的。不"改进"相邻代码。匹配现有风格。
4. **目标驱动执行。** 先定义成功标准，再循环迭代直到验证通过。
5. **别让模型做非语言工作。** 重试、路由、限流——用确定性代码，不要用 prompt。
6. **硬性 token 预算。** 每个任务 4000 token，每个会话 30000 token。接近预算时总结并重新开始。
7. **暴露冲突，不要取平均。** 两处模式矛盾时选一个，解释原因，标记另一个待清理。
8. **先读后写。** 添加代码前先读附近的代码、导出、调用方、共享工具。
9. **测试以正确性为门槛，不是"通过"。** 断言绑定行为，不是形状。
10. **长操作需要检查点。** 多步重构在每步之间提交。
11. **惯例胜过新奇。** 代码库已有既定模式时，用那个模式。
12. **显式失败，不要静默。** 暴露部分失败、跳过的行、截断的输出、重试耗尽。

---

# OpenSpec（规范驱动开发）

本项目使用 OpenSpec 管理变更提案和规范。OpenSpec 已通过 `openspec init --tools trae` 安装并配置。

**何时使用 OpenSpec：**
- 新功能 / 新能力 → 先创建变更提案，再实现
- Breaking change / 架构变更 → 必须走 OpenSpec 流程
- 需求模糊 → 先用 `/opsx:explore` 探索，再 `/opsx:propose` 创建提案

**可用斜杠命令（Trae）：**
- `/opsx:propose` — 创建完整变更提案（proposal + design + specs + tasks）
- `/opsx:apply` — 按 tasks.md 实现代码
- `/opsx:explore` — 探索模式，思考问题、调研代码
- `/opsx:archive` — 归档已完成的变更

**CLI 常用命令：**
```bash
openspec list                    # 查看活跃变更
openspec list --specs            # 查看已有规范
openspec status --change <name>  # 查看变更状态
openspec validate <name>         # 验证变更
```

**配置文件：** `openspec/config.yaml`（含项目上下文和规则）
**变更目录：** `openspec/changes/`
**规范目录：** `openspec/specs/`

---

# Agent Skills (Google 工程纪律技能库)

本地安装路径: `C:\Users\wzh\.agent-skills\`

每个 skill 是 `skills/<name>/SKILL.md` 中的结构化 Markdown 工作流文件。当任务匹配时，按需读取对应 SKILL.md 并严格遵循其流程。

## Skill 发现路由

当任务到达时，根据开发阶段选择对应 skill:

```
任务到达
  ├── 不知道要做什么？ ────────→ interview-me
  ├── 有模糊概念，需要细化？ ──→ idea-refine
  ├── 新项目/功能/变更？ ──────→ spec-driven-development
  ├── 有 spec，需要拆任务？ ──→ planning-and-task-breakdown
  ├── 写代码？ ────────────────→ incremental-implementation
  │   ├── UI 工作？ ───────────→ frontend-ui-engineering
  │   ├── API 工作？ ──────────→ api-and-interface-design
  │   ├── 需要更好上下文？ ────→ context-engineering
  │   └── 高风险/陌生代码？ ───→ doubt-driven-development
  ├── 写/跑测试？ ─────────────→ test-driven-development
  ├── 出 bug 了？ ─────────────→ debugging-and-error-recovery
  ├── 审查代码？ ──────────────→ code-review-and-quality
  │   ├── 安全问题？ ──────────→ security-and-hardening
  │   └── 性能问题？ ──────────→ performance-optimization
  ├── 提交/分支？ ─────────────→ git-workflow-and-versioning
  ├── CI/CD 流水线？ ──────────→ ci-cd-and-automation
  ├── 写文档/ADR？ ────────────→ documentation-and-adrs
  └── 部署/上线？ ─────────────→ shipping-and-launch
```

## 可用 Skills 列表 (22个)

| 阶段 | Skill | 文件名 | 一句话说明 |
|------|-------|--------|-----------|
| 定义 | interview-me | interview-me/SKILL.md | 在任何计划/spec/代码之前，先挖掘用户真正想要什么 |
| 定义 | idea-refine | idea-refine/SKILL.md | 通过结构化发散/收敛思维细化想法 |
| 定义 | spec-driven-development | spec-driven-development/SKILL.md | 先写规格再写代码 |
| 计划 | planning-and-task-breakdown | planning-and-task-breakdown/SKILL.md | 分解为可验证的小任务 |
| 构建 | incremental-implementation | incremental-implementation/SKILL.md | 垂直切片，逐步构建 |
| 构建 | source-driven-development | source-driven-development/SKILL.md | 对照官方文档验证后再实现 |
| 构建 | doubt-driven-development | doubt-driven-development/SKILL.md | 对每个非平凡决策进行对抗性审查 |
| 构建 | context-engineering | context-engineering/SKILL.md | 在正确时间加载正确上下文 |
| 构建 | frontend-ui-engineering | frontend-ui-engineering/SKILL.md | 带无障碍的生产级 UI |
| 构建 | api-and-interface-design | api-and-interface-design/SKILL.md | 稳定接口与清晰契约 |
| 验证 | test-driven-development | test-driven-development/SKILL.md | 先写失败测试，再让它通过 |
| 验证 | browser-testing-with-devtools | browser-testing-with-devtools/SKILL.md | Chrome DevTools 运行时验证 |
| 验证 | debugging-and-error-recovery | debugging-and-error-recovery/SKILL.md | 复现→定位→修复→防护 |
| 审查 | code-review-and-quality | code-review-and-quality/SKILL.md | 五轴代码审查（正确性/可读性/架构/安全/性能） |
| 审查 | code-simplification | code-simplification/SKILL.md | 移除过度工程化设计 |
| 审查 | security-and-hardening | security-and-hardening/SKILL.md | OWASP 防护、输入验证、最小权限 |
| 审查 | performance-optimization | performance-optimization/SKILL.md | 先测量，只优化关键路径 |
| 交付 | git-workflow-and-versioning | git-workflow-and-versioning/SKILL.md | 原子提交，干净历史 |
| 交付 | ci-cd-and-automation | ci-cd-and-automation/SKILL.md | 每次变更的自动质量门禁 |
| 交付 | documentation-and-adrs | documentation-and-adrs/SKILL.md | 记录 Why，不只是 What |
| 交付 | deprecation-and-migration | deprecation-and-migration/SKILL.md | 安全移除旧代码 |
| 交付 | shipping-and-launch | shipping-and-launch/SKILL.md | 上线前检查清单、监控、回滚计划 |

## 7 个斜杠命令

| 命令 | 等价于 |
|------|--------|
| `/spec` | spec-driven-development |
| `/plan` | planning-and-task-breakdown |
| `/build` | incremental-implementation + test-driven-development |
| `/test` | test-driven-development |
| `/review` | code-review-and-quality |
| `/code-simplify` | code-simplification |
| `/ship` | shipping-and-launch |

## 使用方式

在对话中直接引用 skill 名称即可激活。例如:
- "按照 test-driven-development skill 来实现这个功能"
- "用 code-review-and-quality 的五轴审查来 review 这段代码"
- "执行 /spec 来定义需求"
- "执行 /review 来审查代码"

AI 会读取 `C:\Users\wzh\.agent-skills\skills\<name>\SKILL.md` 并严格遵循其中的工作流步骤。

## 核心行为准则（所有 skill 共享）

1. **先暴露假设** — 实现前先列出假设，让用户纠正
2. **主动管理困惑** — 遇到矛盾需求时立即 STOP，不要猜测
3. **合理时敢于反驳** — 不是 Yes Machine，有问题直接指出
4. **强制简洁** — 1000 行能做的事绝不用 100 行
5. **严守范围** — 只改被要求改的，不做"顺手清理"
6. **验证不可省略** — "看起来没问题"永远不够，必须有证据
