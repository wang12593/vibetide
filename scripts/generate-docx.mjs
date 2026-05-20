import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType, TableLayoutType, convertInchesToTwip, PageBreak, Footer, Header } from "docx";
import { writeFileSync } from "fs";

const FONT_TITLE = "黑体";
const FONT_BODY = "仿宋_GB2312";
const FONT_EN = "Times New Roman";
const COLOR_BLACK = "000000";
const COLOR_GRAY = "666666";
const COLOR_BLUE = "1a56db";
const COLOR_HEADER_BG = "1e3a5f";

function title1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 600, after: 400, line: 400 },
    children: [
      new TextRun({ text, font: FONT_TITLE, size: 36, bold: true, color: COLOR_BLACK }),
    ],
  });
}

function title2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 480, after: 240, line: 360 },
    children: [
      new TextRun({ text, font: FONT_TITLE, size: 24, bold: true, color: COLOR_BLACK }),
    ],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BLUE } },
  });
}

function title3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 360, after: 180, line: 340 },
    children: [
      new TextRun({ text, font: FONT_TITLE, size: 20, bold: true, color: COLOR_BLACK }),
    ],
  });
}

function title4(text) {
  return new Paragraph({
    spacing: { before: 240, after: 120, line: 320 },
    children: [
      new TextRun({ text, font: FONT_TITLE, size: 18, bold: true, color: COLOR_BLACK }),
    ],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 120, after: 120, line: 360 },
    indent: opts.indent ? { firstLine: 420 } : undefined,
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        font: FONT_BODY,
        size: 16,
        color: COLOR_BLACK,
        bold: opts.bold || false,
      }),
    ],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 340 },
    indent: { left: 420 + level * 360 },
    bullet: { level },
    children: [
      new TextRun({ text, font: FONT_BODY, size: 16, color: COLOR_BLACK }),
    ],
  });
}

function makeTable(data) {
  const headers = data[0];
  const rows = data.slice(1);
  
  const hr = new TableRow({
    tableHeader: true,
    children: headers.map((h) => new TableCell({
      shading: { type: ShadingType.SOLID, color: COLOR_HEADER_BG },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: h, font: FONT_BODY, size: 15, bold: true, color: "ffffff" })],
      })],
    })),
  });

  const dr = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => new TableCell({
      shading: { type: ShadingType.SOLID, color: ri % 2 === 0 ? "f5f5f5" : "ffffff" },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({
        alignment: ci > 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { line: 320 },
        children: [new TextRun({ text: cell, font: FONT_BODY, size: 15, color: COLOR_BLACK })],
      })],
    })),
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [hr, ...dr],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4 },
      bottom: { style: BorderStyle.SINGLE, size: 4 },
      left: { style: BorderStyle.SINGLE, size: 4 },
      right: { style: BorderStyle.SINGLE, size: 4 },
    },
  });
}

function pb() {
  return new Paragraph({ children: [new PageBreak()] });
}

