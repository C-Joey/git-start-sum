# GitHub Stars Manager

[中文](./README.md) | [English](./README_en.md)

GitHub Stars Manager is a native Manifest V3 Chrome extension for organizing GitHub starred repositories. It helps developers search stars, add tags and notes, generate optional AI summaries, keep browsing history, switch themes/languages, and sync data to a GitHub repository.

![GitHub Stars Manager](icons/icon128.png)

## Screenshots and Demo

![Popup](docs/assets/popup.svg)

![Options](docs/assets/options.svg)

![GitHub panel](docs/assets/github-panel.svg)

The demo flow below can be replaced with `docs/assets/demo.gif` after a real GIF is recorded.

![Demo flow](docs/assets/demo.svg)

## Features

- Star search, tag filters, and quick repository access
- Custom tags and notes, included in search matching
- Optional AI summaries with Gemini, OpenAI, or OpenAI-compatible endpoints
- GitHub repository browsing history with deduplication and size limits
- Cloud sync to a GitHub repository, including private repositories
- Light, dark, and system theme modes
- Chinese and English UI

## Installation

1. Download this project or clone it with `git clone https://github.com/C-Joey/git-start-sum.git`.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the project root directory.

After updating files, reload the extension from `chrome://extensions/`.

## Permissions

Create a GitHub Personal Access Token and paste it into the extension settings.

| Scenario | Required permission |
| --- | --- |
| Public starred repositories only | Basic authenticated GitHub API access |
| Private repositories | `repo` scope |
| Cloud sync to a private repository | `repo` scope, for creating and writing the sync repository |
| Gist | Not required |

The token is stored in Chrome extension local storage and is only used for GitHub API requests.

## Sync

When cloud sync is enabled, the extension writes these files to your configured sync repository:

- `data.json`
- `README.md`
- optional `HISTORY.md`

Private sync repositories are supported when the token has the required permissions.

## FAQ

### Can I use it without AI?

Yes. Tags, notes, search, history, and sync work without AI. AI is only used for README summaries and tag recommendations.

### Does it support private repositories?

Yes, if your token has permission to read private repositories. Classic Personal Access Tokens need the `repo` scope.

### Will browsing history grow forever?

No. Recent duplicate visits are deduplicated, and history is capped.

### Where do I change language and theme?

Open the options page. The Appearance section contains both language and theme settings. The popup also has a quick theme toggle button.

## Troubleshooting

- Empty popup: verify the GitHub token, check access to `github.com` and `api.github.com`, then reload the extension.
- Private repos missing: confirm the token has `repo` scope or equivalent fine-grained permissions.
- Sync failed: check the sync repository name and token write permissions.
- AI failed: verify the API key, endpoint, and model; custom endpoints must be OpenAI Chat Completions compatible.
- Theme or language unchanged: save settings, reopen the popup, and reload GitHub pages that already had the injected panel.

## Tech Stack

- Manifest V3
- Plain HTML, CSS, and JavaScript
- Chrome Storage API
- GitHub REST API

There is no build system. Chrome loads the extension files directly from the repository.
