import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType,
  PageBreak, TableLayoutType
} from "docx";
import { writeFileSync } from "fs";

const BLUE = "1a5276";
const DARK = "2c3e50";
const RED = "c0392b";
const GREEN = "27ae60";
const ORANGE = "e67e22";
const GRAY = "7f8c8d";
const WHITE = "ffffff";
const LIGHT_BG = "eaf2f8";
const WARN_BG = "fef9e7";
const RED_BG = "fdedec";

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, spacing: { before: 300, after: 150 }, children: [new TextRun({ text, bold: true, size: level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 28 : 24, color: BLUE })] });
}

function para(text, opts = {}) {
  return new Paragraph({ spacing: { before: 80, after: 80 }, ...opts, children: [new TextRun({ text, size: 21, font: "Microsoft YaHei", color: opts.color || DARK, bold: opts.bold || false })] });
}

function boldPara(text) {
  return para(text, { bold: true });
}

function bullet(text, level = 0) {
  return new Paragraph({ spacing: { before: 40, after: 40 }, indent: { left: 720 + level * 360 }, children: [new TextRun({ text: `• ${text}`, size: 21, font: "Microsoft YaHei", color: DARK })] });
}

function warnBox(text) {
  return new Paragraph({ spacing: { before: 100, after: 100 }, shading: { type: ShadingType.CLEAR, fill: WARN_BG }, indent: { left: 360, right: 360 }, children: [new TextRun({ text: `⚠ ${text}`, size: 21, font: "Microsoft YaHei", color: ORANGE, bold: true })] });
}

function alertBox(text) {
  return new Paragraph({ spacing: { before: 100, after: 100 }, shading: { type: ShadingType.CLEAR, fill: RED_BG }, indent: { left: 360, right: 360 }, children: [new TextRun({ text: `🔴 ${text}`, size: 21, font: "Microsoft YaHei", color: RED, bold: true })] });
}

function greenBox(text) {
  return new Paragraph({ spacing: { before: 100, after: 100 }, shading: { type: ShadingType.CLEAR, fill: "eafaf1" }, indent: { left: 360, right: 360 }, children: [new TextRun({ text: `✅ ${text}`, size: 21, font: "Microsoft YaHei", color: GREEN, bold: true })] });
}

function makeCell(text, opts = {}) {
  const isHeader = opts.header;
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: isHeader ? { type: ShadingType.CLEAR, fill: BLUE } : (opts.bg ? { type: ShadingType.CLEAR, fill: opts.bg } : undefined),
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 18, font: "Microsoft YaHei", bold: isHeader || opts.bold, color: isHeader ? WHITE : DARK })] })]
  });
}

function makeTable(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => makeCell(h, { header: true, width: widths?.[i] })) }),
      ...rows.map((row, ri) => new TableRow({ children: row.map((c, ci) => makeCell(c, { width: widths?.[ci], bg: ri % 2 === 0 ? LIGHT_BG : undefined })) }))
    ]
  });
}

