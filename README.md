# GitHub Stars Manager

[中文](./README.md) | [English](./README_en.md)

GitHub Stars Manager 是一个原生 Manifest V3 Chrome 扩展，用于把 GitHub Stars 管理成可检索、可分类、可备注、可同步的个人项目知识库。

它适合长期收藏大量开源项目、需要回看技术选型、希望为仓库补充标签/备注/AI 摘要，并希望把这些数据同步到自己 GitHub 私有仓库的开发者。

项目地址：<https://github.com/C-Joey/git-start-sum>

![GitHub Stars Manager](icons/icon128.png)

## 功能概览

- **Star 列表管理**：读取 GitHub Star 仓库，支持搜索、标签筛选和快速打开仓库。
- **标签与备注**：为仓库添加自定义标签和个人备注，搜索时会同时匹配仓库信息、标签、备注和 AI 摘要。
- **AI 摘要**：支持 Google Gemini API、OpenAI、OpenAI Responses API、Chat Completions，以及自定义 OpenAI 兼容接口。
- **GitHub 页面注入**：在 GitHub 仓库页面直接打开备注/标签面板，减少来回切换。
- **浏览历史**：可选记录访问过的 GitHub 仓库页面，便于找回最近看过但未 Star 或未整理的项目。
- **云同步**：将标签、备注、AI 摘要、Star 缓存和浏览历史同步到你自己的 GitHub 仓库。
- **数据导出**：支持导出 Markdown 和 JSON，包含缓存到的 Star 列表以及已整理的备注、标签和 AI 数据。
- **主题与语言**：支持跟随系统、白天模式、黑夜模式，以及简体中文/English。
- **Linux 输入法兼容**：提供“在标签页打开”入口，用普通标签页绕过 Chrome Popup 在 Linux 下的输入法焦点问题。

## 界面预览

<table>
  <tr>
    <td width="50%">
      <img src="docs/assets/popup.png" alt="插件弹窗" width="100%">
    </td>
    <td width="50%">
      <img src="docs/assets/repo-modal.png" alt="仓库编辑弹窗" width="100%">
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/assets/options-sync.png" alt="GitHub 与同步设置" width="100%">
    </td>
    <td width="50%">
      <img src="docs/assets/options-ai.png" alt="AI 设置" width="100%">
    </td>
  </tr>
</table>

## 快速开始

目前扩展尚未发布到 Chrome Web Store，需要以本地扩展方式加载。

1. 下载本项目，或执行：

   ```bash
   git clone https://github.com/C-Joey/git-start-sum.git
   ```

2. 打开 Chrome，进入 `chrome://extensions/`。
3. 开启右上角的 **开发者模式**。
4. 点击 **加载已解压的扩展程序**。
5. 选择本项目根目录。
6. 点击扩展图标，进入设置页填写 GitHub Token。

更新代码后，需要回到 `chrome://extensions/`，点击该扩展卡片上的 **重新加载**。

## GitHub Token 配置

首次使用需要配置 GitHub Personal Access Token。推荐使用 classic token，权限模型更简单。

| 使用场景 | 推荐权限 |
| --- | --- |
| 只读取公开 Star 仓库 | 默认 GitHub API 访问即可 |
| 读取私有 Star / 私有仓库 | `repo` scope |
| 创建并写入同步仓库 | `repo` scope |
| Gist | 当前版本不需要 `gist` 权限 |

Token 只保存在 Chrome 扩展本地存储中，用于访问 GitHub API。不要把 Token 提交到仓库，也不要把同步数据仓库设为公开，除非你明确希望公开这些数据。

### GitHub API 代理

设置页支持配置 GitHub API 代理。留空时默认使用：

```text
https://api.github.com
```

如果使用代理，请确保代理路径返回的是 GitHub API JSON，而不是 HTML 页面。扩展会对 API 做 `HEAD /user` 预检查；如果代理返回 HTML，例如 Cloudflare Challenge 页面，验证会失败并提示关闭 API 路径上的挑战页。

## 同步仓库

开启云同步后，扩展会在你配置的 GitHub 仓库中写入数据文件。推荐使用私有仓库。

同步仓库默认名称为：

