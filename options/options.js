// ===== GitHub Stars Manager — Options Page =====

import { getSettings, saveSettings, clearHistory, exportAllData } from '../lib/storage.js';
import { getCurrentUser } from '../lib/github-api.js';
import { exportToMarkdown } from '../lib/sync.js';

const $ = (sel) => document.querySelector(sel);

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
    const settings = await getSettings();
    originalRepoName = settings.syncRepoName || '';
    loadSettingsToForm(settings);
    bindEvents();
});

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
        editBtn.textContent = '\u270f\ufe0f \u4fee\u6539';
        hint.textContent = '\ud83d\udd12 \u4ed3\u5e93\u540d\u5df2\u9501\u5b9a\uff0c\u70b9\u51fb\u4fee\u6539\u6309\u94ae\u89e3\u9501';
    } else {
        repoInput.readOnly = false;
        repoInput.style.opacity = '1';
        editBtn.style.display = 'none';
        hint.textContent = '\u5c06\u81ea\u52a8\u521b\u5efa\u4e3a\u79c1\u6709\u4ed3\u5e93';
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
            if (confirm('\u4fee\u6539\u4ed3\u5e93\u540d\u53ef\u80fd\u5bfc\u81f4\u4e0e\u5df2\u6709\u540c\u6b65\u4ed3\u5e93\u65ad\u5f00\u8fde\u63a5\u3002\u786e\u5b9a\u8981\u4fee\u6539\u5417\uff1f')) {
                repoInput.readOnly = false;
                repoInput.style.opacity = '1';
                repoInput.focus();
                $('#btn-edit-repo').textContent = '\ud83d\udd13 \u5df2\u89e3\u9501';
                $('#sync-repo-hint').textContent = '\u26a0\ufe0f \u4fee\u6539\u540e\u8bf7\u70b9\u51fb\u4fdd\u5b58';
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
        if (confirm('确定清除所有浏览历史？此操作不可恢复。')) {
            await clearHistory();
            showSaveStatus('浏览历史已清除');
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
        hint.innerHTML = 'Gemini Key: <a href="https://aistudio.google.com/apikey" target="_blank">获取免费 Key →</a>';
    } else if (provider === 'openai') {
        hint.innerHTML = 'OpenAI Key: <a href="https://platform.openai.com/api-keys" target="_blank">获取 Key →</a>';
    } else {
        hint.textContent = '输入你的自定义 AI API Key';
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
        showBadge(statusEl, 'error', '请输入 Token');
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ 验证中...';
    showBadge(statusEl, 'loading', '正在验证...');

    try {
        // Temporarily save to validate
        await saveSettings({ githubToken: token });
        const user = await getCurrentUser();
        showBadge(statusEl, 'success', `✓ 已连接: ${user.login} (${user.public_repos} 个公开仓库)`);
    } catch (err) {
        showBadge(statusEl, 'error', `✕ 验证失败: ${err.message}`);
    }

    btn.disabled = false;
    btn.textContent = '🔍 验证';
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
        showBadge(statusEl, 'error', '请输入 API Key');
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ 验证中...';
    showBadge(statusEl, 'loading', '正在验证...');

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
            showBadge(statusEl, 'success', '✓ Gemini API Key 有效');
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
            showBadge(statusEl, 'success', `✓ API Key 有效 (${provider === 'custom' ? '自定义' : 'OpenAI'})`);

            // Try to fetch available models to populate the dropdown
            fetchAvailableModels(endpoint, key);
        }
    } catch (err) {
        showBadge(statusEl, 'error', `✕ 验证失败: ${err.message}`);
    }

    btn.disabled = false;
    btn.textContent = '🔍 验证';
}

/**
 * Manually trigger model loading
 */
async function loadModelsManually() {
    const key = $('#ai-key').value.trim();
    const provider = $('#ai-provider').value;
    if (!key) {
        showSaveStatus('请先输入 API Key');
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

    hint.textContent = '✅ 正在加载模型列表...';

    try {
        let modelsEndpoint = chatEndpoint.replace(/\/chat\/completions\/?$/, '/models');
        if (modelsEndpoint === chatEndpoint) {
            try {
                const url = new URL(chatEndpoint);
                modelsEndpoint = `${url.origin}/v1/models`;
            } catch {
                hint.textContent = '无法解析 API 地址，请手动输入模型名';
                return;
            }
        }

        const res = await fetch(modelsEndpoint, {
            headers: { 'Authorization': `Bearer ${key}` }
        });

        if (!res.ok) {
            hint.textContent = `加载失败 (HTTP ${res.status})，请手动输入模型名`;
            return;
        }

        const result = await res.json();
        const models = result.data || result.models || [];
        if (!Array.isArray(models) || models.length === 0) {
            hint.textContent = '未找到可用模型，请手动输入模型名';
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
        manualOption.textContent = '✉️ 手动输入...';
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

        hint.textContent = `✅ 已加载 ${modelIds.length} 个可用模型`;
        showSaveStatus(`已加载 ${modelIds.length} 个可用模型`);
    } catch (err) {
        console.warn('Failed to fetch models:', err);
        hint.textContent = `加载模型失败: ${err.message}，请手动输入`;
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
        if (!confirm(`\u4ed3\u5e93\u540d\u4ece\u300c${originalRepoName}\u300d\u6539\u4e3a\u300c${newRepoName}\u300d\uff0c\u8fd9\u5c06\u65ad\u5f00\u4e0e\u65e7\u4ed3\u5e93\u7684\u540c\u6b65\u3002\u786e\u5b9a\u8981\u4fdd\u5b58\u5417\uff1f`)) {
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

    showSaveStatus('设置已保存 ✓');
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
        showSaveStatus('Markdown 已导出');
    } catch (err) {
        showSaveStatus(`导出失败: ${err.message}`);
    }
}

async function handleExportJSON() {
    try {
        const data = await exportAllData();
        downloadFile('github-stars-data.json', JSON.stringify(data, null, 2), 'application/json');
        showSaveStatus('JSON 已导出');
    } catch (err) {
        showSaveStatus(`导出失败: ${err.message}`);
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
