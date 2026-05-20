---
name: page_inspection
displayName: 网页内容检测
description: 利用浏览器自动化技术检测网页内容错误、页面错误、链接可用性、图片加载等问题
category: automation
version: "1.0"

metadata:
  skill_kind: automation
  scenario_tags: [page_qa, web_inspection, content_check]
  compatibleEmployees: [xiaolei, xiaozi, xiaoshen]
  modelDependency: none
  requires:
    env: [CHROMIUM_PATH]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/tools/browser.ts
---

# 网页内容检测（page_inspection）

## 使用条件

**应调用场景**：
- 检测网页内容错误
- 检查页面加载状态
- 验证链接可用性
- 检查图片加载情况
- SEO基础检查

**前置条件**：需要提供待检测的URL列表

## 输入参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| urls | string[] | ✓ | 待检测的网页URL列表 |
| timeout | number | ✗ | 超时时间（秒），默认30 |
| checkLinks | boolean | ✗ | 是否检查链接，默认true |
| checkImages | boolean | ✗ | 是否检查图片，默认true |
| checkContent | boolean | ✗ | 是否检查内容质量，默认true |

## 检测项目

### 1. 页面加载检测
- HTTP状态码检查
- 页面加载时间
- DOM渲染完成时间
- JavaScript错误检测

### 2. 链接可用性检测
- 内部链接状态
- 外部链接状态
- 锚点链接有效性
- 死链检测

### 3. 图片加载检测
- 图片URL有效性
- 图片加载时间
- 图片尺寸检查
- 替代文本检测

### 4. 内容质量检测
- 文章内容错误检测
- 拼写检查
- 语法检查
- 内容完整性评估

### 5. SEO基础检查
- 页面标题长度
- Meta描述检查
- 关键词密度
- 结构化数据检测

## 操作流程

```
1. 遍历URL列表
2. 使用浏览器自动化打开每个页面
3. 等待页面加载完成
4. 执行各项检测
5. 收集检测结果
6. 生成检测报告
7. 关闭浏览器
```

## 输出格式

```json
{
  "summary": {
    "totalUrls": 5,
    "successCount": 4,
    "errorCount": 1,
    "warningCount": 8
  },
  "results": [
    {
      "url": "https://example.com/article/123",
      "status": "success",
      "loadTime": 2.3,
      "issues": [
        {
          "type": "content_error",
          "severity": "high",
          "location": "第3段第2句",
          "description": "时间错误：2024年应为2025年",
          "suggestion": "修正为2025年7月"
        },
        {
          "type": "broken_link",
          "severity": "medium",
          "location": "相关阅读区域",
          "description": "2个外链已失效",
          "suggestion": "更新或移除失效链接"
        }
      ],
      "screenshot": "base64_image_data"
    }
  ],
  "report": "完整检测报告..."
}
```

## 问题严重度分级

| 等级 | 标识 | 说明 |
|------|------|------|
| 严重 | 🔴 | 页面无法访问、内容错误、死链 |
| 中等 | 🟡 | 图片加载慢、SEO问题、性能问题 |
| 轻微 | 🟢 | 格式问题、建议优化项 |

## 注意事项

- 检测前确保网络连接正常
- 大型网站可能需要较长检测时间
- 部分网站可能有反爬机制
- 检测结果仅供参考，建议人工复核重要页面