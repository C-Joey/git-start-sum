# GitHub Stars Manager

[中文](./README.md) | [English](./README_en.md)

GitHub Stars Manager 是一个原生 Manifest V3 Chrome 插件，用来管理 GitHub Star 仓库。它适合 Star 很多、经常回看项目、需要给仓库打标签或写备注的开发者。

插件支持标签、备注、AI 摘要、浏览历史、主题切换、中英文界面，以及同步到你自己的 GitHub 私有仓库。

![GitHub Stars Manager](icons/icon128.png)

## 界面预览

<table>
  <tr>
    <td width="50%">
      <img src="docs/assets/popup.svg" alt="插件弹窗" width="100%">
    </td>
    <td width="50%">
      <img src="docs/assets/options.svg" alt="设置页" width="100%">
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/assets/github-panel.svg" alt="GitHub 注入面板" width="100%">
    </td>
    <td width="50%">
      <img src="docs/assets/demo.svg" alt="功能演示流程" width="100%">
    </td>
  </tr>
</table>

## 功能演示 GIF

上面的第四张图是功能流程示意图。后续如果录制真实 GIF，可以替换为 `docs/assets/demo.gif`。

真实 GIF 建议覆盖这条主流程：

1. 打开插件弹窗，搜索一个 Star 仓库。
2. 给仓库添加标签和备注。
3. 在 GitHub 仓库页面打开注入面板。
4. 生成 AI 摘要并保存。
5. 切换白天/黑夜主题和中英文语言。

## 主要功能

- **Star 管理**：读取你的 GitHub Star 列表，支持搜索、标签筛选和快速打开仓库。
- **标签和备注**：给仓库添加自定义标签和备注，后续搜索时会一起匹配。
- **AI 摘要**：可选接入 Gemini、OpenAI 或兼容 OpenAI 的自定义接口，自动总结 README 并推荐标签。
- **浏览历史**：自动记录访问过的 GitHub 仓库，方便找回最近看过的项目。历史会去重并限制数量，不会无限膨胀。
- **云同步**：把标签、备注和历史同步到你指定的 GitHub 仓库，默认适合使用私有仓库。
- **主题切换**：支持跟随系统、白天模式、黑夜模式，深色主题接近 GitHub 的暗色观感。
- **语言切换**：支持跟随浏览器、简体中文、English。

## 安装方式

目前这是未上架 Chrome Web Store 的本地扩展，需要手动加载：

1. 下载本项目，或使用 `git clone https://github.com/C-Joey/git-start-sum.git`。
2. 打开 Chrome，进入 `chrome://extensions/`。
3. 开启右上角的 **开发者模式**。
4. 点击 **加载已解压的扩展程序**。
5. 选择本项目根目录。

更新代码后，需要在 `chrome://extensions/` 里点击一次扩展的 **重新加载**。

## 基础配置

首次使用需要在插件设置页填入 GitHub Token。建议使用 classic Personal Access Token。

不同使用场景需要的权限不同：

| 使用场景 | Token 权限 |
| --- | --- |
| 只读取公开 Star 仓库 | 基础 GitHub API 访问即可 |
| 需要读取私有仓库 | 需要 `repo` scope |
| 使用云同步到私有仓库 | 需要 `repo` scope，用于创建和写入同步仓库 |
| Gist | 当前版本不需要 `gist` 权限 |

Token 会保存在 Chrome 扩展本地存储中，只用于 GitHub API 请求。不要把 Token 提交到仓库或分享给别人。

## 同步说明

开启云同步后，插件会在你配置的同步仓库中写入这些文件：

- `data.json`：标签、备注、AI 摘要等主要数据
- `README.md`：同步仓库的人类可读摘要
- `HISTORY.md`：可选的浏览历史导出

同步仓库可以是私有仓库。只要 Token 有对应权限，插件可以正常创建、读取和写入。

## AI 配置

AI 功能是可选的，不配置也可以正常管理 Star。

支持：

- Google Gemini
- OpenAI
- 兼容 OpenAI Chat Completions 格式的自定义接口

