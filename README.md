# ⭐ GitHub Stars Manager (GSM)

[English](./README.md) | [简体中文](./README_zh.md)

A Chrome extension designed for developers to efficiently manage, categorize, and search GitHub Starred repositories. Features integrated AI smart summarization and automated tag recommendations.

![GitHub Stars Manager](icons/icon128.png)

### ✨ Core Features

- **🚀 Zero-latency Loading**: Deeply optimized caching mechanism allows your popup list to load instantly, even with thousands of Stars.
- **🤖 AI-Powered**: One-click generation of project README summaries, with AI automatically recommending and applying 1-3 highly relevant tags.
- **🏷️ Tag Management System**: Supports custom tags, color coding, and an extremely smooth autocomplete search experience.
- **📝 Dynamic Notes**: Quickly jot down insights or use cases for important projects, fully searchable later.
- **📅 Browsing History**: Automatically curates your recently visited GitHub repositories and supports multi-device sync.
- **☁️ Cloud Sync**: Automatically backs up all notes, tags, and history to a private repository of your choice. Never lose your data.
- **🌓 Minimalist Experience**: Native Chrome-style UI that perfectly adapts to your browser's light and dark themes.

### 📦 Installation Guide

1. Download this project or use `git clone` to your local machine.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **"Developer mode"** in the top right corner.
4. Click **"Load unpacked"**.
5. Select the folder containing this project.

### ⚙️ Configuration

1. **GitHub Token**: For the first use, you need to create a Personal Access Token (requires `repo` and `gist` permissions).
2. **AI Configuration (Optional)**:
   - Supports Google Gemini API (Recommended).
   - Supports OpenAI or other custom API endpoints compatible with the OpenAI format.
   - After filling in the URL and Key, click "Verify" to automatically fetch the list of available AI models.

### 🛠️ Tech Stack

- **Manifest V3**: The latest Chrome extension standard.
- **Vanilla CSS**: High-performance, responsive UI built with pure native CSS.
- **Chrome Storage API**: Efficient local caching.
- **GitHub REST API**: Used for fetching lists and private repo synchronization.

---

*Developed with the assistance of Antigravity | 由 Antigravity 协助开发*
