// ===== GitHub Stars Manager — Service Worker (Background) =====

import { addHistoryEntry, getSettings, getStarData, saveStarData } from '../lib/storage.js';
import { generateSummary } from '../lib/ai-summary.js';
import { getRepoReadme } from '../lib/github-api.js';
import { syncToGitHub } from '../lib/sync.js';

function createAutoSyncAlarm() {
    const result = chrome.alarms.create('auto-sync', { periodInMinutes: 30 });
    result?.catch?.(err => console.warn('[GSM] Failed to create auto-sync alarm:', err));
}

// ===== Track GitHub Browsing History =====
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    if (!tab.url) return;

    try {
        const settings = await getSettings();
        if (!settings.recordHistory || !settings.githubToken) return;

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
    } catch (err) {
        console.warn('[GSM] Failed to record browsing history:', err);
    }
});

// ===== Periodic Sync =====
createAutoSyncAlarm();

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== 'auto-sync') return;

    try {
        const settings = await getSettings();
        if (!settings.syncEnabled || !settings.githubToken) return;

        await syncToGitHub();
        console.log('[GSM] Auto sync completed');
    } catch (err) {
        console.error('[GSM] Auto sync failed:', err);
    }
});

// ===== Install / Update =====
chrome.runtime.onInstalled.addListener((details) => {
    createAutoSyncAlarm();

    if (details.reason === 'install') {
        console.log('[GSM] Extension installed');
    } else if (details.reason === 'update') {
        console.log('[GSM] Extension updated to', chrome.runtime.getManifest().version);
    }
});

chrome.runtime.onStartup.addListener(() => {
    createAutoSyncAlarm();
});

// ===== Message Handler (for content scripts) =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message?.type) return false;

    if (message.type === 'GET_STAR_DATA') {
        getStarData(message.fullName)
            .then(data => sendResponse(data))
            .catch(err => sendResponse({ error: err.message || chrome.i18n.getMessage('contentComError') }));
        return true; // async response
    }

    if (message.type === 'SAVE_STAR_DATA') {
        saveStarData(message.fullName, message.data)
            .then(() => sendResponse({ ok: true }))
            .catch(err => sendResponse({ error: err.message || chrome.i18n.getMessage('contentComError') }));
        return true;
    }

    if (message.type === 'GENERATE_SUMMARY') {
        let responded = false;
        const respondOnce = (response) => {
            if (responded) return;
            responded = true;
            clearTimeout(timeoutId);
            sendResponse(response);
        };
        const timeoutId = setTimeout(() => {
            respondOnce({ error: chrome.i18n.getMessage('bgAITimeout') });
        }, 30000);

        (async () => {
            try {
                // Use provided readme if available (from DOM), otherwise fetch it
                const readme = message.readmeContent || await getRepoReadme(message.owner, message.repo);
                const result = await generateSummary(message.repoInfo, readme, message.availableTags || []);
                respondOnce(result); // returns { summary, tags }
            } catch (err) {
                respondOnce({ error: err.message || chrome.i18n.getMessage('contentAIGenerateFailGeneric') });
            }
        })();

        return true;
    }

    return false;
});
