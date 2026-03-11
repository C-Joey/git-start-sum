# ⭐ GitHub Stars Manager (GSM)

[English](./README.md) | [简体中文](./README_zh.md)

一款专为开发者设计的 Chrome 扩展插件，助你高效管理、分类、检索 GitHub Star 仓库。集成 AI 智能总结与自动化标签推荐。

![GitHub Stars Manager](icons/icon128.png)

### ✨ 核心特性

- **🚀 零延迟秒开**：深度优化缓存机制，即使你有上千个 Star，Popup 列表也能瞬间加载。
- **🤖 AI 智能加持**：一键生成项目 README 摘要，AI 自动推荐 1-3 个最贴切的标签并自动应用。
- **🏷️ 标签管理系统**：支持自定义标签、颜色区分，并提供极致流畅的模糊搜索补全建议。
- **📝 动态备注**：为重要项目随手记下心得或用途，搜索时可全文匹配。
- **📅 历史足迹**：自动记录你最近浏览过的 GitHub 仓库，支持多端数据同步。
- **☁️ 数据云同步**：自动通过你的私有仓库同步所有备注、标签和历史，永不丢失。
- **🌓 极简体验**：原生 Chrome 风格 UI，完美匹配浏览器的深浅色主题模式。

### 📦 安装指南

1. 下载本项目或使用 `git clone` 到本地。
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`。
3. 开启右上角的 **“开发者模式”**。
4. 点击 **“加载已解压的扩展程序”**。
5. 选择本项目所在的文件夹即可。

### ⚙️ 配置说明

1. **GitHub Token**: 首次使用需创建 Personal Access Token (需要 `repo` 和 `gist` 权限)。
2. **AI 配置 (可选)**:
   - 支持 Google Gemini API (推荐)。
   - 支持 OpenAI 或其他兼容 OpenAI 格式的自定义 API 端点。
   - 填写 URL 和 Key 后，点击“验证”可自动拉取可用模型列表。

### 🛠️ 技术栈

- **Manifest V3**: 最新 Chrome 扩展标准。
- **Vanilla CSS**: 纯原生 CSS 打造的高性能、响应式 UI。
- **Chrome Storage API**: 本地高效缓存。
- **GitHub REST API**: 用于列表获取与私有仓同步。

---

*Developed with the assistance of Antigravity | 由 Antigravity 协助开发*
