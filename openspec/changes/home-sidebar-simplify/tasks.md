## 1. 侧边栏导航调整

- [x] 1.1 修改 `src/components/layout/app-sidebar.tsx`：将 `NAV_ITEMS` 精简为 2 项：首页(`/home`)、对话(`/chat`)
- [x] 1.2 修改 `src/components/layout/app-sidebar.tsx`：将"任务"(`/missions`)、"员工"(`/ai-employees`)、"技能"(`/skills`)、"场景"(`/workflows`)、"知识"(`/knowledge-bases`) 移入 `MORE_ITEMS` 数组
- [x] 1.3 `MORE_ITEMS` 现包含 6 个入口（5 个管理功能 + 原有"穆兰配置"），"更多"菜单的折叠子列表正确显示

## 2. 首页能力配置隐藏

- [x] 2.1 修改 `src/app/(dashboard)/home/home-client.tsx`：移除 `renderConfigSection()` 的调用，函数定义保留

## 3. 验证

- [x] 3.1 运行 `npx tsc --noEmit` 确保零类型错误
- [x] 3.2 运行 `npm run build` 确保生产构建通过
- [x] 3.3 手动验证：侧边栏只显示首页、对话 2 个一级入口
- [x] 3.4 手动验证："更多"菜单包含任务、员工、技能、场景、知识、穆兰配置
- [x] 3.5 手动验证：首页不再显示能力配置折叠区域
