## Why

当前权限系统存在多个严重 Bug：

1. **新注册账号也需要超管权限才能正常使用**：`ensureUserProfile()` 只设置 `role: "editor"` 但不插入 `user_roles` 行，导致新用户实际权限为空
2. **管理后台入口对所有用户可见**：侧边栏的管理后台模块应根据权限动态显示，而非对所有用户可见
3. **内容管理页面为空**：`/admin/content-management` 页面没有实际内容实现
4. **不同账号的数据不独立**：自定义技能、员工、场景等资源缺乏 `createdBy` 或 `organizationId` 过滤，导致不同账号可能看到/修改别人的资源
5. **权限粒度不够**：现有 60+ 权限常量但很多页面没有做细粒度检查，仅依赖 `isSuperAdmin` 全局判断

## What Changes

- 修复 `ensureUserProfile()`：新用户注册时自动在 `user_roles` 表中插入默认 `editor` 角色关联
- 管理后台入口只对有 `system:manage_*` 权限的用户显示
- 各模块 DAL 增加 `createdBy` / `organizationId` 过滤，确保数据隔离
- 完善 `admin/content-management` 页面实现或移除空路由
- 统一权限检查模式：服务端用 `requirePermission()`，客户端用 `<PermissionGate>`

## Capabilities

### Modified Capabilities
- `user-registration`: 新用户自动分配默认角色
- `admin-access`: 管理后台入口权限守卫
- `data-isolation`: 各模块数据按用户/组织隔离

### New Capabilities
- `fine-grained-permissions`: 各模块页面级权限检查

## Impact

- **认证流程**: `ensureUserProfile()` 增加角色分配逻辑
- **UI**: 侧边栏管理后台入口条件渲染
- **DAL**: 多个 DAL 函数增加 `createdBy` 过滤
- **Admin**: content-management 页面补充实现
- **回滚方案**: 所有修改向后兼容