```text
my-github-stars
```

同步内容包括：

- `data.json`：完整结构化数据，包括标签、备注、AI 摘要、Star 缓存、设置和历史数据。
- `README.md`：面向人工阅读的 Star 摘要。
- `HISTORY.md`：浏览历史摘要，取决于是否启用历史记录。

设置页的同步区域提供 **打开** 按钮，可以直接跳转到当前用户的同步仓库：

```text
https://github.com/<your-login>/<sync-repo-name>
```

如果本地尚未记录 GitHub 用户名，扩展会使用当前 Token 查询 `/user` 后再打开仓库。

## AI 摘要配置

AI 功能是可选功能。不配置 AI 时，Star 列表、标签、备注、搜索、历史、同步和导出都可以正常使用。

当前支持：

- **Google Gemini API**
- **OpenAI**
- **自定义 OpenAI 兼容接口**

OpenAI 配置分为两部分：

| 配置项 | 说明 |
| --- | --- |
| API 地址 | 默认 `https://api.openai.com`，也可以填写自己的中转地址 |
| 接口类型 | 支持 `Responses API` 和 `Chat Completions` |
| 模型名称 | 可以从模型列表选择，也可以手动输入 |

如果填写的是基础地址，例如：

```text
https://api.openai.com
```

扩展会根据选择的接口类型自动补全为：

```text
/v1/responses
```

或：

```text
/v1/chat/completions
```

如果直接填写完整接口路径，扩展会根据路径自动识别接口类型。

AI 摘要会读取仓库名称、描述和 README 前 500 字，生成：

- 一句简短摘要
- 1 到 3 个标签建议

中文界面下，AI 会优先生成中文摘要和中文标签；`AI`、`React`、`Node.js`、`CLI` 等技术名词可以保留英文。

## 日常使用

### 搜索

弹窗支持搜索：

- 仓库名
- 仓库描述
- 编程语言
- Topics
- 标签
- 备注
- AI 摘要

Linux 下如果无法在 Popup 中正常唤起中文输入法，请点击弹窗顶部的 **在标签页打开** 按钮，在普通浏览器标签页中使用搜索。

### 标签

标签用于快速分类 Star 仓库。

- 首页筛选栏只显示当前有仓库的标签。
- 计数为 0 的标签仍保留在标签管理页，方便后续复用或删除。
- 中文界面会对部分历史英文默认标签显示中文名称，例如 `Frontend` 显示为 `前端`。
- 输入中文标签时，如果它对应已有英文历史标签，扩展会复用原标签，避免出现重复标签。

### 备注和 AI 摘要

每个仓库都可以保存个人备注和 AI 摘要。

首页列表中的预览规则：

- 没有备注时，显示 AI 摘要。
- 有短备注时，同时显示备注和 AI 摘要。
- 备注较长时，优先显示个人备注，避免列表被撑高。

编辑弹窗中，备注和 AI 摘要始终分区显示，不会互相覆盖。

### GitHub 仓库页面面板

扩展会注入到 GitHub 仓库页面。你可以在仓库页面直接：

- 查看已有备注和标签
- 编辑备注
- 增删标签
- 生成 AI 摘要

GitHub 页面是动态应用，切换仓库或页面后如果面板状态异常，刷新当前 GitHub 页面即可。

### 浏览历史

浏览历史用于记录访问过的 GitHub 仓库页面。

- 仅记录 `github.com` 下的仓库页面。
- 不记录普通网页。
- 会去重并限制数量，避免长期无限增长。
- 可以在设置页关闭，也可以清空历史。

### 导出

设置页支持导出：

- `github-stars.md`
- `github-stars-data.json`

导出数据不只包含有备注的仓库，也包含缓存到的 Star 列表。备注、标签、AI 摘要、Star 基础信息和历史数据会尽量完整保留。

## Linux 中文输入法说明

在 Linux 桌面环境中，Chrome 扩展 Popup 可能无法正确唤起 Fcitx、Fcitx5 或 IBus。这是 Chrome Popup 临时窗口和输入法焦点之间的兼容性问题，不是普通输入框事件可以完全修复的问题。

推荐方案：

