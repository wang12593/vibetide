## Context

### 现有知识库架构

- 4 张表：`knowledge_bases`（主表）、`knowledge_items`（chunks）、`employee_knowledge_bases`（员工绑定）、`knowledge_sync_logs`（同步日志）
- 文档摄入：手动粘贴文本 + URL 爬取（Jina Reader）→ chunkText() 切分 → BullMQ Worker 异步向量化（Jina Embeddings v3, 1024 dim）
- 语义检索：应用层余弦相似度（非 pgvector），内存中计算
- 绑定关系：知识库绑定到 AI 员工，员工执行任务时自动注入 `kb_search` 工具

### 参考产品分析

| 产品 | 核心特性 |
|------|---------|
| Notion AI | 页面级知识库 + AI 对话 + 自动摘要 |
| Dify | 知识库管理 + RAG 对话 + 多数据源 |
| Obsidian | 双向链接知识图谱 + Markdown 原生 |
| Logseq | 大纲式知识管理 + 块级引用 |
| 飞书知识库 | 文档协作 + AI 总结 + 权限管理 |

### 技术约束

- 向量化使用 Jina API，不用 pgvector
- 文件解析需要在 Node.js 服务端完成
- 不能引入过重的依赖（如 Elasticsearch）

## Goals / Non-Goals

**Goals (Phase 1):**
- "我的知识库"个人视角
- 文件上传（PDF/Word/MD/TXT）
- 知识库对话（RAG 问答）
- 文档列表和状态显示
- 美观的 UI 重设计

**Non-Goals:**
- 知识图谱可视化（Phase 2）
- 多知识库联合检索（Phase 2）
- 知识库分享和协作（Phase 2）
- 不替换现有向量化方案
- 不引入 pgvector

## Decisions

### D1. 个人知识库 vs 组织知识库

**决策**：`knowledge_bases` 表新增 `ownerType: "personal" | "org"` 字段。个人知识库只有创建者可见，组织知识库对组织内所有人可见。

**理由**：复用现有表结构，通过 `ownerType` + `createdBy` 区分个人/组织知识库。

### D2. 文件上传和解析

**决策**：使用 `pdf-parse`（PDF）、`mammoth`（Word）、原生读取（MD/TXT）。上传后存储原始文件到 Supabase Storage，解析文本后切分 chunks。

**理由**：轻量级依赖，服务端解析，与现有 chunking 流程无缝衔接。

### D3. 知识库对话（RAG 问答）

**决策**：新增 `/api/knowledge-bases/[id]/chat` API 路由，接收用户问题，使用 `retrieval.ts` 的语义检索获取 top-K 相关 chunks，拼接为上下文后调用 LLM 生成回答。

**理由**：复用现有 `retrieval.ts` 和 `embeddings.ts`，新增 API 路由即可。

### D4. UI 重设计

**决策**：知识库列表页采用卡片式布局（类似 Notion），详情页分为 3 个 Tab：文档管理、知识对话、设置。整体风格与项目 GlassCard 设计系统保持一致。

**理由**：与现有 UI 风格统一，减少学习成本。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| PDF 解析质量不稳定 | 支持 OCR fallback，失败时提示用户 |
| RAG 回答质量依赖 chunking | 优化 chunking 参数，提供"重新切分"功能 |
| 文件存储成本 | Supabase Storage 免费额度足够初期使用 |
| UI 改动范围大 | 分阶段实施，先做核心功能 |