填写 API Key 和接口地址后，可以点击设置页里的验证按钮测试连接并加载模型列表。

## 界面设置

设置页里可以调整：

- **主题**：跟随系统 / 白天模式 / 黑夜模式
- **语言**：跟随浏览器 / 简体中文 / English
- **浏览历史**：是否自动记录 GitHub 仓库访问历史
- **同步频率**：是否定时同步到 GitHub 仓库

弹窗顶部也有主题切换按钮，可以快速在三种主题之间切换。

## 数据和隐私

- 插件数据优先保存在 Chrome 本地扩展存储中。
- 云同步只写入你配置的 GitHub 仓库。
- 浏览历史只记录 GitHub 仓库页面，不记录普通网页。
- 历史记录会去重并限制数量，避免长期无限增长。
- AI 摘要只在你主动触发时调用配置的 AI 服务。

## FAQ

### 这个插件需要联网吗？

需要。读取 Star、访问私有仓库、云同步和 AI 摘要都依赖网络。已经缓存过的 Star 数据可以更快显示，但刷新和同步仍然需要连接 GitHub。

### 私有仓库可以用吗？

可以。Token 需要有读取私有仓库的权限。使用 classic Personal Access Token 时，选择 `repo` scope。

### 云同步会把数据公开吗？

不会主动公开。插件会写入你配置的 GitHub 仓库；如果同步仓库是私有仓库，数据就保存在私有仓库里。请确认你没有把同步仓库设成公开。

### 浏览历史会一直变大吗？

不会。插件会对短时间内重复访问的同一仓库做去重，并限制历史记录数量。

### 不配置 AI 能用吗？

能用。标签、备注、搜索、浏览历史和同步都不依赖 AI。AI 只影响 README 摘要和标签推荐。

### 语言在哪里切换？

打开插件设置页，在 **外观** 区域选择 **语言**。支持跟随浏览器、简体中文和 English。

### 主题在哪里切换？

插件弹窗顶部有主题按钮，可以快速切换。设置页的 **外观** 区域也可以固定为跟随系统、白天模式或黑夜模式。

## 常见问题排查

### 插件弹窗没有数据

1. 确认 GitHub Token 已填写并保存。
2. 在设置页点击 Token 验证按钮。
3. 确认网络可以访问 `github.com` 和 `api.github.com`。
4. 如果刚更新过代码，在 `chrome://extensions/` 重新加载扩展。

### 私有 Star 或私有仓库读不到

1. 检查 Token 是否包含 `repo` scope。
2. 如果使用的是 fine-grained token，确认它覆盖了目标仓库和必要权限。
3. 保存 Token 后重新打开插件弹窗刷新数据。

### 云同步失败

1. 确认同步仓库名没有写错。
2. 确认 Token 有创建和写入仓库的权限。
3. 如果仓库已经存在，确认当前 Token 对该仓库有写权限。
4. 检查 GitHub API 是否被网络代理、防火墙或限流影响。

### AI 摘要失败

1. 确认 API Key、接口地址和模型名正确。
2. 点击设置页的验证按钮测试连接。
3. 自定义接口需要兼容 OpenAI Chat Completions 格式。
4. 如果仓库 README 很长，可能会触发模型上下文或服务端限流。

### 切换语言或主题后没变化

1. 在设置页保存配置。
2. 关闭并重新打开插件弹窗。
3. GitHub 仓库页面里的注入面板如果没更新，刷新当前 GitHub 页面。
4. 如果刚更新扩展代码，在 `chrome://extensions/` 重新加载扩展。

## 技术栈

- Manifest V3
- 原生 HTML / CSS / JavaScript
- Chrome Storage API
- GitHub REST API

本项目没有构建系统，Chrome 会直接加载仓库中的扩展文件。

## 开发说明

本地修改后按下面流程验证：

1. 打开 `chrome://extensions/`。
2. 点击扩展卡片上的 **重新加载**。
3. 打开插件弹窗，检查 Star 列表、搜索、标签、设置页是否正常。
4. 打开任意 GitHub 仓库页面，检查注入的备注/标签面板是否正常。

## License

本项目使用 MIT License。