1. 点击弹窗顶部的 **在标签页打开** 按钮。
2. 扩展会用普通浏览器标签页打开 `popup/popup.html`。
3. 在普通标签页中使用搜索、标签和备注输入。

普通标签页拥有正常网页焦点，中文输入法通常可以正常工作。

如果你希望继续在 Popup 中输入中文，也可以尝试：

- 在 `chrome://flags/#ozone-platform-hint` 中将 Ozone 平台改为 Wayland 或 Auto。
- 检查 Fcitx5 / IBus 环境变量是否正确。
- 使用浏览器内置输入法扩展作为临时方案。

## 数据和隐私

- 扩展数据优先保存在 Chrome 扩展本地存储中。
- 云同步只写入你配置的 GitHub 仓库。
- 浏览历史只记录 GitHub 仓库页面。
- AI 摘要只在你主动触发时调用配置的 AI 服务。
- 发送给 AI 的内容包括仓库名称、描述、README 截断内容和候选标签。
- GitHub Token 和 AI Key 不会写入同步仓库的 Markdown 摘要，但会保存在本地扩展设置中。

## 常见问题排查

### 插件弹窗没有数据

1. 确认 GitHub Token 已填写并保存。
2. 在设置页点击 Token 验证按钮。
3. 确认网络可以访问 `github.com` 和 `api.github.com`。
4. 如果刚更新过代码，在 `chrome://extensions/` 重新加载扩展。

### 私有 Star 或私有仓库读不到

1. 检查 Token 是否包含 `repo` scope。
2. 如果使用 fine-grained token，确认 token 覆盖了目标仓库和必要权限。
3. 保存 Token 后重新打开弹窗或在标签页中打开扩展页面。

### 云同步失败

1. 确认同步仓库名正确。
2. 确认 Token 有创建和写入仓库的权限。
3. 如果仓库已经存在，确认当前 Token 对该仓库有写权限。
4. 检查 GitHub API 是否被代理、防火墙或限流影响。
5. 如果使用 API 代理，确认代理没有对 API 路径启用 Cloudflare Challenge。

### AI 摘要失败

1. 确认 API Key 正确。
2. 确认 API 地址和接口类型匹配。
3. 确认模型名称可用，必要时点击验证按钮加载模型列表。
4. 自定义服务需要兼容所选接口类型。
5. 如果提示模型不可用，检查当前账号、代理或中转服务是否支持该模型。

### 中文输入法无法在弹窗中使用

这是 Linux 下 Chrome extension popup 的常见兼容问题。点击弹窗顶部的 **在标签页打开**，在普通标签页中使用扩展页面。

### 切换语言或主题后没变化

1. 在设置页保存配置。
2. 关闭并重新打开插件弹窗。
3. GitHub 仓库页面中的注入面板如果没有更新，刷新当前 GitHub 页面。
4. 如果刚更新扩展代码，在 `chrome://extensions/` 重新加载扩展。

## 技术栈

- Manifest V3
- 原生 HTML / CSS / JavaScript
- Chrome Storage API
- Chrome Tabs / Alarms API
- GitHub REST API
- Gemini API
- OpenAI Responses API / Chat Completions

本项目没有构建系统，Chrome 会直接加载仓库中的扩展文件。

## 开发说明

本地修改后按下面流程验证：

1. 打开 `chrome://extensions/`。
2. 点击扩展卡片上的 **重新加载**。
3. 打开插件弹窗，检查 Star 列表、搜索、标签、设置页是否正常。
4. 打开任意 GitHub 仓库页面，检查注入的备注/标签面板是否正常。
5. 如果修改了 AI、同步或导出逻辑，分别验证对应按钮和错误提示。

仓库当前没有构建、lint 或测试脚本。语法检查可以使用：

```bash
node --check popup/popup.js
node --check options/options.js
node --check background/service-worker.js
```

JSON 文件可以用下面命令检查：

```bash
node -e "const fs=require('fs'); for (const f of ['manifest.json','_locales/en/messages.json','_locales/zh_CN/messages.json']) JSON.parse(fs.readFileSync(f,'utf8'));"
```

## License

本项目使用 MIT License。
