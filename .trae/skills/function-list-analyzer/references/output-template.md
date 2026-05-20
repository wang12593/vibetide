# Function List Output Template

## File Structure

Output file: `docs/plans/system-function-list.md` (or user-specified path)

## Document Template

```markdown
# {项目名称} — 系统功能清单

> 生成时间: {YYYY-MM-DD}
> 分析范围: 需求文档 + 实施计划 + 代码反向工程

## 模块总览

| 模块 | 已实现 | 部分实现 | 未实现 | 完成率 |
|------|--------|----------|--------|--------|
| M0 — {名称} | X | X | X | XX% |
| ... | ... | ... | ... | ... |
| **合计** | **X** | **X** | **X** | **XX%** |

---

## M0 — {模块名称}

### {子分类名称}

| 编号 | 功能名称 | 描述 | 状态 | 代码位置 | 需求来源 | 计划来源 |
|------|----------|------|------|----------|----------|----------|
| M0.F01 | {名称} | {一句话描述} | ✅ | `src/...` | {文档}§{章节} | {计划文档}#{任务号} |
| M0.F02 | {名称} | {一句话描述} | 🔧 | `src/...` | {文档}§{章节} | — |
| M0.F03 | {名称} | {一句话描述} | ❌ | — | {文档}§{章节} | — |

---

## Gap 分析

### 需求已定义但未实现

| 编号 | 功能名称 | 需求来源 | 建议优先级 |
|------|----------|----------|------------|
| ... | ... | ... | P0/P1/P2 |

### 计划已规划但未实现

| 编号 | 功能名称 | 计划来源 | 当前阻塞 |
|------|----------|----------|----------|
| ... | ... | ... | ... |

### 代码已实现但需求/计划未提及

| 编号 | 功能名称 | 代码位置 | 说明 |
|------|----------|----------|------|
| ... | ... | ... | 代码补充 |
```

## Status Definitions

- ✅ 已实现: Code exists, functional, matches requirement
- 🔧 部分实现: Code exists but incomplete (missing features, only UI shell, mock data only)
- ❌ 未实现: Defined in requirements/plans but no code found

## Granularity Guidelines

Each of the following counts as a separate function entry:
- Each exported server action function
- Each exported DAL query function
- Each page route (as a UI function)
- Each distinct UI interaction (dialog, form, toggle)
- Each API endpoint
- Each schema table (as data model capability)
- Each automated task/event handler
- Each agent tool
