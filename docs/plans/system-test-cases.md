# VibeTide — 系统测试用例

> 生成时间: 2026-05-19
> 分析来源: 代码反向工程 + 实施计划 V2 + 手动测试用例文档
> 覆盖范围: 全模块（10 个模块组）

## 测试概览

| 模块 | P0 | P1 | P2 | P3 | 合计 | 可自动化 |
|------|----|----|----|----|------|----------|
| M1 — 认证与权限隔离 | 12 | 18 | 8 | 2 | 40 | 95% |
| M2 — AI 员工管理 | 6 | 18 | 10 | 4 | 38 | 90% |
| M3 — 技能管理 | 4 | 16 | 8 | 4 | 32 | 90% |
| M4 — 任务与工作流 | 14 | 20 | 12 | 6 | 52 | 85% |
| M5 — 对话中心与 Agent | 6 | 14 | 10 | 6 | 36 | 70% |
| M6 — CMS 发布与文章 | 8 | 14 | 6 | 4 | 32 | 75% |
| M7 — 知识库 | 4 | 10 | 6 | 2 | 22 | 80% |
| M8 — 热点话题与素材 | 2 | 8 | 6 | 2 | 18 | 70% |
| M9 — 渠道与发布 | 4 | 6 | 4 | 2 | 16 | 75% |
| M10 — 管理后台与配置 | 6 | 10 | 4 | 2 | 22 | 80% |
| **合计** | **66** | **134** | **74** | **34** | **308** | **81%** |

## 测试环境要求

- **运行环境:** Node.js >= 18, PostgreSQL (Supabase)
- **数据库:** 测试专用 Supabase 项目 (与生产隔离)
- **测试账号:**
  - `admin@test.com` — 超级管理员 (isSuperAdmin=true)
  - `editor@test.com` — 编辑角色
  - `viewer@test.com` — 访客角色
  - `org2@test.com` — 组织 B 用户（跨组织测试）
- **依赖服务:** Tavily API key, Jina API key (测试环境 mock 即可)
- **Env 配置:** `.env.test.local` — 测试专用环境变量

---

## M1 — 认证与权限隔离

### 模块测试数据准备

| 数据项 | 说明 | 准备方式 |
|--------|------|----------|
| 测试用户 | admin / editor / viewer / org2 各一名 | seed 脚本 |
| 测试组织 | 组织 A（默认）、组织 B（隔离测试） | seed 脚本 |
| 测试角色 | admin(全权限) / editor / viewer | seed 脚本 |
| 测试内容 | 各组织下 personal + org 可见性内容各 2 条 | seed 脚本 |

### 1.1 登录/注册/登出

#### TC-M1-AUTH-001: 有效邮箱密码登录成功

| 字段 | 内容 |
|------|------|
| **测试类型** | E2E 测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **前置条件** | 测试用户已注册 |
| **关联代码** | [auth.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/auth.ts) → `signIn()` |

**测试步骤与预期结果：**

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 访问 `/login` | 显示登录表单（邮箱 + 密码输入框） |
| 2 | 输入正确邮箱和密码，点击「登录」 | 登录成功，跳转到 `/home` |
| 3 | 刷新页面 | 仍处于登录状态，显示侧边栏导航 |

**测试数据：** email=`admin@test.com`, password=`Test123!`

---

