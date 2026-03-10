// ===== GitHub Stars Manager — Service Worker (Background) =====

import { addHistoryEntry, getSettings, getStarData, saveStarData } from '../lib/storage.js';
import { generateSummary } from '../lib/ai-summary.js';
import { getRepoReadme } from '../lib/github-api.js';
import { syncToGitHub } from '../lib/sync.js';

// ===== Track GitHub Browsing History =====
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    if (!tab.url) return;

    const settings = await getSettings();
    if (!settings.recordHistory || !settings.githubToken) return;

    try {
        const url = new URL(tab.url);
        if (url.hostname !== 'github.com') return;

        const parts = url.pathname.split('/').filter(Boolean);
        // Only record repo pages (owner/repo pattern, not settings, orgs, etc.)
        if (parts.length < 2) return;

        // Exclude non-repo paths
        const excludePrefixes = ['settings', 'organizations', 'orgs', 'explore', 'topics', 'trending', 'notifications', 'new', 'login', 'signup', 'search', 'marketplace', 'features', 'pricing', 'enterprise', 'sponsors', 'collections'];
        if (excludePrefixes.includes(parts[0])) return;

        const repo = `${parts[0]}/${parts[1]}`;
        const title = tab.title || '';

        // Extract description from title (GitHub format: "user/repo: description")
        const descMatch = title.match(/^.+?:\s*(.+?)(?:\s*·\s*GitHub)?$/);
        const description = descMatch ? descMatch[1] : '';

        await addHistoryEntry({
            repo,
            visitedAt: new Date().toISOString(),
            title,
            description,
        });
    } catch {
        // Silently ignore errors
    }
});

// ===== Periodic Sync =====
chrome.alarms.create('auto-sync', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== 'auto-sync') return;

    const settings = await getSettings();
    if (!settings.syncEnabled || !settings.githubToken) return;

    try {
        await syncToGitHub();
        console.log('[GSM] Auto sync completed');
    } catch (err) {
        console.error('[GSM] Auto sync failed:', err);
    }
});

// ===== Install / Update =====
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('[GSM] Extension installed');
    } else if (details.reason === 'update') {
        console.log('[GSM] Extension updated to', chrome.runtime.getManifest().version);
    }
});

// ===== Message Handler (for content scripts) =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_STAR_DATA') {
        getStarData(message.fullName).then(data => sendResponse(data));
        return true; // async response
    }

    if (message.type === 'SAVE_STAR_DATA') {
        saveStarData(message.fullName, message.data).then(() => sendResponse({ ok: true }));
        return true;
    }

    if (message.type === 'GENERATE_SUMMARY') {
        // Wrap in a promise with timeout to ensure sendResponse is always called
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(chrome.i18n.getMessage('bgAITimeout'))), 30000)
        );

        const workPromise = (async () => {
            // Use provided readme if available (from DOM), otherwise fetch it
            const readme = message.readmeContent || await getRepoReadme(message.owner, message.repo);
            const result = await generateSummary(message.repoInfo, readme, message.availableTags || []);
            return result; // returns { summary, tags }
        })();

        Promise.race([workPromise, timeoutPromise])
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ error: err.message || chrome.i18n.getMessage('contentAIGenerateFailGeneric') }));

        return true;
    }
});
