# GitHub Stars Manager

[中文](README.md) | [English](README_en.md)

[![Package Extension](https://github.com/C-Joey/git-start-sum/actions/workflows/package.yml/badge.svg)](https://github.com/C-Joey/git-start-sum/actions/workflows/package.yml)
[![GitHub Release](https://img.shields.io/github/v/release/C-Joey/git-start-sum?label=release)](https://github.com/C-Joey/git-start-sum/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

`GitHub Stars Manager` 是一个原生 Manifest V3 Chrome 扩展，用于把 GitHub Stars 管理成可搜索、可分类、可备注、可同步的个人项目知识库。

它适合长期收藏大量开源项目、需要回看技术选型、希望给仓库补充标签/备注/AI 摘要，并希望把整理结果保存到自己 GitHub 仓库中的开发者。

## 链接

| 资源 | 地址 |
| --- | --- |
| GitHub | https://github.com/C-Joey/git-start-sum |
| Releases | https://github.com/C-Joey/git-start-sum/releases |
| 最新安装包 | https://github.com/C-Joey/git-start-sum/releases/latest |
| GitHub Actions | https://github.com/C-Joey/git-start-sum/actions/workflows/package.yml |

## 项目定位

GitHub Stars Manager 不是公开书签站，也不是把数据上传到第三方服务的 SaaS。它运行在你的浏览器中，使用你配置的 GitHub Token 读取 Stars，并可选地把标签、备注、AI 摘要、Star 缓存和浏览历史同步到你自己的 GitHub 仓库。

本仓库不包含托管后端、真实用户数据、GitHub Token、AI Key 或可直接使用的私密配置。所有敏感配置默认保存在 Chrome 扩展本地存储中。

## 核心能力

| 领域 | 能力 |
| --- | --- |
| Star 管理 | 读取 GitHub Star 仓库，支持搜索、标签筛选、快速打开仓库和缓存基础信息。 |
| 标签与备注 | 为仓库保存自定义标签和个人备注，搜索会同时匹配仓库信息、Topics、标签、备注和 AI 摘要。 |
| AI 摘要 | 支持 Google Gemini API、OpenAI Responses API、OpenAI Chat Completions 和自定义 OpenAI 兼容接口。 |
| GitHub 页面面板 | 在 GitHub 仓库页面注入备注/标签面板，直接查看、编辑和生成 AI 摘要。 |
| 浏览历史 | 可选记录访问过的 GitHub 仓库页面，用于找回最近看过但未整理的项目。 |
| 云同步 | 将结构化数据写入你配置的 GitHub 仓库，推荐使用私有仓库。 |
| 数据导出 | 支持导出 Markdown 和 JSON，包含缓存到的 Star 列表，不只包含有备注的仓库。 |
| 主题与语言 | 支持系统/浅色/深色主题，界面支持简体中文和 English。 |
| Linux 输入法兼容 | 提供在普通标签页打开 Popup 的入口，绕过 Linux 下 Chrome Popup 输入法焦点问题。 |

## 系统架构

```text
Chrome extension  ->  GitHub REST API
                  ->  Gemini / OpenAI / OpenAI-compatible API
                  ->  Your sync repository on GitHub
```

- 扩展直接运行在 Chrome 中，没有后端服务和数据库。
- GitHub Token 只用于访问 GitHub API。
- AI Key 只在你主动生成摘要时用于调用对应 AI 服务。
- 同步仓库由你自己配置和控制，建议使用私有仓库。
- 如果使用 GitHub API 代理，代理路径必须返回 GitHub API JSON，不能返回 Cloudflare Challenge 这类 HTML 页面。

## 界面预览

<table>
  <tr>
    <td width="50%" align="center">
      <img src="docs/assets/popup.png" alt="插件弹窗" width="320">
    </td>
    <td width="50%" align="center">
      <img src="docs/assets/repo-modal.png" alt="仓库编辑弹窗" width="320">
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/assets/options-sync.png" alt="GitHub 与同步设置" width="360">
    </td>
    <td width="50%" align="center">
      <img src="docs/assets/options-ai.png" alt="AI 设置" width="360">
    </td>
  </tr>
</table>

## 环境要求

| 组件 | 要求 |
| --- | --- |
| 浏览器 | Chrome / Chromium / Edge，支持 Manifest V3 |
| GitHub 账号 | 用于读取 Stars 和可选云同步 |
| GitHub Token | 必需，用于访问 GitHub API |
| AI Key | 可选，仅在使用 AI 摘要时需要 |
| 构建系统 | 不需要，Chrome 直接加载扩展文件 |

## 快速开始

### 1. 下载扩展

推荐从 [GitHub Releases](https://github.com/C-Joey/git-start-sum/releases/latest) 下载最新安装包：

```text
github-stars-manager-vX.Y.Z.zip
```

解压后会得到可加载的扩展目录。

也可以从源码加载：

```bash
git clone https://github.com/C-Joey/git-start-sum.git
```

### 2. 加载到 Chrome

1. 打开 `chrome://extensions/`。
2. 开启右上角的 **开发者模式**。
3. 点击 **加载已解压的扩展程序**。
4. 选择解压目录，或选择本仓库根目录。
5. 点击扩展图标，进入设置页填写 GitHub Token。

更新代码或替换安装包后，需要回到 `chrome://extensions/`，点击该扩展卡片上的 **重新加载**。

## GitHub Token 权限

GitHub Token 不是授权给本项目源码仓库 `C-Joey/git-start-sum`，而是让扩展读取你的 GitHub Stars，并写入你自己配置的同步数据仓库。

| Token 类型 | 适用场景 | 权限说明 |
| --- | --- | --- |
| Classic token | 最省事，兼容读取 Stars、创建同步仓库和写入数据 | 勾选 `repo` scope。注意：`repo` 权限范围较大，会覆盖你账号可访问的私有仓库。 |
| Fine-grained token | 更安全，适合只让扩展写入一个固定的数据仓库 | 先手动创建同步仓库，例如 `my-github-stars`，Repository access 只选择这个仓库，并授予 `Contents: Read and write`。 |

快速使用可以选择 classic token 的 `repo` scope；如果更在意最小权限，推荐使用 fine-grained token 并只授权同步数据仓库。当前版本不需要 `gist` 权限。

Token 只保存在 Chrome 扩展本地存储中，用于访问 GitHub API。不要把 Token 提交到任何仓库，也不要把同步数据仓库设为公开，除非你明确希望公开这些数据。

## 同步仓库

开启云同步后，扩展会在你配置的 GitHub 仓库中写入数据文件。推荐使用私有仓库。

默认同步仓库名：

```text
my-github-stars
```

同步文件：

| 文件 | 说明 |
| --- | --- |
| `data.json` | 完整结构化数据，包括标签、备注、AI 摘要、Star 缓存、设置和历史数据。 |
| `README.md` | 面向人工阅读的 Star 摘要。 |
| `HISTORY.md` | 浏览历史摘要，取决于是否启用历史记录。 |

设置页的同步区域提供 **打开** 按钮，可以直接跳转到当前用户的同步仓库：

```text
https://github.com/<your-login>/<sync-repo-name>
```

如果本地尚未记录 GitHub 用户名，扩展会使用当前 Token 查询 `/user` 后再打开仓库。

## AI 摘要配置

AI 功能是可选功能。不配置 AI 时，Star 列表、标签、备注、搜索、历史、同步和导出仍然可以正常使用。

| 服务商 | 支持情况 |
| --- | --- |
| Google Gemini API | 支持 |
| OpenAI Responses API | 支持 |
| OpenAI Chat Completions | 支持 |
| 自定义 OpenAI 兼容接口 | 支持 |

OpenAI 相关配置：

| 配置项 | 说明 |
| --- | --- |
| API 地址 | 默认 `https://api.openai.com`，也可以填写自己的中转地址。 |
| 接口类型 | 支持 `Responses API` 和 `Chat Completions`。 |
| 模型名称 | 可以从模型列表选择，也可以手动输入。 |

如果填写基础地址，例如：

```text
https://api.openai.com
```

扩展会根据选择的接口类型自动使用：

```text
/v1/responses
/v1/chat/completions
```

AI 摘要会读取仓库名称、描述和 README 截断内容，生成一句简短摘要和 1 到 3 个标签建议。中文界面下会优先生成中文摘要和中文标签；`AI`、`React`、`Node.js`、`CLI` 等技术名词可以保留英文。

## GitHub API 代理

设置页支持配置 GitHub API 代理。留空时默认使用：

```text
https://api.github.com
```

如果使用代理，请确保代理路径返回 GitHub API JSON，而不是 HTML 页面。扩展会对 API 做 `HEAD /user` 预检查；如果代理返回 HTML，例如 Cloudflare Challenge 页面，验证会失败并提示关闭 API 路径上的挑战页。

## 日常使用

### 搜索

弹窗搜索会匹配：

- 仓库名
- 仓库描述
- 编程语言
- Topics
- 标签
- 备注
- AI 摘要

Linux 下如果无法在 Popup 中正常唤起中文输入法，请点击弹窗顶部的 **在标签页打开** 按钮，在普通浏览器标签页中使用搜索。

### 标签

- 首页筛选栏只显示当前有仓库的标签。
- 计数为 0 的标签仍保留在标签管理页，方便后续复用或删除。
- 中文界面会对部分历史英文默认标签显示中文名称，例如 `Frontend` 显示为 `前端`。
- 输入中文标签时，如果它对应已有英文历史标签，扩展会复用原标签，避免出现重复标签。

### 备注和 AI 摘要

每个仓库都可以同时保存个人备注和 AI 摘要。

- 没有备注时，列表显示 AI 摘要。
- 有短备注时，列表同时显示备注和 AI 摘要。
- 备注较长时，列表优先显示个人备注，避免内容过高。
- 编辑弹窗中，备注和 AI 摘要始终分区显示，不会互相覆盖。

### GitHub 仓库页面面板

扩展会注入到 GitHub 仓库页面。你可以在仓库页面直接查看备注和标签、编辑备注、增删标签、生成 AI 摘要。

GitHub 页面是动态应用，切换仓库或页面后如果面板状态异常，刷新当前 GitHub 页面即可。

### 导出

设置页支持导出：

```text
github-stars.md
github-stars-data.json
```

导出数据包含缓存到的 Star 列表，不只包含有备注的仓库。备注、标签、AI 摘要、仓库基础信息和历史数据会尽量完整保留。

## Linux 中文输入法说明

在 Linux 桌面环境中，Chrome 扩展 Popup 可能无法正确唤起 Fcitx、Fcitx5 或 IBus。这是 Chrome Popup 临时窗口和输入法焦点之间的兼容性问题，不是普通输入框事件可以完全修复的问题。

推荐方案：

1. 点击弹窗顶部的 **在标签页打开** 按钮。
2. 扩展会用普通浏览器标签页打开 `popup/popup.html`。
3. 在普通标签页中使用搜索、标签和备注输入。

普通标签页拥有正常网页焦点，中文输入法通常可以正常工作。

## 数据和隐私

- 扩展数据优先保存在 Chrome 扩展本地存储中。
- 云同步只写入你配置的 GitHub 仓库。
- 浏览历史只记录 GitHub 仓库页面。
- AI 摘要只在你主动触发时调用配置的 AI 服务。
- 发送给 AI 的内容包括仓库名称、描述、README 截断内容和候选标签。
- GitHub Token 和 AI Key 保存在本地扩展设置中，不会写入同步仓库生成的 Markdown 摘要。
- 本项目仓库不跟踪 `.trellis/`、`.codex/` 或本地任务记录。

## 项目结构

```text
.
├── manifest.json              # MV3 manifest
├── background/                # Service worker
├── popup/                     # 扩展弹窗页面
├── options/                   # 设置页面
├── content/                   # GitHub 页面注入脚本和样式
├── lib/                       # storage、GitHub API、AI、sync 等共享模块
├── styles/                    # 共享 CSS token 和基础样式
├── icons/                     # 扩展图标
├── _locales/                  # 中英文语言包
├── docs/assets/               # README 截图资源
└── .github/workflows/         # GitHub Actions 打包流程
```

## 开发与验证

本项目没有 npm build/lint/test 脚本。Chrome 会直接加载仓库中的扩展文件。

本地修改后按下面流程验证：

1. 打开 `chrome://extensions/`。
2. 点击扩展卡片上的 **重新加载**。
3. 打开插件弹窗，检查 Star 列表、搜索、标签和设置页。
4. 打开任意 GitHub 仓库页面，检查注入的备注/标签面板。
5. 如果修改了 AI、同步或导出逻辑，分别验证对应按钮和错误提示。

语法检查：

```bash
find background content lib options popup -name '*.js' -print0 | xargs -0 -n 1 node --check
```

JSON 检查：

```bash
node -e "const fs=require('fs'); for (const f of ['manifest.json','_locales/en/messages.json','_locales/zh_CN/messages.json']) JSON.parse(fs.readFileSync(f,'utf8'));"
```

## 发布

GitHub Actions 会在 `master` 分支推送、Pull Request 和手动触发时运行：

1. 检查 JavaScript 语法。
2. 校验 manifest 和语言包 JSON。
3. 打包扩展 zip，并上传为 Actions artifact。

正式版本通过 [GitHub Releases](https://github.com/C-Joey/git-start-sum/releases) 发布，安装包命名为：

```text
github-stars-manager-vX.Y.Z.zip
```

## 常见问题排查

### 插件弹窗没有数据

1. 确认 GitHub Token 已填写并保存。
2. 在设置页点击 Token 验证按钮。
3. 确认网络可以访问 `github.com` 和 `api.github.com`。
4. 如果刚更新过代码，在 `chrome://extensions/` 重新加载扩展。

### 私有 Star 或私有仓库读不到

1. 检查 Token 是否包含所需权限。
2. 如果使用 fine-grained token，确认 token 覆盖了目标同步仓库和必要权限。
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

### 语言或主题切换后没有变化

1. 在设置页保存配置。
2. 关闭并重新打开插件弹窗。
3. GitHub 仓库页面中的注入面板如果没有更新，刷新当前 GitHub 页面。
4. 如果刚更新扩展代码，在 `chrome://extensions/` 重新加载扩展。

## License

本项目使用 MIT License。
