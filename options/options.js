// ===== GitHub Stars Manager — Options Page =====

import { getSettings, saveSettings, clearHistory, exportAllData } from '../lib/storage.js';
import { getCurrentUser } from '../lib/github-api.js';
import { exportToMarkdown } from '../lib/sync.js';

const $ = (sel) => document.querySelector(sel);

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
    localizeHtmlPage();
    const settings = await getSettings();
    originalRepoName = settings.syncRepoName || '';
    loadSettingsToForm(settings);
    bindEvents();
});

// ===== Localization =====
function localizeHtmlPage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = chrome.i18n.getMessage(el.getAttribute('data-i18n-title'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = chrome.i18n.getMessage(el.getAttribute('data-i18n-placeholder'));
    });
}

function loadSettingsToForm(settings) {
    $('#github-token').value = settings.githubToken || '';
    $('#github-api-base').value = settings.githubApiBase || '';
    $('#sync-repo').value = settings.syncRepoName || 'my-github-stars';
    $('#sync-enabled').checked = settings.syncEnabled !== false;
    $('#sync-interval').value = settings.syncInterval || 30;
    $('#ai-provider').value = settings.aiProvider || 'gemini';
    $('#ai-key').value = settings.aiApiKey || '';
    $('#ai-endpoint').value = settings.aiCustomEndpoint || '';
    $('#ai-model').value = settings.aiCustomModel || '';
    $('#record-history').checked = settings.recordHistory !== false;

    updateAIFields(settings.aiProvider);

    // Lock sync repo name if already set
    const repoInput = $('#sync-repo');
    const editBtn = $('#btn-edit-repo');
    const hint = $('#sync-repo-hint');
    if (settings.syncRepoName) {
        repoInput.readOnly = true;
        repoInput.style.opacity = '0.7';
        editBtn.textContent = '✏️ ' + chrome.i18n.getMessage('optionsBtnEdit');
        hint.textContent = '🔒 ' + chrome.i18n.getMessage('optionsRepoLocked');
    } else {
        repoInput.readOnly = false;
        repoInput.style.opacity = '1';
        editBtn.style.display = 'none';
        hint.textContent = chrome.i18n.getMessage('optionsSyncRepoHint');
    }
}

// Store original repo name for change detection
let originalRepoName = '';

function bindEvents() {
    // AI provider change
    $('#ai-provider').addEventListener('change', (e) => {
        updateAIFields(e.target.value);
    });

    // Validate buttons
    $('#btn-check-token').addEventListener('click', validateToken);
    $('#btn-check-ai').addEventListener('click', validateAI);

    // Auto-complete custom endpoint URL on blur
    $('#ai-endpoint').addEventListener('blur', autoCompleteEndpoint);

    // Edit repo name button
    $('#btn-edit-repo').addEventListener('click', () => {
        const repoInput = $('#sync-repo');
        if (repoInput.readOnly) {
            if (confirm(chrome.i18n.getMessage('optionsConfirmEditRepo'))) {
                repoInput.readOnly = false;
                repoInput.style.opacity = '1';
                repoInput.focus();
                $('#btn-edit-repo').textContent = '🔓 ' + chrome.i18n.getMessage('optionsBtnUnlocked');
                $('#sync-repo-hint').textContent = '⚠️ ' + chrome.i18n.getMessage('optionsHintSaveRepo');
            }
        }
    });

    // Load models button
    $('#btn-load-models').addEventListener('click', loadModelsManually);

    // Model select → sync to hidden input
    $('#ai-model-select').addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === '__manual__') {
            // Switch to manual input
            $('#ai-model-select').style.display = 'none';
            $('#ai-model-manual-row').style.display = '';
            $('#ai-model').value = '';
            $('#ai-model').focus();
        } else {
            $('#ai-model').value = val;
        }
    });

    // Save
    $('#btn-save').addEventListener('click', handleSave);

    // Export
    $('#btn-export-md').addEventListener('click', handleExportMarkdown);
    $('#btn-export-json').addEventListener('click', handleExportJSON);

    // Clear history
    $('#btn-clear-history').addEventListener('click', async () => {
        if (confirm(chrome.i18n.getMessage('optionsConfirmClearHistory'))) {
            await clearHistory();
            showSaveStatus(chrome.i18n.getMessage('optionsHistoryCleared'));
        }
    });
}

