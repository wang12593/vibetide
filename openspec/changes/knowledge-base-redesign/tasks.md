## Phase 1: 核心体验重构

### 1. 数据层增强

- [x] 1.1 修改 `src/db/schema/knowledge-bases.ts`：`knowledge_bases` 表新增 `ownerType` 枚举字段（`"personal" | "org"`，默认 `"personal"`），新增 `documents` 关联表（存储上传文件的元数据：文件名、类型、大小、Supabase Storage path、解析状态）
- [x] 1.2 修改 `src/lib/dal/knowledge-bases.ts`：新增 `listPersonalKnowledgeBases(userId)` 函数，查询 `ownerType: "personal" && createdBy: userId` 的知识库列表

### 2. 文件上传

- [x] 2.1 新增 `src/app/api/knowledge-bases/[id]/upload/route.ts`：接收 multipart/form-data 文件上传，存储到 Supabase Storage，调用文件解析服务（pdf-parse/mammoth/原生读取），切分 chunks 写入 `knowledge_items`
- [x] 2.2 新增 `src/lib/knowledge/file-parser.ts`：文件解析服务，支持 PDF（pdf-parse）、Word（mammoth）、Markdown/TXT（原生读取），返回纯文本
- [x] 2.3 安装依赖：`pdf-parse`、`mammoth`

### 3. 知识库对话（RAG 问答）

- [x] 3.1 新增 `src/app/api/knowledge-bases/[id]/chat/route.ts`：接收 `{ question: string }`，调用 `retrieval.ts` 获取 top-K chunks，拼接 RAG prompt，调用 LLM `generateText()` 返回回答
- [x] 3.2 新增 `src/app/(dashboard)/knowledge-bases/[id]/kb-chat-client.tsx`：知识库对话 UI 组件，显示对话历史、输入框、引用来源

### 4. UI 重设计

- [x] 4.1 重设计 `src/app/(dashboard)/knowledge-bases/knowledge-bases-client.tsx`：新增"我的知识库" Tab，卡片式布局，显示知识库名称、文档数、状态、最后更新时间
- [x] 4.2 重设计 `src/app/(dashboard)/knowledge-bases/[id]/kb-detail-client.tsx`：3 个 Tab 布局：文档管理（文件列表+上传按钮）、知识对话（RAG 问答界面）、设置（元数据+绑定员工+同步日志）
- [x] 4.3 新增文档上传 UI：拖拽上传区域 + 文件列表（显示文件名、类型、大小、解析状态）

### 5. 验证

- [x] 5.1 运行 `npx tsc --noEmit` 确保零类型错误
- [x] 5.2 运行 `npm run build` 确保生产构建通过
- [ ] 5.3 手动验证：创建个人知识库 → 上传 PDF → 查看文档列表 → 基于知识库对话
