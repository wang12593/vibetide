import type { RequirementTemplate, ChatIntentType } from "./types";

export const REQUIREMENT_TEMPLATES: Record<ChatIntentType, RequirementTemplate> = {
  content_creation: {
    intentType: "content_creation",
    label: "内容创作",
    required: [
      { field: "topic", label: "主题/题材", type: "text", required: true },
      { field: "wordCount", label: "字数", type: "number", required: true },
    ],
    optional: [
      {
        field: "style",
        label: "风格",
        type: "select",
        required: false,
        options: [
          { label: "专业严谨", value: "专业严谨" },
          { label: "轻松活泼", value: "轻松活泼" },
          { label: "深度分析", value: "深度分析" },
          { label: "快讯简报", value: "快讯简报" },
        ],
      },
      { field: "audience", label: "目标受众", type: "text", required: false },
      { field: "keywords", label: "关键词", type: "text", required: false },
    ],
  },
  deep_analysis: {
    intentType: "deep_analysis",
    label: "深度分析",
    required: [
      { field: "topic", label: "分析主题", type: "text", required: true },
      {
        field: "depth",
        label: "分析深度",
        type: "select",
        required: true,
        options: [
          { label: "浅层概述", value: "浅层概述" },
          { label: "中层分析", value: "中层分析" },
          { label: "深层洞察", value: "深层洞察" },
        ],
      },
    ],
    optional: [
      { field: "dimensions", label: "分析维度", type: "text", required: false },
      { field: "timeRange", label: "时间范围", type: "text", required: false },
    ],
  },
  data_analysis: {
    intentType: "data_analysis",
    label: "数据分析",
    required: [
      { field: "dimension", label: "分析维度", type: "text", required: true },
      { field: "timeRange", label: "时间范围", type: "text", required: true },
    ],
    optional: [
      { field: "compareMetrics", label: "对比指标", type: "text", required: false },
      {
        field: "outputFormat",
        label: "输出格式",
        type: "select",
        required: false,
        options: [
          { label: "表格", value: "表格" },
          { label: "图表", value: "图表" },
          { label: "文字报告", value: "文字报告" },
        ],
      },
    ],
  },
  media_production: {
    intentType: "media_production",
    label: "媒体制作",
    required: [
      {
        field: "videoType",
        label: "视频类型",
        type: "select",
        required: true,
        options: [
          { label: "新闻短视频", value: "新闻短视频" },
          { label: "专题片", value: "专题片" },
          { label: "直播切片", value: "直播切片" },
          { label: "宣传片", value: "宣传片" },
        ],
      },
      { field: "duration", label: "时长", type: "text", required: true },
    ],
    optional: [
      { field: "style", label: "风格", type: "text", required: false },
      { field: "voiceover", label: "配音要求", type: "text", required: false },
      {
        field: "subtitle",
        label: "字幕需求",
        type: "select",
        required: false,
        options: [
          { label: "需要", value: "需要" },
          { label: "不需要", value: "不需要" },
        ],
      },
    ],
  },
  information_retrieval: {
    intentType: "information_retrieval",
    label: "信息检索",
    required: [
      { field: "query", label: "检索关键词", type: "text", required: true },
    ],
    optional: [
      { field: "source", label: "来源偏好", type: "text", required: false },
      { field: "timeRange", label: "时间范围", type: "text", required: false },
      { field: "region", label: "地域范围", type: "text", required: false },
    ],
  },
  content_review: {
    intentType: "content_review",
    label: "内容审核",
    required: [
      {
        field: "contentType",
        label: "审核内容类型",
        type: "select",
        required: true,
        options: [
          { label: "文章", value: "文章" },
          { label: "视频", value: "视频" },
          { label: "图片", value: "图片" },
        ],
      },
      { field: "reviewFocus", label: "审核重点", type: "text", required: true },
    ],
    optional: [
      { field: "standard", label: "审核标准", type: "text", required: false },
    ],
  },
  publishing: {
    intentType: "publishing",
    label: "发布分发",
    required: [
      {
        field: "platform",
        label: "发布平台",
        type: "select",
        required: true,
        options: [
          { label: "APP", value: "APP" },
          { label: "网站", value: "网站" },
          { label: "微信", value: "微信" },
          { label: "微博", value: "微博" },
          { label: "抖音", value: "抖音" },
        ],
      },
      { field: "contentType", label: "内容类型", type: "text", required: true },
    ],
    optional: [
      { field: "schedule", label: "发布时间", type: "text", required: false },
      { field: "channel", label: "栏目", type: "text", required: false },
    ],
  },
  general_chat: {
    intentType: "general_chat",
    label: "自由对话",
    required: [],
    optional: [],
  },
};

export function getTemplateForIntent(
  intentType: ChatIntentType
): RequirementTemplate | null {
  if (intentType === "general_chat") return null;
  return REQUIREMENT_TEMPLATES[intentType] ?? null;
}