function updateAIFields(provider) {
    const customFields = $('#custom-ai-fields');
    const hint = $('#ai-hint');

    if (provider === 'custom') {
        customFields.classList.remove('hidden');
    } else {
        customFields.classList.add('hidden');
    }

    if (provider === 'gemini') {
        hint.innerHTML = `<span data-i18n="optionsAIGeminiHint">${chrome.i18n.getMessage('optionsAIGeminiHint')}</span><a href="https://aistudio.google.com/apikey" target="_blank" data-i18n="optionsAIGeminiHintLink">${chrome.i18n.getMessage('optionsAIGeminiHintLink')}</a>`;
    } else if (provider === 'openai') {
        hint.innerHTML = `<span data-i18n="optionsAIOpenAIHint">${chrome.i18n.getMessage('optionsAIOpenAIHint')}</span><a href="https://platform.openai.com/api-keys" target="_blank" data-i18n="optionsAIOpenAIHintLink">${chrome.i18n.getMessage('optionsAIOpenAIHintLink')}</a>`;
    } else {
        hint.textContent = chrome.i18n.getMessage('optionsHintCustomKey');
    }
}

/**
 * Auto-complete custom endpoint URL
 * e.g. "https://api.example.com" → "https://api.example.com/v1/chat/completions"
 */
function autoCompleteEndpoint() {
    const input = $('#ai-endpoint');
    let url = input.value.trim();
    if (!url) return;

    // Remove trailing slash
    url = url.replace(/\/+$/, '');

    // If it doesn't end with a path that looks like an API endpoint, auto-complete
    if (!url.includes('/v1/') && !url.includes('/chat/') && !url.includes('/completions')) {
        // Check if it looks like a base URL (has protocol + host but no API path)
        try {
            const parsed = new URL(url);
            if (parsed.pathname === '/' || parsed.pathname === '') {
                url = `${url}/v1/chat/completions`;
            } else if (parsed.pathname === '/v1' || parsed.pathname === '/v1/') {
                url = `${parsed.origin}/v1/chat/completions`;
            }
        } catch {
            // Not a valid URL, leave as-is
        }
    }

    input.value = url;
}

/**
 * Validate GitHub Token
 */
