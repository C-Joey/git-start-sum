// ===== GitHub Stars Manager — Sync Module =====

import { getStarsData, getTags, getHistory, getSettings, setLastSync, replaceAllStarsData, saveTags } from './storage.js';
import { checkSyncRepo, createSyncRepo, getRepoFile, putRepoFile } from './github-api.js';
import { formatCount } from './utils.js';

/**
 * Ensure sync repo exists, create if not
 */
async function ensureSyncRepo() {
    const settings = await getSettings();
    const repoName = settings.syncRepoName || 'my-github-stars';

    const exists = await checkSyncRepo(repoName);
    if (!exists) {
        await createSyncRepo(repoName);
        // Wait a bit for GitHub to initialize the repo
        await new Promise(r => setTimeout(r, 2000));
    }
    return repoName;
}

/**
 * Sync data to GitHub repo
 */
export async function syncToGitHub() {
    const settings = await getSettings();
    if (!settings.githubToken || !settings.syncEnabled) return;

    const repoName = await ensureSyncRepo();

    // Get current data
    const [starsData, tags, history] = await Promise.all([
        getStarsData(),
        getTags(),
        getHistory(),
    ]);

    // Prepare JSON data
    const jsonData = JSON.stringify({ starsData, tags, history, syncedAt: new Date().toISOString() }, null, 2);

    // Prepare Markdown
    const markdown = generateMarkdown(starsData, tags);

    // Upload data.json
    const existingJson = await getRepoFile(repoName, 'data.json');
    await putRepoFile(
        repoName,
        'data.json',
        jsonData,
        chrome.i18n.getMessage('syncCommitData', [new Date().toLocaleString()]),
        existingJson?.sha
    );

    // Upload README.md
    const existingReadme = await getRepoFile(repoName, 'README.md');
    await putRepoFile(
        repoName,
        'README.md',
        markdown,
        chrome.i18n.getMessage('syncCommitReadme', [new Date().toLocaleString()]),
        existingReadme?.sha
    );

    // Upload browsing history (separate file, private)
    if (history.length > 0) {
        const historyMd = generateHistoryMarkdown(history);
        const existingHistory = await getRepoFile(repoName, 'HISTORY.md');
        await putRepoFile(
            repoName,
            'HISTORY.md',
            historyMd,
            chrome.i18n.getMessage('syncCommitHistory', [new Date().toLocaleString()]),
            existingHistory?.sha
        );
    }

    await setLastSync(new Date().toISOString());
}

/**
 * Sync from GitHub repo (pull)
 */
export async function syncFromGitHub() {
    const settings = await getSettings();
    if (!settings.githubToken) return;

    const repoName = settings.syncRepoName || 'my-github-stars';
    const file = await getRepoFile(repoName, 'data.json');
    if (!file) return null;

    try {
        const data = JSON.parse(file.content);
        if (data.starsData) await replaceAllStarsData(data.starsData);
        if (data.tags) await saveTags(data.tags);
        return data;
    } catch {
        return null;
    }
}

/**
 * Generate Markdown for README.md
 */
function generateMarkdown(starsData, tags) {
    const entries = Object.entries(starsData);
    let md = chrome.i18n.getMessage('syncReadmeTitle', [String(entries.length)]);

    // Group by FIRST tag only (each repo appears once)
    const tagged = {};
    const untagged = [];

    for (const [fullName, data] of entries) {
        if (data.tags && data.tags.length > 0) {
            const primaryTag = data.tags[0];
            if (!tagged[primaryTag]) tagged[primaryTag] = [];
            tagged[primaryTag].push({ fullName, ...data });
        } else {
            untagged.push({ fullName, ...data });
        }
    }

    // Render tagged groups (in the order defined by tags array)
    for (const tag of tags) {
        const items = tagged[tag];
        if (!items || items.length === 0) continue;

        md += `## 🏷️ ${tag}\n\n`;
        for (const item of items) {
            md += formatStarEntry(item);
        }
        md += '\n';
    }

    // Render any tagged groups not in the tags array (e.g. AI-generated new tags)
    for (const [tag, items] of Object.entries(tagged)) {
        if (tags.includes(tag)) continue;
        md += `## 🏷️ ${tag}\n\n`;
        for (const item of items) {
            md += formatStarEntry(item);
        }
        md += '\n';
    }

    // Render untagged
    if (untagged.length > 0) {
        md += chrome.i18n.getMessage('syncReadmeUntagged');
        for (const item of untagged) {
            md += formatStarEntry(item);
        }
    }

    md += chrome.i18n.getMessage('syncReadmeLastUpdate', [new Date().toLocaleString()]);
    return md;
}

function formatStarEntry(item) {
    let line = `- [**${item.fullName}**](https://github.com/${item.fullName})`;
    if (item.repoInfo?.language) line += ` \`${item.repoInfo.language}\``;
    if (item.repoInfo?.stars) line += ` ⭐${formatCount(item.repoInfo.stars)}`;
    // Show all tags inline
    if (item.tags && item.tags.length > 0) {
        line += ` ${item.tags.map(t => `\`${t}\``).join(' ')}`;
    }
    line += '\n';

    if (item.repoInfo?.description) {
        line += `  > ${item.repoInfo.description}\n`;
    }
    if (item.note) {
        line += `  > ${chrome.i18n.getMessage('syncReadmeNote')}: ${item.note}\n`;
    }
    if (item.aiSummary) {
        line += `  > ${chrome.i18n.getMessage('syncReadmeAISummary')}: ${item.aiSummary}\n`;
    }
    line += '\n';
    return line;
}

/**
 * Generate Markdown for browsing history
 */
function generateHistoryMarkdown(history) {
    let md = chrome.i18n.getMessage('syncHistoryTitle', [String(history.length)]);

    // Group by date
    const byDate = {};
    for (const entry of history) {
        const date = new Date(entry.visitedAt).toLocaleDateString();
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(entry);
    }

    for (const [date, entries] of Object.entries(byDate)) {
        md += `## ${date}\n\n`;
        for (const entry of entries) {
            const time = new Date(entry.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            md += `- **${time}** — [${entry.repo}](https://github.com/${entry.repo})`;
            if (entry.description) md += ` — ${entry.description}`;
            md += '\n';
        }
        md += '\n';
    }

    return md;
}

/**
 * Generate shareable Markdown for selected stars
 */
export function generateShareMarkdown(selectedStars, starsData, title = '我的推荐项目') {
    let md = chrome.i18n.getMessage('syncShareTitle', [title, String(selectedStars.length)]);

    for (const fullName of selectedStars) {
        const data = starsData[fullName] || {};
        md += formatStarEntry({ fullName, ...data });
    }

    md += chrome.i18n.getMessage('syncShareFooter');
    return md;
}

/**
 * Export all data to downloadable Markdown
 */
export async function exportToMarkdown() {
    const [starsData, tags] = await Promise.all([getStarsData(), getTags()]);
    return generateMarkdown(starsData, tags);
}
