## Context

### 当前侧边栏导航

`app-sidebar.tsx` 中 `NAV_ITEMS` 有 7 个一级入口：首页、对话、任务、员工、技能、场景、知识。`MORE_ITEMS` 有 1 个入口（穆兰配置）。`ADMIN_ITEMS` 有 4 个入口。

### 首页能力配置

`home-client.tsx` 中 `renderConfigSection()` 渲染员工/知识库/工作流 3 个 Tab 的配置面板，通过 `configExpanded` 控制展开收起。当前代码中 `renderHistorySection()` 已定义但未使用。

## Goals / Non-Goals

**Goals:**
- 侧边栏一级只保留首页 + 对话 + 历史记录
- 管理/配置类入口收起到"更多"折叠菜单
- 首页隐藏能力配置模块

**Non-Goals:**
- 不修改管理后台入口
- 不删除 `renderConfigSection` 代码（只不渲染）
- 不修改权限系统

## Decisions

### D1. 侧边栏一级导航

保留 3 个一级入口：首页、对话、历史记录。历史记录点击后展开子菜单（对话历史、任务历史），或跳转到 `/chat` 页面的历史 Tab。

### D2. "更多"菜单

将任务、员工、技能、场景、知识 5 个入口移入"更多"折叠子菜单，使用 Popover 展示（与现有"穆兰配置"入口同级）。

### D3. 首页配置隐藏

直接注释掉 `renderConfigSection()` 的调用，不删除代码。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 用户找不到配置入口 | "更多"菜单有明确的展开按钮，配置入口完整保留 |
| 历史记录入口用户不习惯 | 使用常见的时钟图标 + Tooltip 提示 |