async function validateToken() {
    const token = $('#github-token').value.trim();
    const statusEl = $('#token-status');
    const btn = $('#btn-check-token');

    if (!token) {
        showBadge(statusEl, 'error', chrome.i18n.getMessage('optionsErrorNoToken'));
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ ' + chrome.i18n.getMessage('optionsValidating');
    showBadge(statusEl, 'loading', chrome.i18n.getMessage('optionsValidatingDot'));

    try {
        // Temporarily save to validate
        await saveSettings({ githubToken: token });
        const user = await getCurrentUser();
        showBadge(statusEl, 'success', `✓ ${chrome.i18n.getMessage('optionsConnected', [user.login, user.public_repos.toString()])}`);
    } catch (err) {
        showBadge(statusEl, 'error', `✕ ${chrome.i18n.getMessage('optionsValidateFailed', [err.message])}`);
    }

    btn.disabled = false;
    btn.textContent = '🔍 ' + chrome.i18n.getMessage('optionsBtnCheck');
}

/**
 * Validate AI API Key
 */
async function validateAI() {
    const key = $('#ai-key').value.trim();
    const provider = $('#ai-provider').value;
    const statusEl = $('#ai-status');
    const btn = $('#btn-check-ai');

    if (!key) {
        showBadge(statusEl, 'error', chrome.i18n.getMessage('optionsErrorNoAPIKey'));
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ ' + chrome.i18n.getMessage('optionsValidating');
    showBadge(statusEl, 'loading', chrome.i18n.getMessage('optionsValidatingDot'));

    try {
        if (provider === 'gemini') {
            // Test Gemini with a simple prompt
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: 'Hi, respond with just "OK"' }] }],
                        generationConfig: { maxOutputTokens: 10 },
                    }),
                }
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error?.message || `HTTP ${res.status}`);
            }
            showBadge(statusEl, 'success', '✓ ' + chrome.i18n.getMessage('optionsGeminiKeyValid'));
        } else {
            // Test OpenAI-compatible API
            // Auto-complete endpoint FIRST, then read the value
            autoCompleteEndpoint();

            const endpoint = provider === 'custom'
                ? ($('#ai-endpoint').value.trim() || 'https://api.openai.com/v1/chat/completions')
                : 'https://api.openai.com/v1/chat/completions';

            const model = provider === 'custom'
                ? ($('#ai-model').value.trim() || 'gpt-4o-mini')
                : 'gpt-4o-mini';

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`,
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: 'Hi, respond with just "OK"' }],
                    max_tokens: 10,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error?.message || `HTTP ${res.status}`);
            }
            showBadge(statusEl, 'success', `✓ ${chrome.i18n.getMessage('optionsAPIKeyValidProvider', [provider === 'custom' ? chrome.i18n.getMessage('optionsProviderCustom') : 'OpenAI'])}`);

            // Try to fetch available models to populate the dropdown
            fetchAvailableModels(endpoint, key);
        }
    } catch (err) {
        showBadge(statusEl, 'error', `✕ ${chrome.i18n.getMessage('optionsValidateFailed', [err.message])}`);
    }

    btn.disabled = false;
    btn.textContent = '🔍 ' + chrome.i18n.getMessage('optionsBtnCheck');
}

/**
 * Manually trigger model loading
 */
async function loadModelsManually() {
    const key = $('#ai-key').value.trim();
    const provider = $('#ai-provider').value;
    if (!key) {
        showSaveStatus(chrome.i18n.getMessage('optionsErrorNoAPIKey'));
        return;
    }
    autoCompleteEndpoint();
    const endpoint = provider === 'custom'
        ? ($('#ai-endpoint').value.trim() || 'https://api.openai.com/v1/chat/completions')
        : 'https://api.openai.com/v1/chat/completions';
    await fetchAvailableModels(endpoint, key);
}

/**
 * Fetch available models from the /v1/models endpoint to populate the select dropdown
 */
async function fetchAvailableModels(chatEndpoint, key) {
    const select = $('#ai-model-select');
    const manualRow = $('#ai-model-manual-row');
    const hint = $('#model-hint');

    hint.textContent = '✅ ' + chrome.i18n.getMessage('optionsLoadingModels');

    try {
        let modelsEndpoint = chatEndpoint.replace(/\/chat\/completions\/?$/, '/models');
        if (modelsEndpoint === chatEndpoint) {
            try {
                const url = new URL(chatEndpoint);
                modelsEndpoint = `${url.origin}/v1/models`;
            } catch {
                hint.textContent = chrome.i18n.getMessage('optionsErrorParseAPI');
                return;
            }
        }

        const res = await fetch(modelsEndpoint, {
            headers: { 'Authorization': `Bearer ${key}` }
        });

        if (!res.ok) {
            hint.textContent = chrome.i18n.getMessage('optionsErrorLoadFail', [res.status.toString()]);
            return;
        }

        const result = await res.json();
        const models = result.data || result.models || [];
        if (!Array.isArray(models) || models.length === 0) {
            hint.textContent = chrome.i18n.getMessage('optionsErrorNoModelFound');
            return;
        }

        const modelIds = models.map(m => m.id || m.name || m).filter(id => typeof id === 'string');
        // Sort: put preferred models on top, then alphabetical
        const preferred = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
        modelIds.sort((a, b) => {
            const indexA = preferred.findIndex(p => a.includes(p));
            const indexB = preferred.findIndex(p => b.includes(p));
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });

        // Populate select dropdown
        const currentModel = $('#ai-model').value.trim();
        select.innerHTML = '';

        for (const id of modelIds) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = id;
            if (id === currentModel) option.selected = true;
            select.appendChild(option);
        }

        // Add "manual input" option at the end
        const manualOption = document.createElement('option');
        manualOption.value = '__manual__';
        manualOption.textContent = '✉️ ' + chrome.i18n.getMessage('optionsManualInput');
        select.appendChild(manualOption);

        // Show select, hide manual input
        select.style.display = '';
        manualRow.style.display = 'none';

        // If current model is in the list, select it; otherwise select first
        if (currentModel && modelIds.includes(currentModel)) {
            select.value = currentModel;
        } else if (modelIds.length > 0) {
            select.value = modelIds[0];
            $('#ai-model').value = modelIds[0];
        }

        hint.textContent = `✅ ${chrome.i18n.getMessage('optionsLoadedModels', [modelIds.length.toString()])}`;
        showSaveStatus(chrome.i18n.getMessage('optionsLoadedModels', [modelIds.length.toString()]));
    } catch (err) {
        console.warn('Failed to fetch models:', err);
        hint.textContent = chrome.i18n.getMessage('optionsErrorLoadModelMessage', [err.message]);
    }
}

function showBadge(el, type, text) {
    el.classList.remove('hidden', 'success', 'error', 'loading');
    el.classList.add(type);
    el.textContent = text;
}

async function handleSave() {
    // Auto-complete endpoint before save
    autoCompleteEndpoint();

    const newRepoName = $('#sync-repo').value.trim() || 'my-github-stars';

    // Warn if repo name changed
    if (originalRepoName && newRepoName !== originalRepoName) {
        if (!confirm(chrome.i18n.getMessage('optionsConfirmChangeRepo', [originalRepoName, newRepoName]))) {
            return;
        }
    }

    const settings = {
        githubToken: $('#github-token').value.trim(),
        githubApiBase: $('#github-api-base').value.trim(),
        syncRepoName: newRepoName,
        syncEnabled: $('#sync-enabled').checked,
        syncInterval: parseInt($('#sync-interval').value) || 30,
        aiProvider: $('#ai-provider').value,
        aiApiKey: $('#ai-key').value.trim(),
        aiCustomEndpoint: $('#ai-endpoint').value.trim(),
        aiCustomModel: $('#ai-model').value.trim(),
        recordHistory: $('#record-history').checked,
    };

    await saveSettings(settings);
    originalRepoName = newRepoName;

    // Update alarm interval
    chrome.alarms.clear('auto-sync');
    if (settings.syncEnabled) {
        chrome.alarms.create('auto-sync', { periodInMinutes: settings.syncInterval });
    }

    showSaveStatus(chrome.i18n.getMessage('optionsSavedSettings') + ' ✓');
}

function showSaveStatus(text) {
    const el = $('#save-status');
    el.textContent = text;
    el.style.color = 'var(--color-success)';
    setTimeout(() => { el.textContent = ''; }, 3000);
}

async function handleExportMarkdown() {
    try {
        const markdown = await exportToMarkdown();
        downloadFile('github-stars.md', markdown, 'text/markdown');
        showSaveStatus(chrome.i18n.getMessage('optionsExportedMarkdown'));
    } catch (err) {
        showSaveStatus(chrome.i18n.getMessage('optionsExportFailed', [err.message]));
    }
}

async function handleExportJSON() {
    try {
        const data = await exportAllData();
        downloadFile('github-stars-data.json', JSON.stringify(data, null, 2), 'application/json');
        showSaveStatus(chrome.i18n.getMessage('optionsExportedJSON'));
    } catch (err) {
        showSaveStatus(chrome.i18n.getMessage('optionsExportFailed', [err.message]));
    }
}

function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