function emptyLine() {
  return new Paragraph({ spacing: { before: 200 }, children: [] });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT_BODY, size: 16, color: COLOR_BLACK },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(1.5),
          bottom: convertInchesToTwip(1.5),
          left: convertInchesToTwip(2.5),
          right: convertInchesToTwip(2),
        },
      },
      header: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 100 },
            children: [new TextRun({ text: "VibeTide AI智能内容协作平台项目立项文档", font: FONT_TITLE, size: 16, color: COLOR_BLACK })],
          }),
        ],
      }),
      footer: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 100 },
            children: [new TextRun({ text: "第 {PAGE} 页 共 {SECTION-PAGES} 页", font: FONT_BODY, size: 14, color: COLOR_GRAY })],
          }),
        ],
      }),
    },
    children: [
      title1("VibeTide AI智能内容协作平台项目立项文档"),
      emptyLine(),
      para("（公文格式）", { center: true }),
      emptyLine(),
      para("文件编号：VT-2026-PRO-001    密级：内部资料    版本：V1.0    编制日期：2026年5月", { center: true }),
      emptyLine(),
      pb(),

      title2("一、背景"),
      para("当前，传统媒体与新媒体融合进入深水区，行业面临三重结构性挑战。第一，内容供给效率与市场需求严重失衡。全媒体时代，用户内容消费频次提升3-5倍，但传统采编团队的日均产出能力基本恒定。地市级融媒体中心普遍存在\"稿源缺口\"，原创内容产能仅能满足约40%的分发需求，大量频道时段和新媒体位处于低填充率状态。", { indent: true }),
      para("第二，多平台分发导致运营成本线性增长。一个内容团队往往需要同时覆盖App、网站、微信、抖音、快手、小红书等6-10个渠道，每个渠道的排版规范、审核标准、发布节奏各不相同。人工适配带来的边际成本居高不下，且错误率随渠道数量递增。", { indent: true }),
      para("第三，内容质量一致性难以保障。传统模式下，选题策划、稿件撰写、审核把关高度依赖个人经验，缺乏系统化的质量标准与流程闭环。热点响应速度慢、选题重复率高、审核标准执行不一致等问题普遍存在。", { indent: true }),
      para("与此同时，大语言模型与多模态AI技术已跨越概念验证阶段，进入产业落地窗口期。AI在文本生成、语义理解、内容审核、视频脚本生成等环节已展现出可量化的效率提升（行业平均提效3-8倍）。率先将AI能力嵌入内容生产全链路的媒体机构，将在内容时效性、覆盖广度和运营成本上形成显著竞争优势。", { indent: true }),
      para("基于上述行业痛点与技术窗口，建设一套以AI为核心驱动力的智能内容协作平台，已成为媒体数字化转型的刚性需求。", { indent: true }),

      title2("二、建设内容"),
      title3("（一）项目意义"),
      title4("1.战略价值"),
      para("本项目将AI能力从\"单点工具\"升级为\"系统级能力\"，实现从辅助工具到生产基础设施的战略跃迁。平台建成后，媒体机构可构建\"AI数字员工团队\"协作范式，将人力从重复性内容生产中释放，聚焦于创意策划与价值判断等高阶工作，实现组织能力的结构性升级。", { indent: true }),

      title4("2.业务价值"),
      para("项目预期实现以下可量化的业务目标：内容产出效率提升，日均原创内容产出量提升300%以上；多渠道覆盖能力增强，单条内容自动适配分发渠道数≥8个；热点响应时效缩短，从热点发生到内容上线缩短至30分钟以内；内容审核通过率提高，AI辅助审核后一次通过率≥95%；运营人效提升，单人管理的频道/栏目数量提升200%。", { indent: true }),

      title4("3.建设合理性"),
      bullet("需求合理性：平台覆盖的37个功能模块和27+场景模板均来自媒体内容生产的真实业务流程，每个模块对应一个可独立度量的业务指标，不存在脱离实际需求的\"技术堆砌\"。"),
      bullet("架构合理性：采用\"主智能体统筹+专项AI员工协作\"的组织模式，天然映射媒体采编团队的实际分工结构（策划→采写→审核→分发→复盘），降低了组织适配成本和学习门槛。"),
      bullet("风险可控性：平台采用\"AI辅助、人工把关\"的人机协作模式，所有关键环节（发布、审核、敏感内容判断）保留人工决策节点，确保内容安全底线不被突破，符合媒体行业监管合规要求。"),

      title3("（二）设计要求"),
      title4("1.设计理念"),
      para("平台设计围绕三个核心理念：AI优先，人机协同——将AI智能体定位为\"数字员工\"而非工具，每个智能体拥有独立身份、技能树和协作能力，人类用户以\"管理者\"身份进行编排和决策；场景驱动，技能组合——不预设固定流程，通过12大业务场景×27+技能的自由组合，覆盖从热点发现到内容分发的全链路，同时保持每个环节的可替换性；渐进智能，持续学习——平台具备记忆和自优化机制，智能体在执行任务过程中积累经验、提升准确率，而非每次从零开始。", { indent: true }),

      title4("2.设计原则"),
      bullet("模块化原则：智能体、技能、工作流、知识库各自独立，可单独升级或替换，不产生连锁影响。"),
      bullet("可扩展原则：新增智能体角色、新增技能、新增分发渠道均无需改动核心框架。"),
      bullet("多租户隔离原则：不同组织的数据、配置、智能体实例完全隔离，互不可见。"),
      bullet("可观测原则：任务执行的每个步骤状态可追踪、可回溯，支持异常定位。"),
      bullet("降级容错原则：AI服务不可用时，平台基础功能（内容编辑、任务查看）不受影响。"),

      title3("（三）实现需求"),
      bullet("R-01 智能体调度：支持主智能体统筹分配任务至专业智能体，支持并行执行与依赖排序，实现一次指令驱动多角色协作，降低操作成本。"),
      bullet("R-02 对话交互：支持自然语言发起任务，系统自动识别意图并路由至对应技能，支持多轮澄清和流式输出，用户无需学习操作路径，对话即操作。"),
      bullet("R-03 知识管理：支持个人/团队级知识库创建，支持文档导入、网页抓取、语义检索，智能体执行时自动调用相关知识，使智能体具备组织上下文，输出更贴合业务。"),
      bullet("R-04 任务编排：支持可视化任务流程配置，支持条件分支、失败重试、实时进度展示，复杂工作流可沉淀为模板，团队可复用。"),
      bullet("R-05 内容生产：支持图文、视频脚本、播客稿等多格式内容生成，内置质量审核和敏感词过滤，一站式完成从选题到成稿。"),
      bullet("R-06 多渠道分发：对接外部CMS系统，支持文章入库、栏目映射、发布状态回查，减少人工搬运，发布效率提升。"),
      bullet("R-07 数据反馈：支持发布后数据回收（阅读量、互动率等），形成\"生产→发布→分析→优化\"闭环，用数据驱动内容策略迭代。"),

      title3("（四）部署要求"),
      bullet("DEP-01 容器化交付：所有服务模块以容器镜像形式交付，统一编排调度，确保开发、测试、生产环境一致性。"),
      bullet("DEP-02 内网隔离部署：核心业务服务与数据库部署于内网，仅网关层暴露公网入口；AI推理服务与向量检索服务通过内网专线调用。"),
      bullet("DEP-03 高可用冗余：关键服务采用主从/多副本部署，单节点故障时自动切换，业务无感知；数据库具备自动故障转移与定时备份能力。"),
      bullet("DEP-04 弹性伸缩：应用层支持基于负载指标的自动扩缩容，应对峰值流量；AI推理层支持按并发请求数动态调度推理实例。"),
      bullet("DEP-05 无中断发布：生产环境支持滚动更新，发布过程可观测、可快速回滚。"),
      bullet("DEP-06 日志与监控：全链路日志采集与集中存储，关键指标实时监控并配置告警阈值。"),

      title3("（五）测试要求"),
      bullet("TST-01 功能测试：覆盖全部功能模块的核心业务流程，包括AI员工协作链路、内容生产全流程、CMS发布对接等关键路径，用例覆盖率不低于85%。"),
      bullet("TST-02 性能测试：模拟峰值用户并发场景，验证响应时间、吞吐量与资源占用满足性能指标要求；长时运行（72小时）稳定性测试无内存泄漏与服务降级。"),
      bullet("TST-03 安全测试：覆盖身份认证、权限隔离（多租户数据隔离）、输入校验、接口防篡改；敏感数据传输与存储加密合规。"),
      bullet("TST-04 兼容性测试：主流浏览器（Chrome、Firefox、Edge、Safari）最近两个大版本兼容；移动端自适应布局可用。"),
      bullet("TST-05 回归测试：每次迭代发布前执行自动化回归，确保已有功能不受影响。"),

      title3("（六）安全保障"),
      title4("1.LLM对话安全"),
      bullet("SEC-LLM-01：平台应对大模型输出内容进行实时安全过滤，拦截涉政、涉黄、涉暴等违规内容，确保输出符合内容安全规范，违规内容拦截率≥99%，误拦率≤1%。"),
      bullet("SEC-LLM-02：平台应具备提示词注入攻击防御能力，识别并阻断恶意构造的输入指令，注入攻击识别率≥98%，防御成功率≥99%。"),
      bullet("SEC-LLM-03：平台应对敏感话题关键词进行分级管控，支持按组织维度配置敏感词策略，敏感词库覆盖≥5000条，策略生效延迟≤5秒。"),
      bullet("SEC-LLM-04：平台应记录所有AI对话的完整交互日志，支持事后追溯与审计，日志保留≥180天，查询响应≤3秒。"),

      title4("2.Skills执行安全"),
      bullet("SEC-SKILL-01：每个Skill应具备明确的权限边界声明，运行时仅能访问其声明的资源与接口，权限越界事件拦截率100%。"),
      bullet("SEC-SKILL-02：平台应对Skill执行过程进行实时监控，异常行为（超时、资源超限、错误率飙升）自动熔断，熔断响应时间≤2秒，误熔断率≤0.5%。"),
      bullet("SEC-SKILL-03：平台应记录每个Skill的完整执行轨迹（调用链、输入输出、耗时），支持审计追踪，审计记录完整率100%，轨迹查询响应≤5秒。"),

      title4("3.Skills上传安全"),
      bullet("SEC-UPLOAD-01：用户上传的Skill文件应经过恶意内容检测，包括代码注入、恶意脚本、隐藏指令等，恶意内容检出率≥99%。"),
      bullet("SEC-UPLOAD-02：平台应对上传文件进行格式校验、大小限制、类型白名单过滤，拒绝不合规文件，不合规文件拦截率100%。"),
      bullet("SEC-UPLOAD-03：上传文件应在独立沙箱环境中完成解析与验证，隔离其对主系统的影响，沙箱逃逸防护率100%。"),

      title4("4.数据安全"),
      bullet("SEC-DATA-01：平台应实现严格的多租户数据隔离，确保不同组织间的数据不可互访，隔离有效性验证通过率100%。"),
      bullet("SEC-DATA-02：平台所有数据传输应采用TLS 1.2及以上加密协议，静态存储敏感字段应加密，传输加密覆盖率100%。"),
      bullet("SEC-DATA-03：平台应支持自动化数据备份，并具备在≤4小时内完成数据恢复的能力，备份成功率≥99.9%，RTO≤4h，RPO≤1h。"),

      title4("5.访问安全"),
      bullet("SEC-ACCESS-01：平台应提供统一的身份认证机制，支持邮箱密码登录及第三方OAuth接入，认证成功率≥99.9%。"),
      bullet("SEC-ACCESS-02：平台应实现基于角色的访问控制（RBAC），支持组织级、团队级、功能级三层层级权限管理，权限校验响应≤50ms。"),
      bullet("SEC-ACCESS-03：平台应记录所有用户操作日志（登录、数据访问、配置变更），支持按时间/用户/操作类型检索，操作审计覆盖率100%，日志保留≥180天。"),

      pb(),
      title2("三、功能指标"),
      title3("（一）智能体协作指标"),
      para("意图识别准确率≥92%，即用户对话意图被正确路由至对应技能的比例；单次对话响应时间≤3s（首字输出），即流式输出场景下首字延迟；多智能体协作成功率≥95%，含主智能体调度+子任务执行的端到端成功率；任务完成准确率≥85%，即生成内容无需人工大幅修改即可直接使用的比例；上下文记忆命中率≥80%，即智能体执行任务时成功调用相关知识库内容的比例；任务推送成功率≥99.8%，即主智能体分发任务到目标员工的成功率；通知送达率100%，即任务完成后实时通知的送达率。", { indent: true }),

      title3("（二）Skills平台指标"),
      para("内置技能覆盖数≥27个，涵盖选题、写作、审核、发布等全链路技能；工作流模板数≥27个，覆盖12大业务场景的预设模板；技能热加载时间≤5s，即新增或更新技能后生效时间；技能创建成功率（手动）≥99%，技能创建成功率（上传）≥95%；技能组合上限为10个技能串联，即单个工作流中技能组合的最大数量；CMS入库发布成功率≥99%，即文章从提交到CMS上线的端到端成功率；栏目同步准确率100%，即CMS栏目映射同步的准确率。", { indent: true }),

      title3("（三）部署运维指标"),
      para("平台可用性≥99.9%（月度），不含计划维护窗口；页面加载时间≤2s，即核心页面首屏渲染时间；故障恢复时间（MTTR）≤30min，即从故障发现到服务恢复；定时任务执行准确率100%，即调度任务准时执行率；数据库迁移成功率100%，即Schema变更推送成功率。", { indent: true }),

      title3("（四）安全指标"),
      para("敏感词拦截率≥99%，即内容发布前自动审核拦截违规内容；多租户数据泄露0次，即组织间数据严格隔离，无越权访问；权限校验覆盖率100%，即所有API和页面操作均经过角色权限校验；操作审计日志留存≥180天，即关键操作（发布、删除、权限变更）可追溯；恶意技能上传检测率≥99.9%，即用户上传技能的恶意内容检出率；LLM不当内容过滤率≥99.9%，即模型输出违规内容的拦截率；提示词攻击防御率≥99%，即Prompt注入攻击的防御成功率。", { indent: true }),

      pb(),
      title2("四、性能指标"),
      title3("（一）并发性能资源规划"),
      para("注：以下指标基于Qwen3-72B-Instruct模型+昇腾910B方案测算。Qwen3-72B INT4需36GB显存，昇腾910B单卡32GB，需2卡组成推理单元支持1并发。实际部署需预留30%冗余应对突发，建议采用混合云架构弹性应对峰值流量。", { indent: true }),
      makeTable([["指标维度", "初期（100人）", "中期（200人）", "成熟期（500人）", "峰值（800人）"], ["计算资源（CPU/内存）", "8核16GB×4实例", "8核16GB×8实例", "16核32GB×16实例", "16核32GB×24实例"], ["AI推理资源（GPU）", "昇腾910B×24卡", "昇腾910B×48卡", "昇腾910B×98卡", "昇腾910B×156卡（含云弹性）"], ["存储资源", "200GB SSD", "500GB SSD", "1TB SSD+对象存储", "2TB SSD+对象存储"], ["网络带宽", "50Mbps", "100Mbps", "200Mbps", "500Mbps"], ["页面QPS", "≥30", "≥60", "≥150", "≥250"], ["API QPS", "≥60", "≥120", "≥300", "≥500"], ["平均响应时间", "≤1s", "≤1s", "≤1.2s", "≤1.5s"]]),

      title3("（二）系统稳定性指标"),
      makeTable([["指标项", "目标值"], ["系统可用性（月度）", "≥99.9%"], ["单点故障恢复时间", "≤30秒（自动切换）"], ["数据备份频率", "每日全量+实时增量"], ["数据恢复RTO", "≤1小时"], ["数据恢复RPO", "≤5分钟"], ["发布回滚时间", "≤10分钟"], ["告警响应时间", "≤5分钟"]]),

      title3("（三）数据处理性能指标"),
      makeTable([["指标项", "目标值"], ["向量检索响应（1024维）", "≤300ms（Top-10召回）"], ["AI内容生成首字延迟", "≤500ms（Qwen3-72B流式输出，昇腾910B模型并行）"], ["AI内容生成速度", "≥20 tokens/s"], ["批量任务处理吞吐", "≥30任务/分钟（GPU密集型）"], ["热榜数据抓取延迟", "≤5分钟（从发布到入库）"], ["CMS文章发布延迟", "≤3分钟（从提交到上线）"], ["知识库文档向量化", "≤60秒/篇（万字符级）"]]),

      title3("（四）低峰时间性能指标"),
      makeTable([["指标项", "目标值"], ["后半夜定时任务执行效率", "资源利用率≥80%"], ["系统维护窗口", "每月≤4小时，且需安排在非工作时间"]]),

      pb(),
      title2("五、资源测算"),
      title3("（一）硬件与模型配置"),
      makeTable([["硬件/模型", "参数", "说明"], ["GPU", "昇腾910B", "32GB显存，256 TOPS算力"], ["模型", "Qwen3-72B-Instruct", "INT4量化需36GB显存"]]),
      para("配置说明：Qwen3-72B INT4需36GB显存，昇腾910B单卡仅32GB，需采用模型并行方案，每2张昇腾910B组成一个推理单元，支持1并发请求。", { indent: true }),

      title3("（二）资源测算逻辑"),
      para("基础公式：推理单元数 = 并发数 × (1 + 预留比例)。单推理单元 = 2张昇腾910B。以成熟期500日活为例，基础问答需3并发，定时任务峰值需25并发，预留30%，总计需49个推理单元，即98张昇腾910B。", { indent: true }),

      title3("（三）综合GPU需求（昇腾910B）"),
      makeTable([["阶段", "日活", "推理单元数", "GPU数量（2卡/单元）"], ["初期", "100人", "12", "24卡"], ["中期", "200人", "24", "48卡"], ["成熟期", "500人", "49", "98卡"], ["峰值", "800人", "78", "156卡"]]),
      para("说明：现有2张A6000需全部替换为昇腾910B。初期需采购24张昇腾910B（3台8卡服务器），建议采用混合云架构弹性应对峰值流量。", { indent: true }),

      title3("（四）方案对比分析"),
      makeTable([["维度", "昇腾910B方案", "A6000方案"], ["单卡显存", "32GB", "48GB"], ["单卡支持并发", "0.5（需2卡）", "1"], ["成熟期GPU需求", "98卡", "37卡"], ["成本估算", "1854万", "377万"], ["国产化", "100%", "0%"], ["生态成熟度", "中", "高"]]),
      para("结论：昇腾910B方案成本更高但完全自主可控，适合高安全要求场景；A6000方案成本效益更高，适合快速上线。建议根据业务安全要求选择。", { indent: true }),

      title3("（五）成本估算（昇腾910B）"),
      makeTable([["配置项", "单价（元）", "数量", "小计（元）"], ["昇腾910B芯片", "80,000", "98", "7,840,000"], ["昇腾服务器（8卡）", "800,000", "13", "10,400,000"], ["网络存储", "200,000", "1", "200,000"], ["软件许可", "100,000", "1", "100,000"], ["总计", "-", "-", "18,540,000"]]),

      pb(),
      para("文档结束", { center: true }),
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync("VibeTide项目立项文档_公文格式_昇腾910B.docx", buffer);
console.log("Word文档已生成: VibeTide项目立项文档_公文格式_昇腾910B.docx");