#### TC-M1-AUTH-002: 无效密码显示错误

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **关联代码** | [auth.ts](file:////c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/auth.ts) → `signIn()` |

**测试步骤与预期结果：**

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 调用 `signIn` 传入错误密码 | 返回 `{ error: "Invalid login credentials" }` |
| 2 | 确认未发生页面跳转 | URL 仍为 `/login` |

---

#### TC-M1-AUTH-003: 不存在的邮箱登录

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **关联代码** | [auth.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/auth.ts) → `signIn()` |

**测试数据：** email=`nonexistent@test.com`, password=`AnyPass1!`
**预期：** 返回 error 而非 redirect

---

#### TC-M1-AUTH-004: 注册成功

| 字段 | 内容 |
|------|------|
| **测试类型** | E2E 测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **关联代码** | [auth.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/auth.ts) → `signUp()` |

**测试步骤与预期结果：**

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 访问 `/register` | 显示注册表单 |
| 2 | 填写邮箱、密码、显示名，提交 | 注册成功，跳转到 `/home` |
| 3 | 数据库确认 | `auth.users` + `user_profiles` 记录已创建 |

---

#### TC-M1-AUTH-005: 注册重复邮箱

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [auth.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/auth.ts) → `signUp()` |

**预期：** 返回 error（Supabase 邮箱唯一约束错误）

---

#### TC-M1-AUTH-006: 登出

| 字段 | 内容 |
|------|------|
| **测试类型** | E2E 测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **关联代码** | [auth.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/auth.ts) → `signOut()` |

**预期：** 点击登出 → 跳转到 `/login`，访问 `/home` 会被重定向到登录页

---

#### TC-M1-AUTH-007: Session 过期重定向

| 字段 | 内容 |
|------|------|
| **测试类型** | E2E 测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **关联代码** | [demo-auth.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/demo-auth.ts) → `requireAuth()` |

**预期：** 清除 cookie 后访问 `/home` → 跳转到 `/login`

---

#### TC-M1-AUTH-008: 未登录访问受保护路由

| 字段 | 内容 |
|------|------|
| **测试类型** | E2E 测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期行为：** 未登录访问 `/home`、`/chat`、`/missions` 等 → 跳转到 `/login`

---

### 1.2 用户上下文 (DAL)

#### TC-M1-DAL-001: getCurrentUserAndOrg 返回正确数据

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [auth.ts (DAL)](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/dal/auth.ts) → `getCurrentUserAndOrg()` |

**预期：** 返回 `{ userId: string, organizationId: string }`，profile 不存在时自动创建

---

#### TC-M1-DAL-002: getCurrentUserAndOrg 未登录返回 null

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** supabase session 为空时返回 `null`

---

#### TC-M1-DAL-003: getCurrentUserProfile 返回完整权限

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** admin 用户返回含 `ALL_PERMISSIONS`（44 个），editor 返回部分权限

---

### 1.3 权限检查 (RBAC)

#### TC-M1-RBAC-001: requirePermission 通过

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **关联代码** | [rbac.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/rbac.ts) → `requirePermission()` |

**预期：** admin 用户调用 `requirePermission("system:manage_orgs")` → 返回 `{ userId, organizationId }`

---

#### TC-M1-RBAC-002: requirePermission 无权限拒绝

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** viewer 用户调用 `requirePermission("system:manage_orgs")` → 抛 "无权限执行此操作"

---

#### TC-M1-RBAC-003: requirePermission 未登录拒绝

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** 未登录调用 → 抛 "未登录"

---

#### TC-M1-RBAC-004: isSuperAdmin 检测

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** super_admin 用户 → true；普通用户 → false

---

#### TC-M1-RBAC-005: getUserPermissions 合并多角色权限

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** 用户有 editor + viewer 两个角色时，返回去重的权限并集

---

#### TC-M1-RBAC-006: hasAnyPermission 任意匹配

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `hasAnyPermission(user, org, ["menu:missions", "system:manage_orgs"])` → editor 返回 true

---

### 1.4 可见性过滤

#### TC-M1-VIS-001: buildVisibilityCondition mode=all

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [visibility-filter.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/dal/visibility-filter.ts) |

**预期：** SQL 条件包含 `orgId = ? AND (visibility = 'org' OR createdBy = ?)`

---

#### TC-M1-VIS-002: buildVisibilityCondition mode=own

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** SQL 条件包含 `orgId = ? AND createdBy = ?`

---

#### TC-M1-VIS-003: buildEmployeeVisibilityCondition 管理员

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** isAdmin=true → 仅 `orgId` 过滤

---

#### TC-M1-VIS-004: buildEmployeeVisibilityCondition 普通用户

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 非管理员 → `orgId AND (isPreset=1 OR createdBy=? )`

---

#### TC-M1-VIS-005: assertContentOwnership 管理员跳过

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** isAdmin=true → 即使非本人 personal 内容也不抛错

---

#### TC-M1-VIS-006: assertContentOwnership 非管理员操作他人个人内容

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** `visibility="personal"` 且 `createdBy !== userId` 时抛 "无权操作他人的个人内容"

---

#### TC-M1-VIS-007: assertContentOwnership org 内容任何人可操作

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `visibility="org"` → 不抛错（无论是否创建者）

---

### 1.5 内容可见性升级

#### TC-M1-UPG-001: 成功升级 personal → org

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [content-visibility.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/content-visibility.ts) → `upgradeContentVisibility()` |

**预期：** 创建者调用 → 更新成功，返回 `{ success: true }`，写入审计日志

---

#### TC-M1-UPG-002: 非创建者升级拒绝

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** 非创建者调用 → 抛 "只有创建者可以升级可见性"

---

#### TC-M1-UPG-003: 已 org 的内容拒绝重复升级

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `visibility` 已是 `"org"` → 抛 "已经是组织级，无需升级"

---

#### TC-M1-UPG-004: 不存在的 contentType

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** contentType ∉ TABLE_MAP → 抛 "Unknown content type: ..."

---

### 1.6 管理员操作

#### TC-M1-ADMIN-001: 创建组织

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [admin.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/admin.ts) → `createOrganization()` |

**预期：** admin 用户调用 → 创建成功，返回 `{ id }`

---

#### TC-M1-ADMIN-002: 非管理员创建组织拒绝

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** viewer 调用 → 抛 "无权限执行此操作"

---

#### TC-M1-ADMIN-003: 删除有成员的组织

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `memberCount > 0` 时调用 `deleteOrganization` → 抛错拒绝

---

#### TC-M1-ADMIN-004: 停用超级管理员

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `deactivateUser` 目标用户 isSuperAdmin=true → 抛 "不能停用超级管理员"

---

#### TC-M1-ADMIN-005: 删除系统角色

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `deleteRole` 目标角色 isSystem=true → 抛错拒绝

---

#### TC-M1-ADMIN-006: 创建用户三步操作

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** `createUser` → Auth 创建 + profile 插入 + 角色分配 三步成功

---

#### TC-M1-ADMIN-007: 跨组织越权（安全测试）

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** 组织 A 的管理员尝试通过 `upgradeContentVisibility` 操作组织 B 的内容 ID → 应拒绝或隔离

---

## M2 — AI 员工管理

### 2.1 员工 CRUD (employees.ts)

#### TC-M2-EMP-001: 创建员工成功

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [employees.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/employees.ts) → `createEmployee()` |

**预期：** 创建成功 → `isPreset=0`, `visibility="personal"`, `createdBy=当前用户`

---

#### TC-M2-EMP-002: 未登录创建员工

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** 未认证调用 → 抛 "Authentication required"

---

#### TC-M2-EMP-003: 绑定技能到员工

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [employees.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/employees.ts) → `bindSkillToEmployee()` |

**预期：** 绑定成功，写入 `employee_skills` 表

---

#### TC-M2-EMP-004: 绑定角色不兼容的技能

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 技能 `compatibleRoles` 不包含员工 `roleType` → 抛 "技能与员工角色不兼容"

---

#### TC-M2-EMP-005: 重复绑定技能

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 已存在绑定记录 → 抛 "技能已绑定"

---

#### TC-M2-EMP-006: 解绑核心技能

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [employees.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/employees.ts) → `unbindSkillFromEmployee()` |

**预期：** `bindingType === "core"` → 抛 "核心技能不可解绑"

---

#### TC-M2-EMP-007: 删除预设员工

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `deleteEmployee()` |

**预期：** `isPreset === 1` → 抛 "预设员工不可删除"

---

#### TC-M2-EMP-008: 克隆员工

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |
| **关联代码** | `cloneEmployee()` |

**预期：** 克隆成功 → 新员工属性与源一致，`isPreset=0`，技能绑定完整复制

---

#### TC-M2-EMP-009: updateAutoActions 缺少归属校验（已知缺陷）

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **关联代码** | [employees.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/employees.ts) → `updateAutoActions()` |

**预期：** 任何认证用户可修改任意员工的 autoActions → **这是已知缺陷，确认行为并记录**

---

#### TC-M2-EMP-010: 导入员工跨组织校验缺失（已知缺陷）

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **关联代码** | `importEmployee()` |

**预期：** 用户 A 传入组织 B 的 organizationId 也能创建 → **已知缺陷，确认行为并记录**

---

### 2.2 自定义员工 (custom-employees.ts)

#### TC-M2-CUS-001: 创建自定义员工

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 创建成功 → slug=`custom_{8位uuid}`, isPreset=0，技能/知识库批量绑定

---

#### TC-M2-CUS-002: 自定义员工名称校验

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**测试数据：**
- 空名称 → 抛 "员工名称不能为空"
- 超过 50 字符 → 抛 "员工名称不能超过50个字符"

---

#### TC-M2-CUS-003: 修改预设员工

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 操作 `isPreset=1` 的员工 → `assertCustomEmployeeOwnership` 抛错

---

#### TC-M2-CUS-004: 更新自定义员工全量替换技能

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** 更新技能列表 → 先删除旧绑定再插入新绑定，旧技能不再绑定

---

### 2.3 高级员工功能 (employee-advanced.ts)

#### TC-M2-ADV-001: 回滚员工配置

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `rollbackEmployeeConfig()` |

**预期：** 回滚到历史版本 → 11 个字段恢复快照值，创建回滚版本记录

---

#### TC-M2-ADV-002: 自动升降级逻辑

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |
| **关联代码** | `adjustAuthorityByPerformance()` |

**预期：**
- accuracy>=95 且 satisfaction>=90 且 tasksCompleted>=50 → 升级
- accuracy<60 或 satisfaction<50 → 降级
- 不在范围内 → 无变化

---

#### TC-M2-ADV-003: 创建技能组合（至少2个技能）

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 1 个技能 → 抛 "技能组合至少需要2个技能"

---

#### TC-M2-ADV-004: arrangeAuthorityByPerformance 跨组织风险

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** `adjustAuthorityByPerformance` 未校验组织归属 → 确认并记录为已知缺陷

---

### 2.4 员工 DAL

#### TC-M2-DAL-001: getEmployees 可见性过滤

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：**
- 管理员 → 返回组织内全部员工（含所有 personal）
- 普通用户 → 仅 preset + 自己创建的 personal

---

#### TC-M2-DAL-002: getEmployee 按 slug 查询

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 返回带技能列表的员工对象，不存在的 slug → undefined

---

#### TC-M2-DAL-003: getEmployeeFullProfile 完整档案

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** 返回含技能 + 知识库 + 记忆 + 绩效的完整档案

---

## M3 — 技能管理

### 3.1 技能 CRUD (skills.ts)

#### TC-M3-SKL-001: 创建技能成功

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [skills.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/skills.ts) → `createSkill()` |

**预期：** `type="custom"`, `visibility="personal"`，slug 自动生成

---

#### TC-M3-SKL-002: 创建技能名称/描述为空

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**测试数据：** `name=""` 或 `description=""` → 抛 "技能名称不能为空" / "技能描述不能为空"

---

#### TC-M3-SKL-003: 注册插件技能

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `registerPluginSkill()` |

**预期：** endpoint 验证通过 → authKey 加密存储，type="plugin"

---

#### TC-M3-SKL-004: 注册插件技能无效 URL

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `validatePluginUrl` 返回 invalid → 抛 "插件端点地址不合法"

---

#### TC-M3-SKL-005: 更新技能（版本快照）

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `updateSkill()` |

**预期：** 事务内先创建版本快照再更新，版本号自增

---

#### TC-M3-SKL-006: 删除内置技能

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `type === "builtin"` → 抛 "内置技能不可删除"

---

#### TC-M3-SKL-007: 删除被工作流引用的技能

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `findWorkflowsReferencingSkill` 有结果 → 抛 "该技能正在被工作流使用"

---

#### TC-M3-SKL-008: 强制删除被引用技能

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** `deleteSkill(id, { force: true })` → 跳过引用检查，删除成功

---

#### TC-M3-SKL-009: 回滚技能版本

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |
| **关联代码** | `rollbackSkillVersion()` |

**预期：** 事务内先快照当前状态，再恢复历史版本

---

#### TC-M3-SKL-010: 导入 SKILL.md 文件

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |
| **关联代码** | `importSkillMd()` |

**预期：** 文件大小 <= 500KB，frontmatter 解析正确，name/body 非空验证

---

#### TC-M3-SKL-011: 导出技能数量限制

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** `getSkillsForExport(ids)` → ids.length > 100 时限制或只取前 100

---

#### TC-M3-SKL-012: recordSkillUsageInternal 无认证风险

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** 导出函数但无认证，理论上可被客户端调用 → 确认并记录为安全风险（设计为 Inngest 专用）

---

### 3.2 技能 DAL

#### TC-M3-DAL-001: listSkillsForWorkflowPicker 过滤无 slug 技能

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 仅返回有 slug 的技能，`preferScopedSkillRows` 去重

---

#### TC-M3-DAL-002: getSkillsWithBindCount 可见性过滤

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** mode="own" → 仅创建者个人技能；mode="org" → 仅组织级技能

---

#### TC-M3-DAL-003: getSkillRecommendations 算法正确性

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** 角色匹配+40分 → 新分类+20分 → 内置+10分，最多 10 条，排除已绑定 + 角色不兼容

---

#### TC-M3-DAL-004: getSkillDetailPageData 聚合查询

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** 5 个并行查询（skill + bindings + files + versions + usageStats），错误容错

---

## M4 — 任务与工作流

### 4.1 任务 CRUD

#### TC-M4-MIS-001: 创建任务成功（startMission）

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **关联代码** | [missions.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/missions.ts) → `startMission()` |

**预期：** 创建成功 → 返回 Mission 对象，status=planning，写入 mission 表和 mission_tasks

---

#### TC-M4-MIS-002: 8 秒内重复提交去重

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 相同 title + userInstruction 在 8 秒内再次调用 → 返回已有 mission 而非创建新任务

---

#### TC-M4-MIS-003: 未登录创建任务

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** 未认证调用 → 抛 "Authentication required"

---

#### TC-M4-MIS-004: 归档非终态任务

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `archiveMission()` |

**预期：** status=planning → 抛 "只能归档已完成、失败或已取消的任务"

---

#### TC-M4-MIS-005: 删除运行中任务

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `deleteMission()` |

**预期：** status=executing → 抛 "不能删除运行中的任务"

---

#### TC-M4-MIS-006: 重试终态任务

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `retryMission()` |

**预期：** 复制参数，status 重置，创建新 mission

---

#### TC-M4-MIS-007: 重试非终态任务

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** status=executing → 抛 "只能重新执行已终止的任务"

---

#### TC-M4-MIS-008: 取消任务

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `cancelMission()` |

**预期：** 运行中任务 → 设置 status=cancelled

---

#### TC-M4-MIS-009: 删除 mission FK 完整性

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** 删除 mission 前清理 FK 引用（execution_logs, articles, verification_records, audit_records），CASCADE 删除 tasks/messages/artifacts

---

#### TC-M4-MIS-010: 批量删除事务安全

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `deleteMissions()` |

**预期：** 批量删除在 `db.transaction()` 内，单个失败时全部回滚

---

#### TC-M4-MIS-011: getMissionResult 不校验 orgId（已知安全问题）

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** 用户 A 可查询组织 B 的任意 missionId → **确认并记录**

---

### 4.2 任务状态机

#### TC-M4-SM-001: 完整状态流转

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** queued → planning → executing → consolidating → completed

---

#### TC-M4-SM-002: 执行中失败

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** 任务执行失败 → status=failed，记录错误日志

---

#### TC-M4-SM-003: Queued 超时清理

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **关联代码** | `cleanupStuckMissions()` |

**预期：** queued 超过 3 分钟 → status=failed

---

#### TC-M4-SM-004: Executing 子任务 18 分钟无活动

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** executing 子任务 18 分钟无活动 → 降级汇总，mission → failed

---

#### TC-M4-SM-005: 员工 working 超过 10 分钟

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** `resetStaleEmployees` → 员工→idle，in_progress 任务→failed

---

### 4.3 工作流模板管理

#### TC-M4-WFT-001: 创建工作流模板

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [workflow-engine.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/workflow-engine.ts) → `createWorkflowTemplate()` |

**预期：** 创建成功，写入 workflow_templates 表

---

#### TC-M4-WFT-002: 修改内置模板（非管理员）

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 普通用户调用 `updateWorkflow`（builtin=true）→ 抛 "内置工作流仅管理员可修改"

---

#### TC-M4-WFT-003: 空步骤工作流执行

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `executeWorkflow` 步骤数为空 → 抛 "该工作流未配置步骤"

---

#### TC-M4-WFT-004: 技能步骤规范化—无效 slug

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `normalizeSkillSteps()` |

**预期：** 空 slug → 抛 "工作流步骤必须绑定技能库中的技能"

---

#### TC-M4-WFT-005: 技能步骤规范化—slug 不存在

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 不存在的 skillSlug → 抛 "工作流步骤技能不存在于技能库"

---

#### TC-M4-WFT-006: 内置模板副本创建

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |
| **关联代码** | `createWorkflowFromTemplate()` |

**预期：** 虚拟 template 创建副本 → `isBuiltin=false, isEnabled=false`

---

### 4.4 从模板启动任务

#### TC-M4-LCH-001: startMissionFromTemplate 成功

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **关联代码** | [workflow-launch.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/workflow-launch.ts) → `startMissionFromTemplate()` |

**预期：** 验证输入 → 解析 leader/team → 创建 mission → 执行

---

#### TC-M4-LCH-002: 不存在的模板 ID

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 返回 `{ ok: false, errors: { _global: "模板不存在或无权访问" } }`

---

#### TC-M4-LCH-003: 输入验证失败

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `validateInputs` 失败 → 返回 `{ ok: false, errors: { field: msg } }`

---

### 4.5 工作流执行引擎

#### TC-M4-EXE-001: leaderPlanDirect 模板快路径

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** 有 workflowTemplateId 且 steps 非空 → 直接按模板分解为 mission_tasks（跳过 LLM）

---

#### TC-M4-EXE-002: leaderPlanDirect 无模板慢路径

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ❌ |

**预期：** 无模板 → LLM 调用 leader 分解任务（需人工验证分解质量）

---

#### TC-M4-EXE-003: Token 预算检查

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** token_budget 默认 200,000，超限时终止执行

---

### 4.6 工作流产物

#### TC-M4-ART-001: 插入工作流产物

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [workflow-artifacts.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/dal/workflow-artifacts.ts) |

**预期：** `insertWorkflowArtifact` → 写入成功，mission_id 外键关联

---

#### TC-M4-ART-002: 按 mission 列出产物

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** `listArtifactsByMission` → 返回该任务的所有产物，支持分页

---

## M5 — 对话中心与 Agent 系统

### 5.1 对话管理

#### TC-M5-CHT-001: 发送消息并保存对话

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [conversations.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/conversations.ts) → `upsertConversationMessages()` |

**预期：** 新建对话 → 保存消息 + summary，title 取首条消息前 50 字

---

#### TC-M5-CHT-002: 空消息数组

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `messages.length === 0` → 直接返回 null

---

#### TC-M5-CHT-003: Summary 截断

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** 每条消息取前 60 字，总长度截断 200 字

---

#### TC-M5-CHT-004: 获取最新对话

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `getLatestConversation()` |

**预期：** 按 employeeSlug 获取用户最新对话（按更新时间倒序）

---

#### TC-M5-CHT-005: 删除其他用户的对话

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **关联代码** | `deleteSavedConversation()` |

**预期：** 非创建者删除 → 查询时 WHERE userId = user.id 确保安全

---

#### TC-M5-CHT-006: 群聊创建（2-6 员工）

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [group-chat.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/group-chat.ts) → `createGroupChat()` |

**预期：** 2-6 员工 → 创建成功；1 个员工 → 抛错；7 个员工 → 抛错

---

#### TC-M5-CHT-007: 添加已存在的群聊成员

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |
| **关联代码** | `addGroupParticipant()` |

**预期：** 已存在 → onConflictDoNothing，静默返回

---

### 5.2 Agent 组装 (assembly.ts)

#### TC-M5-ASM-001: assembleAgent 完整组装

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 并行加载员工+技能+KB+记忆，7 层 prompt 构建，工具按 authority 过滤

---

#### TC-M5-ASM-002: observer 级别工具过滤

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** authorityLevel=observer → 空工具集

---

#### TC-M5-ASM-003: advisor 级别只读工具

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** authorityLevel=advisor → 仅 READ_ONLY_TOOL_NAMES

---

#### TC-M5-ASM-004: 知识库自动注入 kb_search

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 员工有 KB 绑定 → 自动注入 kb_search 描述符到工具集

---

#### TC-M5-ASM-005: 过滤 personal 知识库

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 非创建者的 personal KB → 跳过（不在知识库上下文中）

---

#### TC-M5-ASM-006: assembleGroupContext 缓存

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** 5 分钟内相同 orgId+slug 组合 → 命中缓存，不重复加载

---

### 5.3 Agent 执行 (execution.ts)

#### TC-M5-EXE-001: executeAgent 正常执行

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 构建 messages → generateText → parseStepOutput → 返回 AgentExecutionResult

---

#### TC-M5-EXE-002: 3 分钟超时

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** `AbortSignal.timeout(3 * 60 * 1000)` → 超时终止

---

#### TC-M5-EXE-003: maxSteps=20 限制

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** `stopWhen: stepCountIs(20)` → 20 个工具调用后停止

---

### 5.4 意图识别 (intent-recognition.ts)

#### TC-M5-INT-001: 问候语检测

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** "你好"、"Hi" 等 → general_chat, confidence=0.95

---

#### TC-M5-INT-002: Level 2 规则匹配

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 匹配 LEVEL0_RULES（12 条正则）且 confidence>=0.85 → 直接返回

---

#### TC-M5-INT-003: LLM 意图识别降级

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** 规则匹配 confidence<0.85 → 降级到 LLM 层（temperature=0, maxOutputTokens=1024）

---

#### TC-M5-INT-004: 意图识别 15s 超时

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** `Promise.race` + 15s setTimeout → 超时后 fallback 到 general_chat, confidence=0.5

---

#### TC-M5-INT-005: 意图步骤过滤

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** steps 中的 slug 不在可用员工列表 → 过滤掉；排除 leader

---

### 5.5 群聊路由与调度

#### TC-M5-RTE-001: @提及路由

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [group-router.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/chat/group-router.ts) → `resolveRoute()` |

**预期：** 消息含 @小文 → 路由到 xiaowen

---

#### TC-M5-RTE-002: 广播检测

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 消息匹配广播模式 → routeByBroadcast 返回 true

---

#### TC-M5-RTE-003: 30 秒焦点衰减

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** 超过 30 秒无交互 → 焦点清除，兜底到 fallback (xiaoce)

---

#### TC-M5-DSP-001: 串行执行计划

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [group-dispatcher.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/chat/group-dispatcher.ts) → `executeSerialPlan()` |

**预期：** 按 executionOrder 顺序执行，前一步输出传给下一步

---

#### TC-M5-DSP-002: 并行执行计划

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 所有员工同时执行 → `Promise.allSettled`，完成后可选 leader 汇总

---

#### TC-M5-DSP-003: 冲突仲裁

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ❌ |

**预期：** 多轮辩论式仲裁（默认 3 轮），需人工验证仲裁质量

---

## M6 — CMS 发布与文章管理

### 6.1 CMS 发布

#### TC-M6-CMS-001: 发布文章到 CMS 成功

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **关联代码** | [publish-article.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/cms/publish/publish-article.ts) → `publishArticleToCms()` |

**预期：** Feature flag → 加载文章 → 状态校验 → Mapper → hash → 落库 → HTTP 推送 → updateToSubmitted

---

#### TC-M6-CMS-002: Feature flag 禁用时拒绝

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [feature-flags.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/cms/feature-flags.ts) → `isCmsPublishEnabled()` |

**预期：** `VIBETIDE_CMS_PUBLISH_ENABLED !== "true"` → 返回 false，发布流程拒绝

---

#### TC-M6-CMS-003: 发布状态校验拒绝

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** article.publishStatus ∉ ["approved","publishing","published"] → 拒绝发布

---

#### TC-M6-CMS-004: 幂等发布（相同文章重复发布）

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `findLatestSuccessByArticle` 有成功记录且 `allowUpdate=false` → 直接返回

---

#### TC-M6-CMS-005: MODIFY 路径（allowUpdate=true）

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** 已有 CMS articleId + allowUpdate=true → 附加 articleId 触发 MODIFY

---

#### TC-M6-CMS-006: CMS 网络错误重试

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [client.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/cms/client.ts) → CmsClient |

**预期：** 网络错误/5xx/408/429 → 指数退避重试（最多 3 次，1s/2s/4s）

---

#### TC-M6-CMS-007: Auth/Schema 错误不重试

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [errors.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/cms/errors.ts) → `isRetriableCmsError()` |

**预期：** CmsAuthError / CmsSchemaError → isRetriable=false

---

#### TC-M6-CMS-008: Status Poll 轮询

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 5 次指数退避轮询 → 成功时 markAsSynced，超时→failed

---

#### TC-M6-CMS-009: Type 推导

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |
| **关联代码** | [article-mapper](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/cms/article-mapper/index.ts) → `determineType()` |

**预期：** body 非空且无 gallery→type1；gallery 图≥3→type2；externalUrl→type4；audioId/videoId→抛错（暂不支持）

---

#### TC-M6-CMS-010: 缺少 CMS 配置

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |
| **关联代码** | `requireCmsConfig()` |

**预期：** 缺少任一 env → throw

---

### 6.2 栏目同步

#### TC-M6-SYNC-001: 完整同步流程

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [sync.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/cms/catalog-sync/sync.ts) → `syncCmsCatalogs()` |

**预期：** getChannels → getAppList → getCatalogTree → flattenTree → reconcileCatalogs → 写入

---

#### TC-M6-SYNC-002: 差量对比—新增栏目

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `reconcileCatalogs()` |

**预期：** fetched 有、本地无 → inserts

---

#### TC-M6-SYNC-003: 差量对比—字段变更

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** fetched 有、本地有但不同 → updates（逐字段 diff）

---

#### TC-M6-SYNC-004: 差量对比—删除同步

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** 本地有、fetched 无且 deleteMissing=true → softDeletes

---

#### TC-M6-SYNC-005: CMS 返回 0 栏目保护

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** CMS 返回 0 栏目 → 不执行删除，保留本地数据

---

#### TC-M6-SYNC-006: DryRun 模式

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** dryRun=true → 只查不写，返回预估变更

---

### 6.3 文章管理

#### TC-M6-ART-001: 创建文章

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [articles.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/articles.ts) → `createArticle()` |

**预期：** body 包装到 content jsonb，自动计算 wordCount

---

#### TC-M6-ART-002: 文章状态流转

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `updateArticleStatus()` |

**预期：** draft → reviewing → approved → published（设 publishedAt）→ archived（设 archivedAt）

---

#### TC-M6-ART-003: 删除文章（硬删除）

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 物理删除，不可恢复

---

#### TC-M6-ART-004: 跨组织操作文章（已知安全问题）

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** articles.ts actions 无 org 过滤 → 任意 articleId 可操作 → **确认并记录为已知缺陷**

---

### 6.4 发布计划

#### TC-M6-PUB-001: 创建发布计划

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [publishing.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/publishing.ts) → `createPublishPlan()` |

**预期：** 创建成功，写入 publish_plans 表

---

#### TC-M6-PUB-002: 重新排期

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |
| **关联代码** | `reschedulePublishPlan()` |

**预期：** 更新 scheduledAt 成功

---

## M7 — 知识库

### 7.1 知识库管理

#### TC-M7-KB-001: 创建知识库

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [knowledge-bases.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/knowledge-bases.ts) → `createKnowledgeBase()` |

**预期：** 名称非空且 ≤100 字 → vectorizationStatus="pending" → 写同步日志

---

#### TC-M7-KB-002: 名称校验

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 空名称 → 抛 "知识库名称不能为空"；超过 100 字 → 抛错

---

#### TC-M7-KB-003: 删除知识库（含归属校验）

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `assertKnowledgeBaseOwnership` + `assertContentOwnership` → 删除成功

---

#### TC-M7-KB-004: 删除非本人知识库

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** personal 知识库非创建者删除 → `assertContentOwnership` 拒绝

---

### 7.2 知识库文档

#### TC-M7-DOC-001: 添加知识条目（手动粘贴）

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `addKnowledgeItem()` |

**预期：** chunkText → 插入 knowledge_items → 更新 KB 文档计数 → 触发向量化事件

---

#### TC-M7-DOC-002: URL 爬取

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | `crawlUrlIntoKB()` |

**预期：** fetchViaJinaReader → ingestDocument → 触发向量化事件

---

#### TC-M7-DOC-003: 无效 URL

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** `new URL()` 抛错 → 返回错误

---

#### TC-M7-DOC-004: Jina Reader 返回内容过短

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** 返回 < 50 字符 → 视为失败

---

### 7.3 分块与向量化

#### TC-M7-CHK-001: 分块—短文本

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [chunking.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/knowledge/chunking.ts) → `chunkText()` |

**预期：** 文本 < 500 字 → 单个 chunk

---

#### TC-M7-CHK-002: 分块—段落分割+贪心打包

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** > 800 字的段落按句子分割 → 在 [500, 800] 字范围内贪心合并 → 50 字符重叠

---

#### TC-M7-CHK-003: 向量化—批量 100 条

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [embeddings.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/knowledge/embeddings.ts) → `generateEmbeddings()` |

**预期：** 批量 100 条 → Jina embeddings-v3 (1024 dim) → 3 次重试，指数退避

---

#### TC-M7-CHK-004: 检索—余弦相似度排序

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [retrieval.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/lib/knowledge/retrieval.ts) → `searchKnowledgeBases()` |

**预期：** generateQueryEmbedding → 应用层余弦相似度 → top-K（默认 5）按 relevance 降序

---

#### TC-M7-CHK-005: 重建索引

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |
| **关联代码** | `reindexKnowledgeBase()` |

**预期：** 清除所有 embedding → status→pending → dispatch "kb/reindex-requested"

---

## M8 — 热点话题与素材

### 8.1 热点话题

#### TC-M8-HT-001: 抓取热点话题

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [hot-topics.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/hot-topics.ts) |

**预期：** 调用成功 → 返回结构化热点话题列表

---

#### TC-M8-HT-002: 话题评分算法

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** 4 维评分：sourceType + 关键词命中 + 时效性 + 引擎加成 + 中文来源加成

---

#### TC-M8-HT-003: 话题去重

| 字段 | 内容 |
|------|------|
| **测试类型** | 单元测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** `dedupeItems` → key=`{title.toLowerCase()}::{source.toLowerCase()}`，保留更新时间的条目

---

### 8.2 媒体资产

#### TC-M8-MED-001: 上传素材

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [assets.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/assets.ts) |

**预期：** 上传成功 → 写入 media_assets 表，权限校验

---

#### TC-M8-MED-002: 删除非本人素材

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** 非创建者删除 personal 素材 → 拒绝

---

## M9 — 渠道与发布

### 9.1 渠道管理

#### TC-M9-CHN-001: 创建渠道

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [channels.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/channels.ts) |

**预期：** 创建成功，组织隔离

---

#### TC-M9-CHN-002: 渠道状态变更

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** active → paused → active → setup，状态正确更新

---

### 9.2 审批/审核

#### TC-M9-APR-001: 提交审批

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [approvals.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/approvals.ts) |

**预期：** 提交审批 → 创建审批记录

---

#### TC-M9-APR-002: 审批通过/驳回

| 字段 | 内容 |
|------|------|
| **测试类型** | 集成测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 审批人操作 → 状态变更，触发后续流程

---

## M10 — 管理后台与配置

### 10.1 穆兰配置

#### TC-M10-MLN-001: 读取穆兰配置

| 字段 | 内容 |
|------|------|
| **测试类型** | E2E 测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [mulan-config.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/mulan-config.ts) |

**预期：** 访问 `/settings/mulan-config` → 显示模型/温度/maxTokens 等配置项

---

#### TC-M10-MLN-002: 修改配置保存

| 字段 | 内容 |
|------|------|
| **测试类型** | E2E 测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 修改配置并保存 → 保存成功无报错

---

### 10.2 CMS 映射配置

#### TC-M10-CMS-001: 触发栏目同步

| 字段 | 内容 |
|------|------|
| **测试类型** | E2E 测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |
| **关联代码** | [cms.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/cms.ts) → `triggerCatalogSyncAction()` |

**预期：** 点击「立即同步」→ 触发同步，显示同步进度

---

#### TC-M10-CMS-002: 查看同步日志

| 字段 | 内容 |
|------|------|
| **测试类型** | E2E 测试 |
| **优先级** | P2 |
| **可自动化** | ✅ |

**预期：** 切换到「日志」Tab → 显示同步日志列表

---

### 10.3 管理员页面

#### TC-M10-ADM-001: 用户管理（管理员可见）

| 字段 | 内容 |
|------|------|
| **测试类型** | E2E 测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** admin 访问 `/admin/users` → 显示用户列表；普通用户 → 403

---

#### TC-M10-ADM-002: 角色管理 CRUD

| 字段 | 内容 |
|------|------|
| **测试类型** | E2E 测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 创建/编辑/删除角色 → 预期行为（详见 admin.ts 测试用例）

---

### 10.4 页面路由验证（手动/自动化）

#### TC-M10-RTE-001: 全部受保护路由

| 字段 | 内容 |
|------|------|
| **测试类型** | E2E 测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**覆盖路由（30+ 条）：**
- 未登录访问 `/home`, `/chat`, `/missions`, `/ai-employees`, `/skills`, `/workflows`, `/knowledge-bases`, `/analytics`, `/articles`, `/publishing`, `/hot-topics`, `/media-assets`, `/settings/*`, `/admin/*` ...
- 预期：全部跳转到 `/login`

---

#### TC-M10-RTE-002: 落地页（未登录）

| 字段 | 内容 |
|------|------|
| **测试类型** | E2E 测试 |
| **优先级** | P1 |
| **可自动化** | ✅ |

**预期：** 未登录访问 `/` → 显示落地页（Hero + AI 团队 + 数据统计 + 能力展示 + 工作流 + 场景 + CTA）

---

#### TC-M10-RTE-003: 已登录跳转

| 字段 | 内容 |
|------|------|
| **测试类型** | E2E 测试 |
| **优先级** | P0 |
| **可自动化** | ✅ |

**预期：** 已登录访问 `/` → 跳转到 `/home`；已登录访问 `/login` → 跳转到 `/home`

---

## Gap 分析

### 无法自动化的测试场景

| 编号 | 场景 | 原因 | 建议 |
|------|------|------|------|
| G1 | AI 回复内容质量验证 | 需要人工判断回复是否贴合员工角色定位 | 通过对比测试 + 质量评分自动化辅助 |
| G2 | 群聊冲突仲裁质量 | 多轮辩论的决策质量需人工评估 | 定期抽样评审 |
| G3 | LLM 任务分解质量 | Leader 分解为子任务的合理性 | 对比已知模板分解 vs LLM 分解 |
| G4 | UI 视觉一致性验证 | 颜色/间距/动画效果需人工确认 | 视觉回归测试（Storybook + Chromatic） |
| G5 | 技能推荐算法实际效果 | 推荐结果是否符合领域专家预期 | A/B 测试 + 用户反馈收集 |

### 需求覆盖盲区

| 需求章节 | 描述 | 缺失的测试类型 |
|----------|------|----------------|
| SSO 登录 | 飞书/钉钉/企业微信 OAuth 登录 | 集成测试（依赖外部服务，需 mock） |
| Inngest 事件驱动 | 16 个后台函数的正确性 | 集成测试（依赖 Inngest SDK） |
| 多语言支持 | 目前全部中文 | (N/A — 当前版本无此需求) |
| 浏览器自动化工具 | 22 个 browser_* 工具 | 集成测试（需真实浏览器环境） |
| 频道顾问 (channel-advisors) | AB 测试 / 比较 / 创建 | E2E 测试 |
| 数据收集 (data-collection) | 来源管理 / 内容监控 | E2E + 集成测试 |

### 已知安全缺陷（需优先修复）

| 编号 | 描述 | 位置 | 严重程度 |
|------|------|------|----------|
| S1 | `updateAutoActions` 缺少归属校验 | [employees.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/employees.ts) L225-241 | 高 |
| S2 | `articles.ts` 所有 action 无 org 过滤 | [articles.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/articles.ts) | 高 |
| S3 | `getMissionResult` 不校验 orgId | [get-mission-result.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/get-mission-result.ts) | 中 |
| S4 | `importEmployee` 跨组织创建 | [employees.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/employees.ts) L366-427 | 中 |
| S5 | `adjustAuthorityByPerformance` 无组织校验 | [employee-advanced.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/employee-advanced.ts) | 中 |
| S6 | `deleteSkillCombo` 无组织校验 | [employee-advanced.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/employee-advanced.ts) | 低 |
| S7 | `bindKnowledgeBaseToEmployee` 无归属校验 | [employees.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/employees.ts) | 中 |
| S8 | `recordSkillUsageInternal` 无认证 | [skills.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/skills.ts) | 中 |
| S9 | `upgradeContentVisibility` 无 orgId 过滤 | [content-visibility.ts](file:///c:/Users/wzh/Desktop/vibetide-main/vibetide/src/app/actions/content-visibility.ts) | 中 |

## 测试框架选型建议

基于项目技术栈（Next.js 16 + TypeScript + Vitest/Drizzle）：

### 单元测试 / 集成测试

| 框架 | 用途 | 说明 |
|------|------|------|
| **Vitest** | 单元 + 集成测试 | 项目已使用，配置见现有 `*.test.ts` 文件 |
| **@supabase/supabase-js** mock | DB 层模拟 | 使用 `vi.mock()` 模拟 Supabase 客户端 |
| **Drizzle Test Utils** | DAL 测试 | 使用测试数据库或内存 SQLite 替代 |
| **AI SDK Mock** | Agent 测试 | Mock `generateText` 返回预定义输出 |

### E2E 测试

| 框架 | 用途 | 说明 |
|------|------|------|
| **Playwright** | 浏览器自动化 E2E | 已存在 `src/__tests__/pages-e2e.test.ts` 和 `page-operations.test.ts` |
| 支持移动端模拟 | 响应式验证 | `chromium.device('iPhone 13')` |

### 测试数据准备

| 工具 | 用途 |
|------|------|
| **Drizzle Seed** | `npm run db:seed` 已有 seed 脚本 |
| **专用测试 seed** | 补充测试专用数据：多组织、多角色、多可见性数据 |

---

## 测试数据 Seed 建议

### 基础数据

| 数据项 | 用途 | 关联模块 |
|--------|------|----------|
| 3 个测试组织（A/B/C） | 多租户隔离测试 | 全部 |
| 每组织 4 个测试用户（admin/editor/viewer/org2） | 角色权限测试 | M1 |
| 9 个内置 AI 员工（含 leader） | 员工功能测试 | M2 |
| 10+内置技能 + 3 个自定义技能 | 技能管理测试 | M3 |
| 各状态任务（queued/planning/executing/completed/failed/cancelled） | 状态机测试 | M4 |
| 2 个测试知识库（含已向量化文档） | 知识库测试 | M7 |
| 各状态文章（draft/reviewing/approved/published/archived） | 文章管理测试 | M6 |
| personal + org 可见性内容（员工/技能/任务/知识库） | 可见性过滤测试 | M1 |

### 边界数据

| 数据项 | 用途 |
|--------|------|
| 空组织的管理员 | 空状态测试 |
| 含 100+ 成员的 Organization | 分页/性能测试 |
| 含 100+ 技能绑定的员工 | 技能列表性能测试 |
| 超长标题/描述（>500 字） | 输入截断测试 |
| 特殊字符 slug（含引号/斜杠） | SQL 安全测试 |
| 并发创建时的时间戳碰撞 | 去重逻辑测试 |

---

> 本测试用例文档覆盖 VibeTide 10 大模块，共 **308 个测试用例**，其中 **250 个可自动化**（81%），**9 个已知安全缺陷**已标记。建议优先修复 S1-S3 高严重度缺陷后再进入自动化测试阶段。