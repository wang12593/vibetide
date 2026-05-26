## Why

当前知识库模块功能基础，缺乏主流"个人知识库"产品的核心体验：

1. **没有知识问答能力**：知识库只做存储和向量化，没有"基于知识库回答问题"的交互界面，用户无法直接与知识库对话
2. **文档管理体验差**：只能手动粘贴文本或爬取 URL，不支持文件上传（PDF/Word/Markdown），没有文档预览
3. **缺乏知识图谱/关系**：知识点之间没有关联，无法形成知识网络
4. **缺少个人知识库入口**：当前知识库绑定到组织/员工，没有"我的知识库"个人视角
5. **向量化状态不透明**：用户无法看到文档处理进度、chunk 详情、embedding 质量等

参考 Notion AI、Obsidian、Logseq、Dify 等主流产品，重新设计知识库模块的交互体验。

## What Changes

### Phase 1: 核心体验重构
- 新增"我的知识库"个人视角，用户可创建/管理个人知识库
- 新增知识库对话界面：基于知识库内容进行 RAG 问答
- 支持文件上传（PDF/Word/Markdown/TXT），自动解析和切分
- 文档列表和预览：显示已上传文档、处理状态、chunk 数量

### Phase 2: 增强功能（后续迭代）
- 知识图谱可视化
- 多知识库联合检索
- 知识库分享和协作
- API 接口开放

## Capabilities

### New Capabilities
- `kb-chat`: 知识库对话（RAG 问答界面）
- `kb-file-upload`: 文件上传和自动解析
- `kb-personal-view`: 个人知识库视角

### Modified Capabilities
- `kb-ui`: 知识库列表和详情页 UI 重设计
- `kb-document-management`: 文档管理增强

## Impact

- **UI**: 知识库列表页和详情页完全重设计
- **后端**: 新增文件上传 API、RAG 问答 API
- **数据**: `knowledge_bases` 表可能需要新增字段（如 `ownerType: personal/org`）
- **依赖**: 可能需要引入文件解析库（如 pdf-parse、mammoth）
