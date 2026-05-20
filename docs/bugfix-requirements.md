# VibeTide 问题修复需求与方案

> **日期**: 2026-05-15 | **范围**: TC-01 ~ TC-08.07 前的所有问题（共 12 项）

---

## 问题总览

| # | 问题 | 优先级 | 根因分类 |
|---|------|--------|---------|
| 1 | 新用户看到他人自定义内容 | **P0** | DAL 调用方未传 userId/mode |
| 2 | 管理员无 /admin 入口 | **P0** | SettingsButton 已定义但未渲染 |
| 3 | /admin/* 操作失败+组织名+角色权限空 | **P0** | 无 layout 保护+数据硬编码空+seed 缺失 |
| 4 | 任务无升级可见性入口 | **P1** | 任务列表/详情页无升级按钮 |
| 5 | 无法同时登录多账号 | **P2** | Cookie storage key 硬编码（设计限制） |
| 6 | 新建员工隐藏可见性选择 | **P1** | 默认值改为 personal + 隐藏选择器 |
| 7 | 技能按 docx 重新分类 | **P1** | 需要用户提供 docx 内容 |
| 8 | 意图识别直接调 skill 跳过工作流 | **P0** | Level 0 规则绕过工作流匹配 |
| 9 | 对话出现两个"下一步"按钮 | **P0** | ClarificationCard 重复渲染 |
| 10 | 意图不稳定 | **P2** | LLM 温度+few-shot 不足 |
| 11 | 没有左侧对话列表/删除按钮 | **P1** | 删除按钮需 hover+群聊 tab 无删除 |
| 12 | 新建群聊无标题输入框 | **P0** | UI 缺少 input 组件 |

---

## 修复方案详情

---

### 问题 1: 新用户看到他人自定义内容（P0）

**根因**: DAL 层 `getEmployees()`/`getSkillsWithBindCount()`/`getMissionsWithActiveTasks()` 的调用方全部未传 `userId`/`mode` 参数，导致 visibility 过滤从未生效。写入端已正确标记 `createdBy` + `visibility: "personal"`。

**修改文件清单**:

| 文件 | 当前代码 | 修改 |
|------|---------|------|
| `home/page.tsx` | `getEmployees()` 无参 | 传入 `{ userId: user.id }` |
| `home/page.tsx` | 直接查 missions 表 | 加入 `createdBy` 过滤 |
| `ai-employees/page.tsx` | `getEmployees()` 无参 | 传入 `{ userId: user.id }` |
| `skills/page.tsx` | `getSkillsWithBindCount()` 无参 | 传入 `{ userId, mode: "own" }`（非 admin 默认 own） |
| `missions/page.tsx` | `getMissionsWithActiveTasks(orgId)` | 传入 `{ userId, mode: "own" }` |
| `chat/page.tsx` | `getEmployees()` 无参 | 传入 `{ userId: user.id }` |
| `employee-marketplace/page.tsx` | `getEmployees()` 无参 | 传入 `{ userId: user.id }` |

**逻辑规则**:
- `admin` 角色 → `mode: "all"`（可见全部）
- 非 admin → `mode: "own"`（只看自己的 + builtin 的）
- builtin/preset 内容对所有用户可见（`type === "builtin"` 或 `isPreset === 1`）

**穆兰配置页** (`/settings/mulan-config`):
- 技能列表只显示用户自建 + builtin
- 知识库列表只显示用户自建
- 工作流列表只显示用户自建 + builtin
- 可派遣员工列表只显示 preset + 用户自建的

---

### 问题 2: 管理员无 /admin 入口（P0）

**根因**: `app-sidebar.tsx` 中 `SettingsButton` 组件已定义（L164-199）但从未在 JSX 中渲染。`canAccessAdmin` 变量已计算（L415-419）但未使用。

**修改方案**:

在 `app-sidebar.tsx` 的侧边栏底部区域（用户信息上方或 `visibleMore` 下方）添加：

```tsx
{canAccessAdmin && (
  <SidebarGroup>
    <SidebarGroupLabel>管理后台</SidebarGroupLabel>
    <SidebarMenu>
      {ADMIN_ITEMS.map((item) => (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton asChild>
            <Link href={item.url}>{item.title}</Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  </SidebarGroup>
)}
```

同时在 `rbac-constants.ts` 的 `MENU_PERMISSION_MAP` 中注册：
```
"/admin/users": "system:manage_users",
"/admin/roles": "system:manage_roles",
"/admin/organizations": "system:manage_orgs",
"/admin/content-management": "content:manage",
```

---

### 问题 3: /admin/* 操作失败（P0）

**根因**: 
1. 无 `admin/layout.tsx` 做统一权限门控
2. `content-management` 页面数据硬编码为空数组
3. 注册流程未自动分配 admin 角色
4. 组织名"华栖云"需改为"技术保障部"

**修改方案**:

**3.1 添加 `admin/layout.tsx`**:
```tsx
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac-constants";

export default async function AdminLayout({ children }) {
  await requirePermission(PERMISSIONS.SYSTEM_MANAGE_USERS);
  return <>{children}</>;
}
```

**3.2 修复 `content-management` 页面**:
- 添加 `page.tsx` 做服务端数据加载
- 从 DAL 查询所有 `visibility = "personal"` 的内容（技能/任务/知识库/员工）
- 将数据传入 `content-client.tsx`

**3.3 修复角色权限页为空**:
- 检查 `admin/roles/page.tsx` 的数据查询逻辑
- 确保 seed 脚本为组织分配了 3 个系统角色

**3.4 组织名替换**:
- SQL: `UPDATE organizations SET name = '技术保障部' WHERE name LIKE '%华栖云%';`
- SQL: `UPDATE organizations SET slug = 'jsbb' WHERE slug = 'huaqiyun';`
- 搜索代码中所有"华栖云"硬编码字符串并替换

**3.5 新建角色表单优化**:
- `slug` 字段自动从 `name` 生成
- `isSystem` 字段隐藏（默认 false）
- 添加权限选择器（checkbox tree），替代手动输入权限 JSON

---

### 问题 4: 任务无升级可见性入口（P1）

**根因**: `upgradeContentVisibility` action 已就绪，但任务列表/详情页无升级按钮。

**修改方案**:

**4.1 任务列表页** (`missions-client.tsx`):
- 对 `visibility === "personal"` 的任务卡片，显示"升级为组织共享"按钮
- 按钮仅对 `createdBy === currentUser` 显示
- 点击后调用 `upgradeContentVisibility("mission", missionId)`

**4.2 任务详情页**:
- 在任务标题旁显示 visibility 标签（个人/组织）
- 提供"升级可见性"按钮

**4.3 同样适用于技能、知识库、员工**:
- 各列表页的 `personal` 内容卡片均添加升级按钮

---

### 问题 5: 无法同时登录多账号（P2）

**根因**: Supabase cookie storage key 硬编码为 `sb-vibetide-auth-token`，同一浏览器所有标签页共享同一 cookie。

**修改方案**:

此为**浏览器设计限制**，不是代码 bug。建议方案：
1. **短期**：在登录页添加提示"请使用无痕模式/不同浏览器登录其他账号"
2. **中期**：支持应用内账号切换（类似 Slack 的 Workspace 切换器）
3. **不修改**：cookie key 统一是 LAN 环境下 SSR/CSR 一致性的必要条件

---

### 问题 6: 新建员工隐藏可见性选择（P1）

**根因**: `create-employee-client.tsx` L138 默认值为 `"org"`，且选择器在向导第 3 步。

**修改方案**:

1. 将默认值改为 `"personal"`:
   ```typescript
   const [visibility, setVisibility] = useState<"org" | "personal">("personal");
   ```
2. 隐藏选择器 UI（整个 `Step3Preview` 中的 visibility 选择区域）
3. 保留 `visibility` 状态为 `"personal"`，不渲染切换按钮

---

### 问题 7: 技能按 docx 重新分类（P1）

**前置条件**: 需要用户提供 `AI_技能媒体专属版统一分类框架.docx` 的内容（.txt/.md 格式或直接粘贴）。

**修改范围**:
1. `src/db/schema/enums.ts` — 更新 `skillCategoryEnum` 枚举值
2. `skills/*/SKILL.md` — 更新每个技能的 `category` 字段
3. 数据库 ALTER TYPE — 添加新枚举值、更新现有记录
4. `src/lib/rbac-constants.ts` — 更新分类标签和颜色映射

---

### 问题 8: 意图识别直接调 skill 跳过工作流（P0）

**根因**: `intent-recognition.ts` 的 Level 0 规则引擎（L176-268）在匹配后直接返回 skill 方案，完全绕过 LLM 和工作流匹配。

**修改方案**:

在 Level 0 命中后，增加**工作流优先检查**：

```typescript
// 在 ruleBasedClassify 返回后
if (ruleResult.matched) {
  // 新增：检查是否有匹配的工作流
  const matchedWorkflow = findMatchingWorkflow(
    ruleResult.intentType,
    ruleResult.skills,
    availableWorkflows
  );
  if (matchedWorkflow) {
    return {
      intentType: "workflow_execution",
      workflowId: matchedWorkflow.id,
      workflowName: matchedWorkflow.name,
      executionMode: "auto",
      steps: [],
      confidence: 0.95,
    };
  }
  // 没有匹配的工作流，返回 skill 方案
  return skillBasedResult;
}
```

新增 `findMatchingWorkflow()` 函数：
- 遍历 `availableWorkflows`
- 检查工作流的 `scenarioCategory` 或 `steps` 中的技能是否与 Level 0 匹配的技能重叠
- 重叠度 >= 50% 则返回该工作流

**优先级顺序**: 工作流 > 员工+技能组合 > 单技能直接调用

---

### 问题 9: 对话出现两个"下一步"按钮（P0）

**根因**: `ClarificationCard` 在两个位置被渲染：
1. 消息循环内部（`chat-panel.tsx` L860-865）
2. 消息循环外部（`chat-panel.tsx` L1113-1122）

**修改方案**:

移除消息循环外部的重复渲染，只保留循环内部的那一个：

```diff
// chat-panel.tsx L1113-1122：删除这段重复代码
- {pendingIntent?.needsClarification &&
-   pendingIntent.clarificationQuestions &&
-   pendingIntent.clarificationQuestions.length > 0 &&
-   !intentLoading && (
-     <ClarificationCard ... />
-   )}
```

同时检查 `onStepReview` 回调中生成的 assistant 消息是否也包含"下一步"文本，如果是，确保不与 `ClarificationCard` 的按钮重复。

---

### 问题 10: 意图不稳定（P2）

**根因**: LLM 温度 0.2 + few-shot 示例不足 + 意图分类关键词重叠。

**修改方案**:

1. **降低温度**: `temperature: 0` （完全确定性输出）
2. **增加硬编码 few-shot 示例**: 在 prompt 中添加 10-15 个标准 intent → result 的映射示例
3. **消除关键词重叠**: 重新定义 7 种意图的边界，减少歧义
4. **添加结果缓存**: 相同输入在 5 分钟内返回相同结果

---

### 问题 11: 没有左侧对话列表/删除按钮（P1）

**根因**: 左侧面板已实现，但：
1. 删除按钮仅在"收藏"tab 中，hover 时才显示
2. "数字员工"和"群聊"tab 的对话项没有删除按钮

**修改方案**:

1. **数字员工 tab**: 为每个对话项添加 hover 显示的删除按钮（与收藏 tab 一致）
2. **群聊 tab**: 每个群聊项添加删除/归档按钮
3. **删除按钮始终可见**: 将 `opacity-0 group-hover:opacity-100` 改为始终可见（或使用更明显的删除图标）
4. **添加右键菜单**: 支持"删除对话"、"重命名"等操作

---

### 问题 12: 新建群聊无标题输入框（P0）

**根因**: `chat-center-client.tsx` L573-627 的群聊创建弹窗中只有 `EmployeeSelector`，没有标题 input。

**修改方案**:

在群聊创建弹窗中添加标题输入框：

```tsx
{showGroupCreator && (
  <div className="fixed inset-0 z-50 ...">
    <div ...>
      <h3>发起群聊</h3>
      {/* 新增：标题输入 */}
      <input
        type="text"
        placeholder="群聊标题（可选）"
        value={groupTitle}
        onChange={(e) => setGroupTitle(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg"
      />
      <EmployeeSelector ... />
    </div>
    <div ...>
      <button onClick={async () => {
        await createGroupChat({
          title: groupTitle || "",  // 使用用户输入的标题
          employeeSlugs: selectedGroupEmployees,
        });
      }}>
        确认创建
      </button>
    </div>
  </div>
)}
```

新增状态：`const [groupTitle, setGroupTitle] = useState("");`

---

## 执行计划

### 批次 1（P0 — 核心功能阻断）

| 序号 | 任务 | 涉及文件 | 预估改动 |
|------|------|---------|---------|
| 1.1 | 用户隔离：所有页面传 userId/mode | 6 个 page.tsx | 每个 3-5 行 |
| 1.2 | 管理员入口：渲染 SettingsButton | app-sidebar.tsx | +10 行 |
| 1.3 | admin layout + 组织名替换 | 新建 layout.tsx + SQL | +20 行 |
| 1.4 | 群聊标题输入框 | chat-center-client.tsx | +10 行 |
| 1.5 | 修复两个"下一步"按钮 | chat-panel.tsx | -10 行 |
| 1.6 | 意图识别工作流优先 | intent-recognition.ts | +30 行 |

### 批次 2（P1 — 功能完善）

| 序号 | 任务 | 涉及文件 |
|------|------|---------|
| 2.1 | 任务/技能/知识库升级按钮 | 各列表页 client 组件 |
| 2.2 | 新建员工隐藏可见性选择 | create-employee-client.tsx |
| 2.3 | 对话删除按钮改进 | employee-list-panel.tsx |
| 2.4 | content-management 数据加载 | admin/content-management/ |
| 2.5 | 角色权限页修复 + 表单优化 | admin/roles/ |

### 批次 3（P2 — 体验优化）

| 序号 | 任务 | 涉及文件 |
|------|------|---------|
| 3.1 | 意图稳定性优化 | intent-recognition.ts |
| 3.2 | 多账号提示 | login/page.tsx |
| 3.3 | 技能重新分类（待 docx 内容） | enums.ts + SKILL.md |

---

## 数据库变更

```sql
-- 组织名替换
UPDATE organizations SET name = '技术保障部', slug = 'jsbb' WHERE slug = 'huaqiyun';

-- 确保 admin 角色存在并分配给 test@qq.com
-- (seed 脚本已处理，但需验证)
```
