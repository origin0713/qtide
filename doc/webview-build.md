# Webview 构建文档

## 概述

Qtide 的设置面板是一个独立的 Vue 3 + Vite 项目，位于 `webview/settings/` 目录下。构建输出会放到 `res/html/settings/`，由扩展的 `openSettings()` 方法加载。

## 目录结构

```
webview/settings/
├── package.json          # 依赖：vue, vite, @vitejs/plugin-vue
├── vite.config.js        # 构建配置，输出到 ../../res/html/settings/
├── index.html            # Vite 入口 HTML
└── src/
    ├── main.js           # createApp + mount
    └── App.vue           # 主组件：标签页 + 字段渲染
```

## 构建步骤

```bash
# 1. 安装依赖（首次或依赖变更时）
cd webview/settings
npm install

# 2. 构建
npm run build
```

构建输出会自动写入 `res/html/settings/`：

```
res/html/settings/
├── index.html
├── css/
│   └── app.css
└── js/
    └── app.js
```

## 加载机制

扩展在 `QtProjectExplorer.openSettings()` 中执行以下步骤：

1. 读取 `res/html/settings/index.html`
2. 用 `panel.webview.asWebviewUri()` 转换 CSS/JS 的资源路径
3. 设置 `panel.webview.html`
4. 监听 `qtide.settings.launched` 消息，回复 settings 模型
5. 接收前端提交的表单数据

## 前后端通信协议

| 方向 | 消息 | 说明 |
|------|------|------|
| Webview → Extension | `"qtide.settings.launched"` | 页面就绪，请求配置数据 |
| Extension → Webview | `{ config: { groups: [...] } }` | 配置模型（分组 + 字段定义） |
| Webview → Extension | `{ key: value, ... }` | 用户点击 Save 后提交的表单数据 |

## 字段类型

| type | 渲染组件 | 数据格式 |
|------|----------|----------|
| `text` | `<input type="text">` | string |
| `textarea` | `<textarea>` | string |
| `dropdown` | `<select>` | string (value) |
| `checkbox` | `<input type="checkbox">` | boolean |

## 开发指南

- 修改 `App.vue` 后需要重新 `npm run build`
- 样式使用 `var(--vscode-*)` CSS 变量以适配 VS Code 主题
- `acquireVsCodeApi()` 由 VS Code Webview 注入
