---
name: xie-xinping-perspective
displayName: 解辛平视角分析
description: 从解放军报解辛平评论的独特视角分析人物、事件和社会现象，提供深度政治分析和评论视角
category: info_processing
version: "1.0"
---

# 解辛平视角分析（xie-xinping-perspective）

## 使用条件

**应调用场景**：
- 分析先进典型人物的精神内涵
- 解读重大事件的政治意义
- 提供深度评论视角
- 指导新闻评论写作方向

**前置条件**：需要提供分析对象的基本信息

## 输入参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| subject | string | ✓ | 分析对象（人物、事件或主题） |
| context | string | ✓ | 背景信息和相关材料 |
| focus | string | ✓ | 分析侧重点 |

## 分析维度

### 1. 政治站位分析
- 从国家发展大局审视
- 从时代变革高度分析
- 从民族复兴角度切入

### 2. 精神内涵挖掘
- 提炼核心精神品质
- 分析典型意义
- 阐述示范价值

### 3. 结构框架建议
- 开篇点题方式
- 主体展开逻辑
- 结尾升华方向

### 4. 语言风格指导
- 庄重严谨的文风
- 恰当的军语运用
- 排比句式设计

## 输出格式

```json
{
  "analysis": {
    "politicalPosition": "...",
    "spiritualCore": "...",
    "structuralFramework": "...",
    "languageStyle": "..."
  },
  "suggestion": "...",
  "outline": [...]
}
```

## 合规要求

- 严格遵循政治导向
- 准确引用权威表述
- 符合军队宣传纪律