import type { WorkflowStepDef } from "@/db/schema/workflows";

export interface BuiltinTemplate {
  name: string;
  description: string;
  category: "news" | "video" | "analytics" | "distribution" | "custom";
  triggerType: "manual" | "scheduled";
  triggerConfig?: { cron?: string; timezone?: string } | null;
  steps: WorkflowStepDef[];
  inputFields?: Array<{
    name: string;
    label: string;
    type: "text" | "textarea" | "url";
    required: boolean;
    placeholder?: string;
  }>;
}

function step(
  order: number,
  name: string,
  skillSlug: string,
  skillName: string,
  skillCategory: string,
  parameters: Record<string, any> = {}
): WorkflowStepDef {
  return {
    id: `step-${order}`,
    order,
    dependsOn: order > 1 ? [`step-${order - 1}`] : [],
    name,
    type: "skill",
    config: { skillSlug, skillName, skillCategory, parameters },
  };
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    name: "突发新闻快速报道",
    description: "从热点发现到稿件发布的全流程自动化，适用于突发新闻的快速响应",
    category: "news",
    triggerType: "manual",
    steps: [
      step(1, "热点确认与信息采集", "trend_monitor", "趋势监控", "perception"),
      step(2, "快速选题策划", "topic_extraction", "选题提取", "analysis"),
      step(3, "稿件快速撰写", "content_generate", "内容生成", "generation"),
      step(4, "质量审核", "quality_review", "质量审核", "management"),
      step(5, "多渠道发布", "publish_strategy", "发布策略", "management"),
    ],
  },
  {
    name: "发布会追踪报道",
    description: "实时追踪发布会要点，自动生成报道并分发到各渠道",
    category: "news",
    triggerType: "manual",
    steps: [
      step(1, "发布会信息采集", "news_aggregation", "新闻聚合", "perception"),
      step(2, "要点提取与稿件生成", "content_generate", "内容生成", "generation"),
      step(3, "内容审核", "quality_review", "质量审核", "management"),
      step(4, "全渠道分发", "publish_strategy", "发布策略", "management"),
    ],
  },
  {
    name: "每日热点早报",
    description: "每天早上自动聚合热点新闻，生成摘要早报",
    category: "news",
    triggerType: "scheduled",
    triggerConfig: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
    steps: [
      step(1, "全网热点聚合", "news_aggregation", "新闻聚合", "perception"),
      step(2, "热点摘要生成", "summary_generate", "摘要生成", "generation"),
    ],
  },
  {
    name: "短视频批量生产",
    description: "从选题到脚本到剪辑方案的短视频批量生产流程",
    category: "video",
    triggerType: "manual",
    steps: [
      step(1, "选题策划", "topic_extraction", "选题提取", "analysis"),
      step(2, "脚本生成", "script_generate", "脚本生成", "generation"),
      step(3, "剪辑计划", "video_edit_plan", "视频剪辑方案", "production"),
      step(4, "质量审核", "quality_review", "质量审核", "management"),
    ],
  },
  {
    name: "竞品监测周报",
    description: "每周自动抓取竞品动态，生成对比分析报告",
    category: "analytics",
    triggerType: "scheduled",
    triggerConfig: { cron: "0 9 * * 1", timezone: "Asia/Shanghai" },
    steps: [
      step(1, "竞品信息抓取", "competitor_analysis", "竞品分析", "analysis"),
      step(2, "数据对比分析", "data_report", "数据报告", "analysis"),
    ],
  },
  {
    name: "全渠道内容分发",
    description: "内容审核通过后，自动适配各渠道并分发，回收数据",
    category: "distribution",
    triggerType: "manual",
    steps: [
      step(1, "质量审核", "quality_review", "质量审核", "management"),
      step(2, "渠道适配与发布", "publish_strategy", "发布策略", "management"),
      step(3, "数据回收分析", "data_report", "数据报告", "analysis"),
    ],
  },
  {
    name: "深度专题制作",
    description: "从调研到策划到写作到视频的完整深度专题制作流程",
    category: "news",
    triggerType: "manual",
    steps: [
      step(1, "深度调研", "web_search", "网络搜索", "perception"),
      step(2, "专题策划", "topic_extraction", "选题提取", "analysis"),
      step(3, "长文写作", "content_generate", "内容生成", "generation"),
      step(4, "视频制作方案", "video_edit_plan", "视频剪辑方案", "production"),
      step(5, "质量审核", "quality_review", "质量审核", "management"),
    ],
  },
  {
    name: "每日热点新闻推荐",
    description: "每天早晨自动聚合全网热点，评估价值后生成推荐列表并推送到编辑部",
    category: "news",
    triggerType: "scheduled",
    triggerConfig: { cron: "0 7 * * *", timezone: "Asia/Shanghai" },
    steps: [
      step(1, "全网热点聚合", "news_aggregation", "新闻聚合", "perception"),
      step(2, "热度与价值评估", "topic_extraction", "选题提取", "analysis"),
      step(3, "推荐列表生成", "content_generate", "内容生成", "generation"),
      step(4, "推送到编辑部", "publish_strategy", "发布策略", "management"),
    ],
  },
  {
    name: "每周竞争对手情报报告",
    description: "每周一自动抓取竞品动态，对比分析差异与机会后生成情报报告推送管理层",
    category: "analytics",
    triggerType: "scheduled",
    triggerConfig: { cron: "0 10 * * 1", timezone: "Asia/Shanghai" },
    steps: [
      step(1, "竞品动态抓取", "competitor_analysis", "竞品分析", "perception"),
      step(2, "竞品内容对比", "data_report", "数据报告", "analysis"),
      step(3, "差异与机会分析", "topic_extraction", "选题提取", "analysis"),
      step(4, "情报报告生成", "content_generate", "内容生成", "generation"),
      step(5, "报告推送至管理层", "publish_strategy", "发布策略", "management"),
    ],
  },
  {
    name: "解辛平风格文章创作",
    description: "按照解放军报解辛平评论风格创作重要新闻评论文章，包含素材要素自检、结构规划、质量审核全流程",
    category: "news",
    triggerType: "manual",
    inputFields: [
      { name: "personName", label: "人物姓名", type: "text", required: true, placeholder: "请输入人物姓名" },
      { name: "personTitle", label: "职务岗位", type: "text", required: true, placeholder: "请输入职务岗位" },
      { name: "personUnit", label: "所在单位", type: "text", required: true, placeholder: "请输入所在单位" },
      { name: "achievements", label: "主要先进事迹", type: "textarea", required: true, placeholder: "请详细描述主要先进事迹，包括具体事例和数据" },
      { name: "honors", label: "所获荣誉", type: "textarea", required: true, placeholder: "请列举所获荣誉称号" },
      { name: "officialEvaluation", label: "官方评价", type: "textarea", required: true, placeholder: "请输入官方对该人物的评价原文" },
      { name: "propagandaFocus", label: "宣传重点", type: "textarea", required: true, placeholder: "请说明文章的宣传主题和重点" },
    ],
    steps: [
      step(1, "素材提交与要素自检", "task_planning", "任务规划", "analysis", {
        requiredFields: ["personName", "personTitle", "personUnit", "achievements", "honors", "officialEvaluation", "propagandaFocus"]
      }),
      step(2, "文章结构规划", "topic_extraction", "主题提取", "analysis", {
        structureType: "jiexping",
        sections: ["opening", "mainBody", "spiritElevation", "conclusion"]
      }),
      step(3, "解辛平风格创作", "content_generate", "内容生成", "generation", {
        style: "jiexping_style",
        personName: "{{personName}}",
        personTitle: "{{personTitle}}",
        personUnit: "{{personUnit}}",
        achievements: "{{achievements}}",
        honors: "{{honors}}",
        officialEvaluation: "{{officialEvaluation}}",
        propagandaFocus: "{{propagandaFocus}}",
        maxLength: 2000
      }),
      step(4, "质量审核", "quality_review", "质量审核", "management", {
        reviewTier: "strict",
        scenario: "politics_shenzhen"
      }),
    ],
  },
  {
    name: "网页内容检测",
    description: "利用浏览器自动化技术检测网页内容错误、页面错误、链接可用性、图片加载等问题",
    category: "analytics",
    triggerType: "manual",
    inputFields: [
      { name: "urls", label: "待检测网址", type: "textarea", required: true, placeholder: "请输入待检测的网页URL，每行一个" },
      { name: "timeout", label: "超时时间(秒)", type: "text", required: false, placeholder: "默认30秒" },
    ],
    steps: [
      step(1, "打开目标网页", "browser_automation", "浏览器自动化", "other", {
        action: "navigate"
      }),
      step(2, "页面加载检测", "browser_automation", "浏览器自动化", "other", {
        action: "screenshot"
      }),
      step(3, "内容质量分析", "quality_review", "质量审核", "management", {
        reviewTier: "standard",
        contentType: "article"
      }),
      step(4, "生成检测报告", "data_report", "数据报告", "analysis"),
    ],
  },
];
