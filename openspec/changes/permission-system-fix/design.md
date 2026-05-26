## Context

### 权限体系现状

- `user_profiles.role`：legacy 字段（admin/editor/viewer），仅 seed 脚本使用
- `roles` + `user_roles`：RBAC 表，60+ 权限常量定义在 `rbac-constants.ts`
- `isSuperAdmin`：`user_profiles.is_super_admin` 布尔字段，拥有全部权限
- `ensureUserProfile()`：新用户注册时只设 `role: "editor"`，不插入 `user_roles`
- `getUserPermissions()`：查询 `user_roles` → `roles.permissions`，superAdmin 返回全部

### 已知 Bug 清单

1. 新用户 `user_roles` 为空 → `getUserPermissions()` 返回空数组 → 无法访问任何功能
2. `app-sidebar.tsx` 中 `ADMIN_ITEMS` 对所有用户渲染，无权限检查
3. `admin/content-management/page.tsx` 页面为空或未实现
4. 自定义技能（`skills` 表）的 `createdBy` 过滤不完整，不同用户可能看到别人的技能
5. 员工配置（`ai_employees`）的 `organizationId` 过滤不一致

## Goals / Non-Goals

**Goals:**
- 修复新用户注册后的默认权限分配
- 管理后台入口只对管理员显示
- 各模块数据按用户/组织隔离
- 内容管理页面补充或移除

**Non-Goals:**
- 不重新设计角色系统（复用现有 RBAC 表）
- 不实现自定义角色创建 UI（使用现有 3 个默认角色）
- 不修改超级管理员逻辑

## Decisions

### D1. 新用户注册自动分配角色

**决策**：在 `ensureUserProfile()` 中，创建 `user_profiles` 后，自动查找组织内 `slug: "editor"` 的角色，插入 `user_roles` 行。

**理由**：确保新用户有基础权限（editor 角色），不需要手动 seed。

### D2. 管理后台入口条件渲染

**决策**：在 `app-sidebar.tsx` 中，`ADMIN_ITEMS` 只在 `isSuperAdmin || hasAnyPermission(system:manage_*)` 时渲染。

**理由**：管理后台是管理功能，普通用户不应看到入口。

### D3. 数据隔离策略

**决策**：各模块 DAL 函数增加 `createdBy === userId` 或 `organizationId === orgId` 过滤。自定义技能用 `createdBy`，员工/场景用 `organizationId`。

**理由**：个人资源按 `createdBy` 隔离，组织资源按 `organizationId` 隔离。

### D4. 内容管理页面

**决策**：移除空的 `admin/content-management` 路由，该功能尚未规划实现。

**理由**：空页面会误导用户，移除后可在后续需求中重新实现。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 新用户角色分配失败 | try-catch 包裹，失败时 log error 但不阻断注册 |
| 过度隔离导致协作困难 | `visibility: "org"` 的资源对组织内所有用户可见 |
| 移除 content-management 路由影响书签 | 该页面为空，无用户会收藏 |
