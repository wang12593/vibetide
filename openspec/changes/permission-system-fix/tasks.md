## 1. 修复新用户默认权限分配

- [x] 1.1 修改 `src/lib/dal/auth.ts`：`ensureUserProfile()` 创建 profile 后自动查找 `slug: "editor"` 角色，插入 `user_roles` 行，失败时 log error 但不阻断注册
- [ ] 1.2 验证：注册新用户后检查 `user_roles` 表有正确的 editor 角色行

## 2. 管理后台入口权限守卫

- [x] 2.1 修改 `src/components/layout/app-sidebar.tsx`：移除 `hasAllPerms` 变量，`canAccessAdmin` 只检查 `system:manage_*` 权限，不再因空权限而放行
- [x] 2.2 `canSeeItem` 保留容错逻辑（空权限时显示所有菜单项，避免超时时空白侧边栏）

## 3. 数据隔离：自定义技能

- [x] 3.1 `getSkillsWithBindCount()` 的 `mode: "own"` 已正确过滤 `createdBy === userId`，无需修改
- [x] 3.2 `updateSkill` / `deleteSkill` 已调用 `assertContentOwnership()` 检查个人内容所有权，无需修改

## 4. 数据隔离：员工和场景

- [x] 4.1 审计 `src/lib/dal/employees.ts`：所有查询都有 `organizationId` 过滤
- [x] 4.2 审计 `src/lib/dal/workflow-templates.ts`：所有查询都有 `organizationId` 过滤

## 5. 内容管理页面

- [x] 5.1 保留 `admin/content-management/` 页面（已有空状态提示"暂无内容数据"）
- [x] 5.2 从 `ADMIN_ITEMS` 中移除"内容管理"入口（功能未完成，不应对用户可见）

## 6. 验证

- [x] 6.1 运行 `npx tsc --noEmit` 确保零类型错误
- [ ] 6.2 运行 `npm run build` 确保生产构建通过
- [ ] 6.3 手动验证：新注册用户有基础 editor 权限，可正常使用对话/任务功能
- [ ] 6.4 手动验证：普通用户侧边栏看不到管理后台入口
- [ ] 6.5 手动验证：不同账号的自定义技能相互独立