function codeBlock(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    shading: { type: ShadingType.CLEAR, fill: "f4f6f7" },
    indent: { left: 360, right: 360 },
    children: [new TextRun({ text, size: 18, font: "Consolas", color: DARK })]
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

const doc = new Document({
  styles: { default: { document: { run: { font: "Microsoft YaHei", size: 21 } } } },
  sections: [{
    properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "VibeTide 完全内网部署架构方案", bold: true, size: 44, color: BLUE, font: "Microsoft YaHei" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "基于 BMAD 对抗式多智能体分析（两轮攻防共识版）", size: 24, color: GRAY, font: "Microsoft YaHei" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: "生成日期：2026-05-13", size: 20, color: GRAY, font: "Microsoft YaHei" })] }),
      para("参与智能体：🏗️ Winston（架构师）| 💻 Amelia（工程师）| 📊 Mary（业务分析师）| 📋 John（产品经理）"),
      para("对抗模式：Party Mode 两轮攻防辩论，共 8 次独立分析"),

      pageBreak(),
      heading("一、两轮对抗关键共识变更", HeadingLevel.HEADING_1),
      para("以下为两轮对抗分析中，四位智能体通过辩论达成的关键共识变更："),
      makeTable(
        ["原始假设", "对抗后修正", "提出者"],
        [
          ["Qwen3.5-35B-A3B（3B active）够用", "❌ 严重不足，最低需 Qwen3-72B", "Mary + John 联合提出"],
          ["Inngest 需要自托管", "✅ 已完全迁移到 BullMQ，Inngest 已移除", "Winston 代码验证确认"],
          ["需要全量 re-embed 知识库", "⚠️ 可保留 Jina API 或选 bge-m3 重嵌", "Winston 建议保留，Amelia 建议本地化"],
          ["37 个文件需全部改", "✅ 核心改动仅 4 个文件，其余为环境变量降级", "Winston 精确定位"],
          ["Token 需求是假设的 3-5x", "⚠️ 实际约 2x（双方折中）", "Amelia 按极端算，Winston 按实际代码修正"],
        ]
      ),

      pageBreak(),
      heading("二、完整部署架构图", HeadingLevel.HEADING_1),
      heading("2.1 三节点部署拓扑", HeadingLevel.HEADING_2),
      codeBlock("┌─────────────────────────────────────────────────────────────────────┐"),
      codeBlock("│                     内网安全区 (10.100.244.0/24)                     │"),
      codeBlock("│                                                                     │"),
      codeBlock("│  ┌── Node 1: 10.100.244.185 (GPU 推理服务器) ────────────────────┐  │"),
      codeBlock("│  │  GPU: 2× RTX 4090 (48GB) 或 1× A100-80GB                      │  │"),
      codeBlock("│  │  CPU: 32核  RAM: 64GB  SSD: 1TB NVMe                           │  │"),
      codeBlock("│  │  GPUStack Server :80                                           │  │"),
      codeBlock("│  │    ├─ Qwen3-72B-INT4 (推理, ~40GB VRAM)                        │  │"),
      codeBlock("│  │    └─ bge-m3 (向量化, ~2GB VRAM)                               │  │"),
      codeBlock("│  └────────────────────────────────────────────────────────────────┘  │"),
      codeBlock("│                                                                     │"),
      codeBlock("│  ┌── Node 2: 10.100.244.186 (应用服务器) ────────────────────────┐  │"),
      codeBlock("│  │  CPU: 16核  RAM: 32GB  SSD: 500GB NVMe                        │  │"),
      codeBlock("│  │  Nginx :443/:80  |  Next.js :3000  |  BullMQ Worker           │  │"),
      codeBlock("│  │  Redis 7 :6379  |  Prometheus+Grafana  |  MinIO :9000         │  │"),
      codeBlock("│  └────────────────────────────────────────────────────────────────┘  │"),
      codeBlock("│                                                                     │"),
      codeBlock("│  ┌── Node 3: 10.100.244.187 (数据库服务器) ──────────────────────┐  │"),
      codeBlock("│  │  CPU: 16核  RAM: 32GB  SSD: 500GB + 2TB HDD                   │  │"),
      codeBlock("│  │  PostgreSQL :5432  |  PgBouncer :6543  |  定时备份              │  │"),
      codeBlock("│  └────────────────────────────────────────────────────────────────┘  │"),
      codeBlock("└─────────────────────────────────────────────────────────────────────┘"),

      heading("2.2 数据流架构", HeadingLevel.HEADING_2),
      codeBlock("用户请求 → Nginx (TLS) → Next.js SSR"),
      codeBlock("                      ├─ 读数据 → PostgreSQL (Drizzle ORM)"),
      codeBlock("                      ├─ AI调用 → GPUStack (OpenAI 兼容 API)"),
      codeBlock("                      ├─ 向量化 → Embedding Service (bge-m3)"),
      codeBlock("                      └─ 异步任务 → Redis (BullMQ) → Worker"),

      heading("2.3 网络分段", HeadingLevel.HEADING_2),
      makeTable(
        ["区域", "VLAN", "IP 范围", "包含服务"],
        [
          ["用户接入区", "VLAN 100", "10.100.244.1-63", "Nginx :443"],
          ["应用服务区", "VLAN 200", "10.100.244.64-127", "Next.js, BullMQ, Redis, MinIO"],
          ["数据库区", "VLAN 300", "10.100.244.128-191", "PostgreSQL, PgBouncer"],
          ["GPU 计算区", "VLAN 400", "10.100.244.192-254", "GPUStack LLM + Embedding"],
        ]
      ),

      pageBreak(),
      heading("三、三场景资源配置清单", HeadingLevel.HEADING_1),
      alertBox("方案选择：推荐 Qwen3-72B-INT4（两轮对抗共识）"),
      para("Qwen3.5-35B-A3B 的 3B 活跃参数对内容生成、意图识别、多步工作流严重不足。Qwen3-72B（dense 72B 参数，INT4 量化）是性价比甜点。"),

      makeTable(
        ["资源维度", "场景A: 200 DAU（初期）", "场景B: 500 DAU（成熟）", "场景C: 1000 并发（峰值）"],
        [
          ["LLM 模型", "Qwen3-72B-INT4", "Qwen3-72B-INT4", "Qwen3-72B 或 235B"],
          ["GPU", "2× RTX 4090 (48GB)", "2× 4090 或 1× A100-80GB", "4× A100-80GB"],
          ["GPU VRAM", "48 GB", "48-80 GB", "320 GB"],
          ["并发 Mission", "1-2", "2-3", "5-8"],
          ["CPU 总核心", "16 核", "24 核", "48 核"],
          ["RAM 总计", "48 GB", "96 GB", "192 GB"],
          ["SSD/NVMe", "2.5 TB", "5 TB", "13 TB"],
          ["Redis", "512 MB", "1 GB", "2 GB"],
          ["网络", "千兆", "千兆", "万兆"],
          ["功耗", "~2.1 kW", "~2.6 kW", "~5.3 kW"],
          ["服务器数", "2 台", "3 台", "6-8 台"],
          ["硬件成本", "¥6-8 万", "¥15-20 万", "¥50-80 万"],
          ["HA 冗余", "1x（无冗余）", "2x（DB 主从）", "2-3x（全面冗余）"],
        ],
        [20, 27, 27, 26]
      ),

      heading("3.1 GPU 计算详解", HeadingLevel.HEADING_2),
      para("Qwen3.5-35B-A3B MoE 关键特性：35B 总参，每 token 仅 3B active，推理 FLOPs 约等于 dense 3B 模型。但 3B active params 的知识容量和推理能力不足以支撑 Vibetide 核心场景。"),
      makeTable(
        ["模型方案", "参数量", "INT4 显存", "推理速度", "中文质量", "GPU 配置", "成本"],
        [
          ["Qwen3-32B dense", "32B", "~18GB", "40-60 tok/s", "★★★", "1× 4090", "¥1.6万"],
          ["Qwen3-72B dense（推荐）", "72B", "~40GB", "15-25 tok/s", "★★★★", "2× 4090", "¥3.2万"],
          ["Qwen3-235B MoE", "235B", "~125GB", "30-45 tok/s", "★★★★★", "2× A100-80GB", "¥20万+"],
        ]
      ),

      heading("3.2 Embedding 模型选型", HeadingLevel.HEADING_2),
      makeTable(
        ["模型", "维度", "中文质量", "显存", "推荐场景"],
        [
          ["bge-m3（推荐）", "1024", "★★★★", "~2.2GB", "通用 RAG + 多语言"],
          ["bce-embedding-base", "768", "★★★★★", "~1.1GB", "纯中文场景更优"],
          ["gte-Qwen2-1.5B", "1536", "★★★★★", "~3.0GB", "质量最高但显存贵"],
        ]
      ),
      warnBox("关键：bge-m3 维度恰好 1024，与现有 Jina v3 兼容，无需改数据库 schema。但向量空间不同，已有数据需全量 re-embed 或保留 Jina API。"),

      heading("3.3 Token 需求量计算", HeadingLevel.HEADING_2),
      makeTable(
        ["操作类型", "maxTokens", "输入 tokens", "日均频率/用户", "日均 token"],
        [
          ["聊天（流式）", "8,192", "~200", "5-10条×1次", "40,960-81,920"],
          ["意图识别", "1,024", "~300", "5-10条×1次", "6,656-13,312"],
          ["Mission 任务执行", "4,096", "~1,500", "1-2个×3-5步", "16,896-44,800"],
          ["单用户日均合计", "", "", "", "~70,000-150,000"],
        ]
      ),

      pageBreak(),
      heading("四、外部依赖替换策略", HeadingLevel.HEADING_1),
      heading("4.1 核心改动文件（仅 4 个）", HeadingLevel.HEADING_2),
      makeTable(
        ["优先级", "文件", "替换方案", "工作量"],
        [
          ["P0", "src/lib/agent/model-router.ts", "改 OPENAI_API_BASE_URL 指向 GPUStack", "0.5d"],
          ["P0", "src/lib/knowledge/embeddings.ts", "Jina URL → 环境变量，指向本地 bge-m3", "1d"],
          ["P0", "src/lib/agent/configured-models.ts", "删除 Zhipu/Anthropic 分支", "0.5d"],
          ["P0", ".env.local", "配置 GPUStack + Redis + Embedding 端点", "0.5d"],
          ["P1", "src/lib/agent/tool-registry.ts", "web_search 等 6 个工具加降级逻辑", "2d"],
          ["P1", "src/lib/web-fetch.ts", "移除 Tavily/Jina，保留 Cheerio fallback", "1d"],
          ["P2", "搜索/热榜适配器 (6 文件)", "环境变量开关禁用", "1d"],
        ]
      ),
      greenBox("重大利好：BullMQ 迁移已完成（6 队列 23+ handler），Inngest 已完全移除，节省 10+ 人天。"),
      greenBox("重大利好：model-router.ts 已使用 createOpenAI() + 可配 baseURL，天然兼容 GPUStack 的 OpenAI API。"),

      heading("4.2 功能存活评估", HeadingLevel.HEADING_2),
      makeTable(
        ["状态", "功能", "说明"],
        [
          ["✅ 完全存活", "认证系统、AI 员工管理、工作流模板", "纯 CRUD + 内部状态机"],
          ["✅ 完全存活", "Mission 引擎、文章编辑器", "纯前端 + 内部逻辑"],
          ["✅ 完全存活", "知识库（文本摄入+chunking）", "chunking 不依赖外网"],
          ["✅ 完全存活", "BullMQ 后台任务、Chat Center 对话", "走 Qwen 即可"],
          ["⚠️ 降级运行", "AI 内容生成", "Qwen3-72B 替代 DeepSeek，质量需 benchmark"],
          ["⚠️ 降级运行", "知识库 RAG 检索", "换 bge-m3，需全量重嵌"],
          ["⚠️ 降级运行", "内容审核", "无事实核查能力，仅文本规则"],
          ["❌ 不可用", "全网搜索（Tavily）", "内网无互联网内容索引"],
          ["❌ 不可用", "网页深读（Jina Reader）", "内网无法访问外部页面"],
          ["❌ 不可用", "热榜聚合", "外部热榜 API 不可达"],
          ["❌ 不可用", "CMS 发布（华栖云）", "可能不在内网"],
        ]
      ),

      pageBreak(),
      heading("五、安全架构", HeadingLevel.HEADING_1),
      heading("5.1 加密策略", HeadingLevel.HEADING_2),
      makeTable(
        ["层级", "策略", "实现方式"],
        [
          ["传输中", "TLS 1.3", "Nginx 自签证书（内网 CA 签发）"],
          ["静态存储", "AES-256", "PostgreSQL TDE 或 LUKS 磁盘加密"],
          ["密码/密钥", "环境变量 / Vault", ".env.local 权限 600；生产级建议 HashiCorp Vault"],
          ["数据库连接", "SSL 可选", "PgBouncer → PostgreSQL 可启用 SSL"],
        ]
      ),

      heading("5.2 访问控制", HeadingLevel.HEADING_2),
      bullet("认证：Supabase Auth（已实现）— email/password"),
      bullet("授权：RBAC via user_roles 表 + organization_id 多租户隔离"),
      bullet("API 网关：Nginx rate limiting — 200 DAU 下 100r/s per IP"),
      bullet("数据库：supabase_auth_admin + supabase_service_role_key 双账号"),

      heading("5.3 高可用设计", HeadingLevel.HEADING_2),
      makeTable(
        ["组件", "HA 策略", "RTO", "RPO"],
        [
          ["Next.js", "PM2 cluster mode (×2) + Nginx upstream", "< 30s", "0（无状态）"],
          ["BullMQ Worker", "PM2 ×3；BullMQ 自带 retry + dead letter", "< 1min", "0"],
          ["Redis", "AOF + 每小时 RDB 备份", "< 5min", "< 1min"],
          ["PostgreSQL", "Streaming Replication（主从）+ pg_dump 每日全量", "< 15min", "< 5min"],
          ["GPUStack", "多 worker + 模型热备", "< 5min", "0"],
        ]
      ),

      heading("5.4 监控与告警", HeadingLevel.HEADING_2),
      makeTable(
        ["告警", "条件", "级别"],
        [
          ["LLM 服务不可用", "GPUStack 连续 3 次 health check 失败", "P0"],
          ["数据库连接池耗尽", "活跃连接 > 80% max_connections", "P1"],
          ["BullMQ 队列积压", "队列深度 > 1000 持续 5 分钟", "P1"],
          ["GPU 显存 > 95%", "持续 10 分钟", "P2"],
          ["磁盘 > 85%", "任何节点", "P2"],
          ["Worker 异常退出", "PM2 process restart > 3 次/小时", "P1"],
        ]
      ),

      pageBreak(),
      heading("六、执行路线图（对抗共识）", HeadingLevel.HEADING_1),
      makeTable(
        ["Phase", "内容", "工期", "关键交付物"],
        [
          ["Phase 0 ⭐", "Benchmark 测试：Qwen3-72B-INT4 vs DeepSeek 在 4 个核心任务的质量对比", "2 周", "质量对比报告 + 模型选型决策"],
          ["Phase 1", "GPUStack 部署 + 模型量化 + 三节点架构搭建", "2 周", "推理服务上线"],
          ["Phase 2", "model-router + embeddings 适配 + 搜索降级", "2 周", "代码迁移完成"],
          ["Phase 3", "集成测试 + 性能调优 + 安全审计", "1-2 周", "生产就绪"],
          ["总计", "", "7-10 周", ""],
        ]
      ),
      alertBox("Phase 0（Benchmark）是所有后续工作的硬性前提——四位智能体一致同意。"),

      heading("6.1 Phase 0 Benchmark 测试矩阵", HeadingLevel.HEADING_2),
      makeTable(
        ["测试任务", "测试数据", "评估维度"],
        [
          ["AI 员工意图识别", "200 条真实 chat 记录", "准确率、响应时间"],
          ["长文内容生成（2000 字新闻稿）", "20 个主题", "流畅度、事实性、结构完整性"],
          ["多步工作流编排", "10 个复杂工作流模板", "步骤完整率、参数填充准确率"],
          ["RAG 知识库问答", "100 条知识库问答对", "召回率、回答准确率、幻觉率"],
        ]
      ),

      pageBreak(),
      heading("七、关键风险（对抗后修订）", HeadingLevel.HEADING_1),
      makeTable(
        ["风险", "严重度", "缓解策略"],
        [
          ["Qwen3-72B 内容质量不达标", "🔴 致命", "Phase 0 benchmark 先行；保留 API fallback 机制"],
          ["GPU 排队导致 Agent 3 分钟超时", "🔴 高", "请求优先级队列（意图识别优先）；增大超时到 5 分钟"],
          ["Embedding 向量空间不兼容", "🟡 中", "方案 A：保留 Jina API；方案 B：bge-m3 全量重嵌"],
          ["Node.js 单线程向量检索阻塞", "🟢 低(V1)", "chunks < 5K 无影响；> 5K 迁移 Worker Thread"],
          ["Supabase 自建稳定性", "🟡 中", "评估 Supabase 自托管 vs 直连 PostgreSQL + NextAuth"],
          ["MoE 模型 INT4 量化质量损失", "🟡 中", "必须做 FP16 vs INT4 的基准测试对比"],
          ["37 个外部 API 引用需替换", "🔴 高", "核心 4 文件改动 + 其余环境变量降级"],
          ["Inngest 残留需清理", "🟢 低", "已迁移 BullMQ，仅需清理文档引用"],
        ]
      ),

      pageBreak(),
      heading("八、各智能体核心观点摘要", HeadingLevel.HEADING_1),

      heading("8.1 📊 Mary（业务分析师）", HeadingLevel.HEADING_2),
      boldPara("核心判断：技术可行性 7/10，关键在模型选型"),
      bullet("Qwen3.5-35B-A3B 的 3B 活跃参数是致命瓶颈——长文新闻写作和复杂任务编排会断崖下降"),
      bullet("意图识别系统（344 行结构化 JSON prompt）对 LLM 能力要求极高"),
      bullet("迁移总工作量 35-48 人天（含产品适配和角色重定义）"),
      bullet("最大意外利好：BullMQ 迁移已完成，省 10+ 人天"),
      bullet("最大隐形炸弹：意图识别在 Qwen3.5-35B 下可能翻车"),
      bullet("建议：如果预算允许，Qwen3-235B 或 Qwen3-72B 是更安全选择"),

      heading("8.2 📋 John（产品经理）", HeadingLevel.HEADING_2),
      boldPara("核心判断：断网部署是「产品重新定位」问题，不是功能裁剪问题"),
      bullet("用户旅程核心冲击：AI 全自动 → AI 辅助写作，从「AI 新闻编辑室」变成「带 AI 助手的 CMS」"),
      bullet("xiaolei（热点猎手）失去核心能力，需要重新定位或合并"),
      bullet("搜索/热榜功能完全丧失，内容创作成「无米之炊」"),
      bullet("必须先做 Qwen3.5 vs DeepSeek 的基准测试——模型能力决定一切"),
      bullet("断网后差异化只剩：数据不出内网的合规性——这才是真正的卖点"),
      bullet("目标客户如果是政务媒体/国企宣传部门，「能用」比「好用」更重要"),

      heading("8.3 🏗️ Winston（系统架构师）", HeadingLevel.HEADING_2),
      boldPara("核心判断：架构本身天然兼容，核心改动极小"),
      bullet("model-router.ts 已用 createOpenAI() + 可配 baseURL，天然兼容 GPUStack"),
      bullet("真正需要改的核心文件只有 embeddings.ts 和 model-router.ts"),
      bullet("推荐 3 节点部署（GPU + App + DB），500 DAU 下 DB I/O 是关键路径"),
      bullet("bge-m3 做 embedding，维度 1024 与 Jina v3 一致，无需改 schema"),
      bullet("网络 4 VLAN 分段，Nginx 做 TLS termination + rate limiting"),
      bullet("最大 trade-off：中间层代价是每次交互多 500ms-1s，需用数据决定哪些操作该提升为快捷入口"),

      heading("8.4 💻 Amelia（工程师）", HeadingLevel.HEADING_2),
      boldPara("核心判断：Round 1 最大错误是低估了模型参数量对质量的影响"),
      bullet("Token 需求实际是原始假设的 2 倍（不是 3-5 倍，按极端上限算的）"),
      bullet("Agent 3 分钟超时 vs GPU 排队——低配 GPU 下大量 agent 会超时"),
      bullet("Node.js 单线程向量检索阻塞事件循环——V1 阶段可控，> 5K chunks 需 Worker Thread"),
      bullet("jsonb 向量比 pgvector 浪费 10 倍空间，V1 目标 10K 内可接受"),
      bullet("Qwen3-72B INT4 + 2× RTX 4090 是性价比甜点"),
      bullet("架构必须规划模型升级路径：GPUStack 统一接口，切换模型只改配置"),

      pageBreak(),
      heading("九、最终建议", HeadingLevel.HEADING_1),
      para("经过两轮对抗式分析，四位 BMAD 智能体达成以下核心共识："),
      new Paragraph({ spacing: { before: 200 } }),
      boldPara("1. 必须先做 Benchmark 再选型"),
      para("   这是所有人的第一建议。Phase 0（2 周 Benchmark）是所有后续工作的硬性前提。"),
      new Paragraph({ spacing: { before: 100 } }),
      boldPara("2. Qwen3.5-35B-A3B 不够用"),
      para("   3B 活跃参数无法支撑内容生成和意图识别，最低推荐 Qwen3-72B-INT4。"),
      new Paragraph({ spacing: { before: 100 } }),
      boldPara("3. 迁移工作量比预期少"),
      para("   BullMQ 已完成迁移，核心改动仅 4 个文件，总计 13-21 人天（Winston 估算）到 35-48 人天（Mary 估算，含产品适配）。"),
      new Paragraph({ spacing: { before: 100 } }),
      boldPara("4. 不需要新增任何运行时依赖"),
      para("   GPUStack 提供 OpenAI 兼容 API，model-router 天然兼容。bge-m3 可在 GPUStack 上共部署。"),
      new Paragraph({ spacing: { before: 100 } }),
      boldPara("5. 搜索/热榜功能在内网不可用"),
      para("   这是产品定位问题，需要业务决策。核心损失是实时全网搜索和热榜监控能力。"),
      new Paragraph({ spacing: { before: 200 } }),
      warnBox("下一步建议：启动 Phase 0 Benchmark 测试，用 Qwen3-72B-INT4 在 GPUStack 上跑 VibeTide 的 4 个核心场景（意图识别、内容生成、工作流编排、RAG 问答），与当前 DeepSeek API 的输出做盲评对比。这是决定整个方案可行性的关键门槛。"),
    ]
  }]
});

const buffer = await Packer.toBuffer(doc);
writeFileSync("c:\\Users\\wzh\\Desktop\\VibeTide内网部署架构方案-BMAD对抗式分析.docx", buffer);
console.log("Word 文档已生成：c:\\Users\\wzh\\Desktop\\VibeTide内网部署架构方案-BMAD对抗式分析.docx");
