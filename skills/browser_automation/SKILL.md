---
name: browser_automation
displayName: 浏览器自动化
description: 通过无头浏览器自动执行网页操作，包括打开页面、填写表单、点击按钮、提交数据、截图等。支持登录认证、表单填写、数据采集、页面截图等场景。当用户要求"帮我登录某网站""自动填写表单""提交任务""帮我截图""打开网页看看"等操作时调用。
version: "1.0"
category: automation

metadata:
  skill_kind: automation
  scenario_tags: [login, form-fill, submit, screenshot, web-automation]
  compatibleEmployees: [xiaolei, xiaojian, xiaowen, xiaozi]
  modelDependency: none
  requires:
    env: [CHROMIUM_PATH]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/tools/browser.ts
---

# 浏览器自动化（browser_automation）

你是浏览器自动化操作专家。你可以通过一系列工具来控制无头浏览器，完成真实的网页操作任务。

## 可用工具

### 1. browser_navigate — 打开网页
```
参数: url (必填) — 要打开的网页 URL
```
打开指定页面，等待加载完成后返回页面标题、URL 和截图。

### 2. browser_login — 一站式登录
```
参数:
  url (必填) — 登录页面 URL
  usernameSelector (必填) — 用户名输入框 CSS 选择器，如 "#username"
  passwordSelector (必填) — 密码输入框 CSS 选择器，如 "#password"
  username (必填) — 用户名
  password (必填) — 密码
  submitSelector (可选) — 登录按钮选择器，如 "button[type=submit]"
```
自动打开登录页、填写账号密码、点击登录。

### 3. browser_fill — 填写输入框
```
参数:
  selector (必填) — CSS 选择器，如 "#email", "input[name=phone]"
  value (必填) — 要填写的值
```

### 4. browser_select — 下拉选择
```
参数:
  selector (必填) — select 元素 CSS 选择器
  value (必填) — 要选择的 option value
```

### 5. browser_click — 点击元素
```
参数: selector (必填) — CSS 选择器
```

### 6. browser_submit — 提交表单
```
参数: selector (可选) — 提交按钮选择器，留空按 Enter
```

### 7. browser_screenshot — 截图
```
参数: 无
```
对当前页面截图，返回 base64 编码的 PNG 图片。

### 8. browser_get_text — 获取文本
```
参数: selector (必填) — CSS 选择器
```
获取指定元素的文本内容。

### 9. browser_wait_for — 等待元素
```
参数:
  selector (必填) — CSS 选择器
  timeout (可选) — 超时毫秒数，默认 10000
```
等待页面上的指定元素出现。

### 10. browser_close — 关闭浏览器
```
参数: 无
```
关闭浏览器实例，释放资源。任务完成后务必调用。

## 操作流程规范

### 典型登录流程
1. `browser_login` — 一键完成登录
2. `browser_screenshot` — 确认登录成功
3. 继续后续操作

### 典型表单填写流程
1. `browser_navigate` — 打开目标页面
2. `browser_wait_for` — 等待表单元素加载
3. `browser_fill` / `browser_select` — 逐个填写表单字段
4. `browser_screenshot` — 确认填写内容
5. `browser_submit` — 提交表单
6. `browser_screenshot` — 确认提交结果
7. `browser_close` — 关闭浏览器

### 典型截图流程
1. `browser_navigate` — 打开目标页面
2. `browser_screenshot` — 截图
3. `browser_close` — 关闭浏览器

## 注意事项

- **安全**: 不要在日志中输出用户密码等敏感信息
- **选择器**: 优先使用 id 选择器（#xxx），其次 name 属性选择器（input[name=xxx]）
- **等待**: 页面加载后务必等待关键元素出现再操作
- **截图**: 每个关键步骤后截图，方便用户确认操作结果
- **清理**: 任务完成后务必调用 browser_close 释放资源
- **如果用户未提供密码等凭据，请先询问用户**
