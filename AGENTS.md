# AGENTS.md — GitHub Stars Manager

This repository is a **vanilla Manifest V3 Chrome extension**.
There is **no build system, package manager, lint runner, or test runner** in the repo root.
Agents should make direct file edits, preserve existing structure, and verify behavior manually in Chrome.

If the repo later gains scripts, tooling, or rule files, update this document.

---

## 1. Repository Overview

- Chrome extension for managing GitHub Stars.
- Features include tags, notes, AI summaries, browsing history, and sync to a private GitHub repo.
- Runtime is plain HTML/CSS/JavaScript loaded directly by Chrome.

### Important files and directories

- `manifest.json` — MV3 manifest and entry points.
- `background/service-worker.js` — background worker, loaded as an ES module.
- `popup/` — popup UI (`popup.html`, `popup.css`, `popup.js`).
- `options/` — settings page (`options.html`, `options.css`, `options.js`).
- `content/` — GitHub page injection (`content.js`, `content.css`).
- `lib/` — storage, GitHub API, sync, AI, and utilities.
- `styles/common.css` — shared design tokens and utility classes.
- `_locales/en/messages.json`, `_locales/zh_CN/messages.json` — localization catalogs.

### Architecture notes

- `manifest_version: 3`
- background worker uses `"type": "module"`
- popup/options each load a single module script
- content script must survive GitHub Turbo/PJAX navigation
- sync writes `data.json`, `README.md`, and optionally `HISTORY.md` to a private repo

---

## 2. Build / Lint / Test Commands

There are **no automated repo commands** for build, lint, or tests.

- **Build:** none
- **Lint:** none
- **Test:** none
- **Single test:** not applicable

Reason: Chrome serves the extension files directly from the repository folder, and there is no Jest/Vitest/Playwright/Mocha/ESLint/Prettier config in the repo root.

### Manual verification flow

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the repository root
5. Reload the extension after edits

### Manual verification checklist

1. **Popup**: opens, renders stars, search works, tag filters work, modal save still works.
2. **Options**: page loads, settings save, validation buttons respond, export still works if touched.
3. **Content script**: note button/widget injects, panel opens, note/tag save works, UI survives GitHub navigation.
4. **Background flows**: history records when enabled, sync works if touched, AI summary still works if touched.

---

## 3. Code Style and Conventions

### Modules and imports

- Use **ES modules** only.
- Keep imports at the top of the file.
- Use **relative imports with explicit `.js` extensions**.
- Prefer **named exports** from shared modules.
- Do not introduce bundler-only import patterns.

Examples: `import { getSettings } from './storage.js';`, `import { syncToGitHub } from '../lib/sync.js';`

### Formatting and naming

- Use **4-space indentation** in JavaScript and JSON.
- CSS also largely uses 4-space indentation in page/content files.
- Use **single quotes** and keep **semicolons**.
- Use template literals when interpolation improves readability.
- Preserve the section-header style: `// ===== Section Name =====`
- `camelCase` for variables/functions.
- `SCREAMING_SNAKE_CASE` for constants.
- `PascalCase` only for true class-like constructs.
- Storage keys use a `gsm_` prefix.
- Content-script CSS classes use a `gsm-` prefix.
- Keep related helpers near the logic they support.
- Prefer minimal diffs over broad refactors.

Examples already in repo: `STORAGE_KEYS`, `DEFAULT_SETTINGS`, `getAllStarredRepos`, `currentAIController`, `.gsm-note-btn`, `.gsm-panel`.

---

## 4. Async, Storage, and Messaging

- Prefer `async` / `await`.
- Use `Promise.all(...)` for independent reads.
- Wrap callback-based Chrome APIs in Promises when convenient.
- Primary storage is `chrome.storage.local`.
- Reuse helpers in `lib/storage.js` instead of duplicating raw storage access.
- When adding persisted settings/data, update `STORAGE_KEYS` and `DEFAULT_SETTINGS` if needed.
- Background/content communication uses `chrome.runtime.sendMessage`.
- If a listener responds asynchronously, **return `true`**.
- In callback-style messaging, check `chrome.runtime.lastError`.
- Preserve existing timeout/abort behavior in AI and network flows.

---

## 5. Error Handling and i18n

### Error handling

- Prefer explicit, user-facing errors via `chrome.i18n.getMessage(...)`.
- Wrap expected network/storage failures in `try/catch`.
- Avoid empty catches.
- If intentionally ignoring an error, leave a clear comment such as `// ignore`.
- Background/service-worker logs use the `[GSM]` prefix.

### i18n

- Treat **all user-facing strings** as localized strings.
- Use `chrome.i18n.getMessage(...)` in JS.
- Use `data-i18n`, `data-i18n-title`, and `data-i18n-placeholder` in HTML.
- When adding a visible string, update both locale files:
  - `_locales/en/messages.json`
  - `_locales/zh_CN/messages.json`
- Keep message keys aligned with existing families like `popup...`, `options...`, `content...`, `msg...`, `aiSummary...`, and `githubApi...`.

Do not hardcode new UI strings unless they are truly non-user-facing.

---

## 6. CSS and UI Conventions

- Reuse tokens from `styles/common.css`.
- Prefer variables like `var(--space-md)` and `var(--text-secondary)`.
- Respect the existing `@media (prefers-color-scheme: dark)` split.
- Flexbox is the default layout mechanism.
- Shared classes are semantic: `.btn`, `.card`, `.tag`, `.header`, `.input`, etc.
- Utility classes like `.hidden`, `.flex`, `.gap-sm`, and `.text-secondary` already exist; reuse them.
- Keep the `gsm-` prefix on injected classes.
- Content CSS uses `!important` heavily to override GitHub styles; preserve that pattern.
- Keep content selectors narrow to avoid GitHub regressions.
- Be careful with overlays, z-index, and fixed positioning.

---

## 7. Repo-Specific Gotchas

- There is **no TypeScript** here.
- There is **no npm script layer**; do not tell agents to run `npm test`, `npm run build`, etc.
- GitHub pages are dynamic; content-script behavior must handle navigation after initial load.
- Sync behavior depends on real GitHub API state and may create/update files in a private repo.
- AI flows depend on external providers and may fail due to keys, endpoints, rate limits, or timeouts.
- `getRepoReadme()` and repo-file helpers decode Base64/UTF-8; be cautious when changing those paths.

---

## 8. Editing Guidance

- Prefer **small, surgical edits**.
- Follow existing naming and section-header patterns.
- Keep imports relative and explicit.
- Preserve localization coverage.
- Verify manually in Chrome for any user-visible change.
- If you add tooling later, update this file so future agents do not assume the repo is still buildless.

---

## 9. Cursor / Copilot Rules

I found **no additional rule files** beyond this `AGENTS.md`.

- `.cursor/rules/` — not present
- `.cursorrules` — not present
- `.github/copilot-instructions.md` — not present

If these are added later, merge their guidance into this document.
