// ===== GitHub Stars Manager — Popup Main =====

import { getSettings, saveSettings, getStarsData, saveStarData, getTags, saveTags, addTag, removeTag, getHistory, getCachedStars, saveCachedStars } from '../lib/storage.js';
import { getAllStarredRepos, getRepoReadme } from '../lib/github-api.js';
import { generateSummary, isAIConfigured } from '../lib/ai-summary.js';
import { syncToGitHub } from '../lib/sync.js';
import { applyTheme } from '../lib/theme.js';
import { timeAgo, formatCount, getTagColor, getLangColor, truncateText } from '../lib/utils.js';
import { initI18n, localizeDocument, t } from '../lib/i18n.js';

// ===== State =====
let allStars = [];        // Array of repo info from GitHub API
let starsData = {};       // Our local metadata (tags, notes, etc.)
let allTags = [];
let historyData = [];
let activeTagFilter = null;
let currentEditRepo = null;
let currentAIController = null; // AbortController for in-flight AI request
let currentTheme = 'system';
let currentLanguage = 'en';

const DEFAULT_TAGS = {
    en: ['Frontend', 'Backend', 'AI', 'Tool', 'Web3', 'Framework'],
    zh_CN: ['前端', '后端', 'AI', '工具', 'Web3', '框架'],
};
const NOTE_AI_PREVIEW_THRESHOLD = 40;

const ZH_TAG_LABELS = {
    Frontend: '前端',
    Backend: '后端',
    Tool: '工具',
    Framework: '框架',
    Automation: '自动化',
    'Chrome Extension': 'Chrome 插件',
    Collection: '收藏集',
};

// ===== DOM References =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[char]);
}

function getCompactTagLabel(tag) {
    const label = getLocalizedTagLabel(tag);
    if (label.length <= 12) return label;

    const firstWord = label.split(/[\s/_-]+/).filter(Boolean)[0];
    if (firstWord && firstWord.length >= 4 && firstWord.length <= 12) {
        return firstWord;
    }

    return `${label.slice(0, 10)}...`;
}

function getLocalizedTagLabel(tag) {
    if (currentLanguage !== 'zh_CN') return String(tag ?? '');
    return ZH_TAG_LABELS[tag] || String(tag ?? '');
}

function normalizeTagForStorage(tag) {
    const label = String(tag ?? '').trim();
    if (!label || currentLanguage !== 'zh_CN') return label;

    const existingTag = allTags.find(existing => getLocalizedTagLabel(existing) === label);
    return existingTag || label;
}

function renderPreviewLines(data) {
    const note = (data.note || '').trim();
    const aiSummary = (data.aiSummary || '').trim();
    const lines = [];

    if (note) {
        lines.push(`<div class="star-note-preview">📝 ${escapeHtml(truncateText(note, 60))}</div>`);
    }

    if (aiSummary && (!note || note.length <= NOTE_AI_PREVIEW_THRESHOLD)) {
        lines.push(`<div class="star-note-preview star-ai-preview">🤖 ${escapeHtml(truncateText(aiSummary, note ? 48 : 60))}</div>`);
    }

    return lines.join('');
}

function showConfirmDialog(message, options = {}) {
    return new Promise(resolve => {
        const modal = $('#confirm-modal');
        const title = $('#confirm-title');
        const messageEl = $('#confirm-message');
        const cancelBtn = $('#confirm-cancel');
        const okBtn = $('#confirm-ok');

        title.textContent = options.title || t('popupConfirmTitle');
        messageEl.textContent = message;
        okBtn.textContent = options.okText || t('popupBtnDelete');
        cancelBtn.textContent = options.cancelText || t('popupBtnCancel');
        modal.classList.remove('hidden');

        const close = (confirmed) => {
            modal.classList.add('hidden');
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            modal.removeEventListener('click', handleBackdrop);
            document.removeEventListener('keydown', handleKeydown);
            resolve(confirmed);
        };

        const handleOk = () => close(true);
        const handleCancel = () => close(false);
        const handleBackdrop = (event) => {
            if (event.target.classList.contains('modal-backdrop')) close(false);
        };
        const handleKeydown = (event) => {
            if (event.key === 'Escape') close(false);
            if (event.key === 'Enter') close(true);
        };

        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
        modal.addEventListener('click', handleBackdrop);
        document.addEventListener('keydown', handleKeydown);
        okBtn.focus();
    });
}

function isImeComposing(event) {
    return event.isComposing || event.keyCode === 229 || event.key === 'Process';
}

const SEARCH_ALIASES = {
    ai: ['artificial intelligence', 'llm', 'gpt'],
    cpp: ['c++', 'cplusplus', 'c plus plus'],
    cs: ['c#', 'csharp', 'c sharp'],
    go: ['golang'],
    js: ['javascript', 'node', 'nodejs', 'node.js'],
    k8s: ['kubernetes'],
    ml: ['machine learning'],
    next: ['nextjs', 'next.js'],
    node: ['nodejs', 'node.js'],
    postgres: ['postgresql'],
    py: ['python'],
    rb: ['ruby'],
    rs: ['rust'],
    sh: ['shell', 'bash'],
    ts: ['typescript'],
    vue: ['vuejs', 'vue.js'],
};

function normalizeSearchText(value) {
    return String(value ?? '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[_./-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getSearchTokens(query) {
    return normalizeSearchText(query).split(' ').filter(Boolean);
}

function expandSearchToken(token) {
    return [token, ...(SEARCH_ALIASES[token] || [])].map(normalizeSearchText);
}

function buildSearchTarget(parts) {
    const normalized = normalizeSearchText(parts.flat().filter(Boolean).join(' '));
    return {
        normalized,
        compact: normalized.replace(/\s+/g, ''),
    };
}

function searchTargetMatches(target, query) {
    const tokens = getSearchTokens(query);
    if (tokens.length === 0) return true;

    return tokens.every(token => {
        return expandSearchToken(token).some(alias => {
            const compactAlias = alias.replace(/\s+/g, '');
            return target.normalized.includes(alias) || target.compact.includes(compactAlias);
        });
    });
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
    const settings = await getSettings();
    currentLanguage = await initI18n(settings.appLanguage);
    currentTheme = settings.theme || 'system';
    applyTheme(currentTheme);
    localizeHtmlPage();
    updateThemeButton();

    bindEvents();

    if (!settings.githubToken) {
        showSetupScreen();
    } else {
        showMainContent();
        loadData(); // Don't await this, let it run in background so UI is interactive instantly
    }
});

// ===== Localization =====
function localizeHtmlPage() {
    localizeDocument();
}


// ===== Setup =====
function showSetupScreen() {
    $('#setup-screen').classList.remove('hidden');
    $('#main-content').classList.add('hidden');
}

function showMainContent() {
    $('#setup-screen').classList.add('hidden');
    $('#main-content').classList.remove('hidden');
}

function getThemeLabel(theme) {
    const labels = {
        system: t('popupThemeSystem'),
        light: t('popupThemeLight'),
        dark: t('popupThemeDark'),
    };
    return labels[theme] || labels.system;
}

function getNextTheme(theme) {
    if (theme === 'system') return 'light';
    if (theme === 'light') return 'dark';
    return 'system';
}

function getThemeIcon(theme) {
    if (theme === 'light') {
        return `
            <svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
                <path d="M440-760v-160h80v160h-80Zm266 110-57-57 113-113 57 57-113 113Zm54 210v-80h160v80H760ZM440-40v-160h80v160h-80ZM254-650 141-763l57-57 113 113-57 57Zm508 510L649-253l57-57 113 113-57 57ZM40-440v-80h160v80H40Zm158 300-57-57 113-113 57 57-113 113Zm282-100q-100 0-170-70t-70-170q0-100 70-170t170-70q100 0 170 70t70 170q0 100-70 170t-170 70Z" />
            </svg>
        `;
    }

    if (theme === 'dark') {
        return `
            <svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
                <path d="M484-80q-84 0-157.5-32t-128-86.5Q144-253 112-326.5T80-484q0-146 93-257.5T410-880q-18 99 11 193.5T520-521q71 71 165.5 100T879-410q-26 144-138 237T484-80Z" />
            </svg>
        `;
    }

    return `
        <svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
            <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm240 160v-80h160v80H400Z" />
        </svg>
    `;
}

function updateThemeButton() {
    const btn = $('#btn-theme');
    if (!btn) return;
    btn.title = t('popupBtnThemeCurrent', [getThemeLabel(currentTheme)]);
    btn.dataset.themeMode = currentTheme;
    btn.innerHTML = getThemeIcon(currentTheme);
}

async function handleThemeToggle() {
    currentTheme = getNextTheme(currentTheme);
    applyTheme(currentTheme);
    updateThemeButton();
    await saveSettings({ theme: currentTheme });
    setStatus(t('msgThemeSwitched', [getThemeLabel(currentTheme)]));
}

// ===== Event Binding =====
function bindEvents() {
    // Setup
    $('#setup-submit').addEventListener('click', async () => {
        const token = $('#setup-token').value.trim();
        if (!token) return;
        await saveSettings({ githubToken: token });
        showMainContent();
        await loadData();
    });

    $('#setup-token').addEventListener('keydown', (e) => {
        if (isImeComposing(e)) return;
        if (e.key === 'Enter') {
            $('#setup-submit').click();
        }
    });

    // Tabs
    $$('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.tab').forEach(t => t.classList.remove('active'));
            $$('.tab-content').forEach(t => t.classList.add('hidden'));
            tab.classList.add('active');
            const tabName = tab.dataset.tab;
            $(`#tab-${tabName}`).classList.remove('hidden');

            // Show/hide search and tag filter bar based on tab
            const searchInput = $('#search-input');
            if (tabName === 'stars') {
                $('.search-bar').classList.remove('hidden');
                $('#tag-filter-bar').classList.remove('hidden');
                searchInput.placeholder = t('popupSearchPlaceholder');
                searchInput.value = '';
            } else if (tabName === 'history') {
                $('.search-bar').classList.remove('hidden');
                $('#tag-filter-bar').classList.add('hidden');
                searchInput.placeholder = t('popupHistorySearchPlaceholder');
                searchInput.value = '';
            } else {
                $('.search-bar').classList.add('hidden');
                $('#tag-filter-bar').classList.add('hidden');
            }

            if (tabName === 'stars') renderStars(searchInput.value);
            if (tabName === 'history') renderHistory(searchInput.value);
            if (tabName === 'tags') renderTagManager();
        });
    });

    // Search is applied on Enter/blur to avoid Chrome popup IME composition glitches.
    const searchInput = $('#search-input');
    let searchIsComposing = false;
    let pendingSearchQuery = searchInput.value;

    function applySearch() {
        const activeTab = document.querySelector('.tab.active').dataset.tab;
        if (activeTab === 'stars') {
            renderStars(pendingSearchQuery);
        } else if (activeTab === 'history') {
            renderHistory(pendingSearchQuery);
        }
    }

    searchInput.addEventListener('beforeinput', (e) => {
        if (e.isComposing || e.inputType === 'insertCompositionText') {
            searchIsComposing = true;
        }
    });

    searchInput.addEventListener('compositionstart', () => {
        searchIsComposing = true;
    });

    searchInput.addEventListener('compositionupdate', () => {
        searchIsComposing = true;
    });

    searchInput.addEventListener('compositionend', (e) => {
        searchIsComposing = false;
        pendingSearchQuery = e.target.value;
    });

    searchInput.addEventListener('input', (e) => {
        pendingSearchQuery = e.target.value;
    });

    searchInput.addEventListener('keydown', (e) => {
        if (isImeComposing(e) || searchIsComposing) return;
        if (e.key === 'Enter') {
            pendingSearchQuery = searchInput.value;
            applySearch();
        } else if (e.key === 'Escape') {
            searchInput.value = '';
            pendingSearchQuery = '';
            applySearch();
        }
    });

    searchInput.addEventListener('change', () => {
        if (searchIsComposing) return;
        pendingSearchQuery = searchInput.value;
        applySearch();
    });

    searchInput.addEventListener('blur', () => {
        if (searchIsComposing) return;
        pendingSearchQuery = searchInput.value;
        applySearch();
    });

    // Sync
    $('#btn-sync').addEventListener('click', handleSync);

    // Open as a regular tab for Linux IME compatibility.
    $('#btn-open-tab').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
        window.close();
    });

    // Theme
    $('#btn-theme').addEventListener('click', handleThemeToggle);

    // Settings
    $('#btn-settings').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Modal
    $('#modal-close').addEventListener('click', closeModal);
    $('.modal-backdrop').addEventListener('click', closeModal);
    $('#modal-save').addEventListener('click', handleModalSave);
    $('#modal-ai-btn').addEventListener('click', handleAISummary);
    $('#modal-tag-add-btn').addEventListener('click', handleModalAddTag);
    $('#modal-tag-input').addEventListener('keydown', (e) => {
        if (isImeComposing(e)) return;
        const list = $('#modal-tag-autocomplete');
        if (e.key === 'Enter' && !list.classList.contains('hidden') && list.querySelector('.selected')) {
            return;
        }
        if (e.key === 'Enter') handleModalAddTag();
    });

    // Tag Manager
    $('#btn-add-tag').addEventListener('click', handleAddTag);
    $('#new-tag-input').addEventListener('keydown', (e) => {
        if (isImeComposing(e)) return;
        // If the autocomplete dropdown is visible and an item is selected, let it handle the enter key first.
        const list = $('#new-tag-autocomplete');
        if (e.key === 'Enter' && !list.classList.contains('hidden') && list.querySelector('.selected')) {
            return;
        }
        if (e.key === 'Enter') handleAddTag();
    });

    // Autocomplete Initialization
    setupAutocomplete('new-tag-input', 'new-tag-autocomplete', () => []);
    setupAutocomplete('modal-tag-input', 'modal-tag-autocomplete', () => {
        if (!currentEditRepo || !starsData[currentEditRepo]) return [];
        return starsData[currentEditRepo].tags || [];
    });
}

// ===== Autocomplete Logic =====
function setupAutocomplete(inputId, listId, getExistingTags) {
    const input = $(`#${inputId}`);
    const list = $(`#${listId}`);
    let selectedIndex = -1;

    function renderList() {
        const query = input.value.trim();
        const existingTags = getExistingTags ? getExistingTags() : [];
        const availableTags = allTags.filter(t => !existingTags.includes(t));

        let matches = availableTags;
        if (query) {
            matches = availableTags.filter(tag => {
                return searchTargetMatches(buildSearchTarget([tag, getLocalizedTagLabel(tag)]), query);
            });
        }

        if (matches.length === 0) {
            list.classList.add('hidden');
            return;
        }

        list.innerHTML = matches.map((tag, i) => `
            <li class="autocomplete-item ${i === selectedIndex ? 'selected' : ''}" data-tag="${escapeHtml(tag)}" title="${escapeHtml(tag)}">${escapeHtml(getLocalizedTagLabel(tag))}</li>
        `).join('');
        list.classList.remove('hidden');

        if (selectedIndex >= 0) {
            const item = list.children[selectedIndex];
            if (item) item.scrollIntoView({ block: 'nearest' });
        }
    }

    input.addEventListener('focus', () => {
        selectedIndex = -1;
        renderList();
    });

    input.addEventListener('input', () => {
        selectedIndex = -1;
        renderList();
    });

    input.addEventListener('keydown', (e) => {
        if (isImeComposing(e)) return;
        if (list.classList.contains('hidden')) return;

        const itemsCount = list.children.length;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % itemsCount;
            renderList();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + itemsCount) % itemsCount;
            renderList();
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0) {
                e.preventDefault();
                input.value = list.children[selectedIndex].dataset.tag;
                list.classList.add('hidden');
            }
        } else if (e.key === 'Escape') {
            list.classList.add('hidden');
        }
    });

    list.addEventListener('mousedown', (e) => {
        const item = e.target.closest('.autocomplete-item');
        if (item) {
            e.preventDefault(); // Prevent input blur
            input.value = item.dataset.tag;
            list.classList.add('hidden');
            input.focus();
        }
    });

    input.addEventListener('blur', () => {
        list.classList.add('hidden');
    });
}

// ===== Data Loading =====
async function loadData() {
    setStatus(t('msgLoadingCache'));

    try {
        // Load local data first
        [starsData, allTags, historyData, allStars] = await Promise.all([
            getStarsData(),
            getTags(),
            getHistory(),
            getCachedStars(),
        ]);

        // If no tags exist, set some defaults
        if (allTags.length === 0) {
            allTags = DEFAULT_TAGS[currentLanguage] || DEFAULT_TAGS.en;
            await saveTags(allTags);
        }

        // Render instantly from cache if available
        if (allStars && allStars.length > 0) {
            renderStars();
            renderTagFilterBar();
            setStatus(t('msgLoadedCache', [allStars.length.toString()]));
            $('#stars-stats').classList.remove('hidden');
            $('#stars-stats').textContent = t('msgStarsStats', [allStars.length.toString(), allTags.length.toString()]);
        }

        // Fetch stars from GitHub API in the background
        const freshStars = await getAllStarredRepos((count) => {
            if (!allStars || allStars.length === 0) {
                setStatus(t('msgFirstLoad', [count.toString()]));
            }
        });

        // Merge API data into local data
        for (const star of freshStars) {
            if (!starsData[star.fullName]) {
                starsData[star.fullName] = {};
            }
            starsData[star.fullName].repoInfo = star;
            if (!starsData[star.fullName].starredAt) {
                starsData[star.fullName].starredAt = star.starredAt;
            }
        }

        // Save fresh data to cache
        allStars = freshStars;
        await saveCachedStars(allStars);

        // Re-render with fresh data silently
        renderStars($('#search-input').value);
        renderTagFilterBar();

        setStatus(t('msgSyncDone', [allStars.length.toString()]));
        $('#stars-stats').classList.remove('hidden');
        $('#stars-stats').textContent = t('msgStarsStats', [allStars.length.toString(), allTags.length.toString()]);
    } catch (err) {
        setStatus(t('msgError', [err.message]));
        if (!allStars || allStars.length === 0) {
            $('#stars-list').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <p class="empty-state-text">${err.message}</p>
        </div>`;
        }
    }
}

// ===== Render Stars =====
function renderStars(searchQuery = '') {
    const list = $('#stars-list');
    const query = searchQuery.trim();

    let filtered = allStars;

    // Filter by search
    if (query) {
        filtered = filtered.filter(star => {
            const data = starsData[star.fullName] || {};
            const searchTarget = buildSearchTarget([
                star.fullName,
                star.name,
                star.owner,
                star.description,
                star.language,
                star.homepage,
                star.license,
                star.topics || [],
                data.tags || [],
                (data.tags || []).map(getLocalizedTagLabel),
                data.note,
                data.aiSummary,
            ]);
            return searchTargetMatches(searchTarget, query);
        });
    }

    // Filter by tag
    if (activeTagFilter) {
        filtered = filtered.filter(star => {
            const data = starsData[star.fullName] || {};
            return data.tags && data.tags.includes(activeTagFilter);
        });
    }

    if (filtered.length === 0) {
        list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <p class="empty-state-text">${query ? t('msgNoSearchMatch') : t('msgNoStars')}</p>
      </div>`;
        return;
    }

    list.innerHTML = filtered.map((star, i) => {
        const data = starsData[star.fullName] || {};
        const tags = data.tags || [];

        return `
      <div class="star-item" data-repo="${star.fullName}" style="animation-delay:${Math.min(i * 30, 300)}ms">
        <img class="star-avatar" src="${star.ownerAvatar}" alt="${star.owner}" loading="lazy">
        <div class="star-info">
          <div class="star-name">
            <a href="${star.url}" target="_blank" title="${star.fullName}">${star.fullName}</a>
            ${star.isArchived ? `<span class="tag tag-orange" style="font-size:9px">${t('msgArchived')}</span>` : ''}
          </div>
          <div class="star-desc">${star.description || ''}</div>
          ${renderPreviewLines(data)}
          <div class="star-meta">
            ${star.language ? `<span class="star-lang"><span class="lang-dot" style="background:${getLangColor(star.language)}"></span>${star.language}</span>` : ''}
            <span>⭐ ${formatCount(star.stars)}</span>
            <span>${timeAgo(star.starredAt, t)}</span>
          </div>
          ${tags.length > 0 ? `<div class="star-tags">${tags.map(tag => `<span class="tag ${getTagColor(tag)}" style="font-size:10px" title="${escapeHtml(tag)}">${escapeHtml(getLocalizedTagLabel(tag))}</span>`).join('')}</div>` : ''}
        </div>
        <div class="star-actions">
          <button class="star-edit-btn" data-repo="${star.fullName}" title="${t('msgEditNoteTags')}">📝</button>
        </div>
      </div>`;
    }).join('');

    // Bind edit buttons
    list.querySelectorAll('.star-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openModal(btn.dataset.repo);
        });
    });

    // Bind row click to open in new tab
    list.querySelectorAll('.star-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('a') || e.target.closest('.star-edit-btn')) return;
            const repo = item.dataset.repo;
            window.open(`https://github.com/${repo}`, '_blank');
        });
    });
}

// ===== Tag Filter Bar =====
function renderTagFilterBar() {
    const bar = $('#tag-filter-bar');
    if (allTags.length === 0) {
        bar.classList.add('hidden');
        return;
    }
    bar.classList.remove('hidden');

    // Count stars per tag
    const tagCounts = {};
    for (const data of Object.values(starsData)) {
        for (const tag of (data.tags || [])) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
    }

    const visibleTags = allTags.filter(tag => (tagCounts[tag] || 0) > 0);
    if (activeTagFilter && !visibleTags.includes(activeTagFilter)) {
        activeTagFilter = null;
    }

    bar.innerHTML = `
    <span class="tag tag-filter ${!activeTagFilter ? 'active' : ''}" data-tag="">${t('msgFilterAll')}</span>
    ${visibleTags.map(tag => {
        const safeTag = escapeHtml(tag);
        const safeLabel = escapeHtml(getCompactTagLabel(tag));
        return `<span class="tag tag-filter ${getTagColor(tag)} ${activeTagFilter === tag ? 'active' : ''}" data-tag="${safeTag}" title="${safeTag}">${safeLabel}<span class="tag-filter-count">${tagCounts[tag]}</span></span>`;
    }).join('')}
  `;

    bar.querySelectorAll('.tag-filter').forEach(el => {
        el.addEventListener('click', () => {
            activeTagFilter = el.dataset.tag || null;
            renderStars($('#search-input').value);
            renderTagFilterBar();
        });
    });
}

// ===== Render History =====
function renderHistory(searchQuery = '') {
    const list = $('#history-list');
    const query = searchQuery.trim();

    let filtered = historyData;
    if (query) {
        filtered = filtered.filter(entry => {
            const searchTarget = buildSearchTarget([
                entry.repo,
                entry.title,
                entry.description,
            ]);
            return searchTargetMatches(searchTarget, query);
        });
    }

    if (filtered.length === 0) {
        list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <p class="empty-state-text">${query ? t('msgNoSearchMatch') : t('popupEmptyHistory')}</p>
        ${!query ? `<p class="text-xs text-secondary" style="margin-top:8px">${t('popupEmptyHistoryDesc')}</p>` : ''}
      </div>`;
        return;
    }

    // Group by date
    const byDate = {};
    for (const entry of filtered) {
        const date = new Date(entry.visitedAt).toLocaleDateString(document.documentElement.lang);
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(entry);
    }

    let html = '';
    for (const [date, entries] of Object.entries(byDate)) {
        html += `<div class="history-date">${date}</div>`;
        for (const entry of entries) {
            const time = new Date(entry.visitedAt).toLocaleTimeString(document.documentElement.lang, { hour: '2-digit', minute: '2-digit' });
            html += `
        <div class="history-item">
          <span class="history-time">${time}</span>
          <span class="history-repo">
            <a href="https://github.com/${entry.repo}" target="_blank">${entry.repo}</a>
          </span>
        </div>`;
        }
    }
    list.innerHTML = html;
}

// ===== Tag Manager =====
function renderTagManager() {
    const list = $('#tag-list');
    const tagCounts = {};
    for (const data of Object.values(starsData)) {
        for (const tag of (data.tags || [])) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
    }

    if (allTags.length === 0) {
        list.innerHTML = `<p class="text-secondary text-sm">${t('msgNoTags')}</p>`;
        return;
    }

    list.innerHTML = allTags.map(tag => `
    <div class="tag-item">
      <span class="tag ${getTagColor(tag)}" title="${escapeHtml(tag)}">${escapeHtml(getLocalizedTagLabel(tag))}</span>
      <span class="tag-count">${tagCounts[tag] || 0}</span>
      <span class="tag-delete" data-tag="${escapeHtml(tag)}" title="${t('popupBtnDeleteTag')}">✕</span>
    </div>
  `).join('');

    list.querySelectorAll('.tag-delete').forEach(el => {
        el.addEventListener('click', async () => {
            const confirmed = await showConfirmDialog(t('msgConfirmDeleteTag', [getLocalizedTagLabel(el.dataset.tag)]));
            if (!confirmed) return;

            await removeTag(el.dataset.tag);
            allTags = await getTags();
            starsData = await getStarsData();
            renderTagManager();
            renderTagFilterBar();
        });
    });
}

async function handleAddTag() {
    const input = $('#new-tag-input');
    const tag = normalizeTagForStorage(input.value.trim());
    if (!tag) return;
    await addTag(tag);
    allTags = await getTags();
    input.value = '';
    renderTagManager();
    renderTagFilterBar();
}

// ===== Modal =====
function openModal(fullName) {
    currentEditRepo = fullName;
    const data = starsData[fullName] || {};
    const repoInfo = data.repoInfo || {};

    $('#modal-repo-name').textContent = fullName;
    $('#modal-note').value = data.note || '';
    $('#modal-ai-summary').innerHTML = data.aiSummary
        ? `<span style="color:var(--text-primary)">${data.aiSummary}</span>`
        : `<span class="text-secondary text-sm">${t('popupModalAIPromptFull')}</span>`;

    renderModalTags(data.tags || []);
    $('#note-modal').classList.remove('hidden');
}

function closeModal() {
    // Cancel any in-flight AI request
    if (currentAIController) {
        currentAIController.abort();
        currentAIController = null;
    }
    // Reset AI button state in case it was stuck
    const btn = $('#modal-ai-btn');
    btn.disabled = false;
    btn.textContent = t('popupModalAIBtn');

    $('#note-modal').classList.add('hidden');
    currentEditRepo = null;
}

function renderModalTags(tags) {
    const container = $('#modal-tags');
    container.innerHTML = tags.map(tag => `
        <span class="tag ${getTagColor(tag)}" title="${escapeHtml(tag)}">
            ${escapeHtml(getLocalizedTagLabel(tag))}
            <span class="tag-remove" data-tag="${escapeHtml(tag)}">✕</span>
        </span>
    `).join('') || `<span class="text-secondary text-xs">${t('msgEmptyTags')}</span>`;

    container.querySelectorAll('.tag-remove').forEach(el => {
        el.addEventListener('click', async () => {
            const data = starsData[currentEditRepo] || {};
            const newTags = (data.tags || []).filter(t => t !== el.dataset.tag);
            starsData[currentEditRepo] = { ...data, tags: newTags };
            renderModalTags(newTags);
        });
    });
}

async function handleModalAddTag() {
    const input = $('#modal-tag-input');
    const tag = normalizeTagForStorage(input.value.trim());
    if (!tag || !currentEditRepo) return;

    await addTag(tag);
    allTags = await getTags();

    const data = starsData[currentEditRepo] || {};
    const tags = [...new Set([...(data.tags || []), tag])];
    starsData[currentEditRepo] = { ...data, tags };
    renderModalTags(tags);
    input.value = '';
}

async function handleModalSave() {
    if (!currentEditRepo) return;

    const note = $('#modal-note').value.trim();
    const data = starsData[currentEditRepo] || {};
    const aiText = $('#modal-ai-summary').querySelector('span');
    const aiSummary = aiText && !aiText.classList.contains('text-secondary') ? aiText.textContent : data.aiSummary;

    await saveStarData(currentEditRepo, {
        ...data,
        note,
        aiSummary,
    });

    starsData = await getStarsData();
    renderStars($('#search-input').value);
    closeModal();
    setStatus(t('msgSaved'));
}

async function handleAISummary() {
    if (!currentEditRepo) return;

    // Check if AI is configured first
    const configured = await isAIConfigured();
    if (!configured) {
        const summaryBox = $('#modal-ai-summary');
        summaryBox.innerHTML = `<span style="color:var(--color-danger)">${t('msgAIConfigWarning')} <a href="#" id="go-settings-link" style="color:var(--color-accent);text-decoration:underline;margin:0 4px;">${t('msgSettingsInMessage')}</a></span>`;
        document.getElementById('go-settings-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.openOptionsPage();
        });
        return;
    }

    // Cancel any previous in-flight request

    if (currentAIController) {
        currentAIController.abort();
    }
    currentAIController = new AbortController();
    const signal = currentAIController.signal;

    const btn = $('#modal-ai-btn');
    const summaryBox = $('#modal-ai-summary');
    btn.disabled = true;
    btn.textContent = t('msgAIGenerating');
    summaryBox.innerHTML = '<div class="spinner" style="width:16px;height:16px;"></div>';

    try {
        const data = starsData[currentEditRepo] || {};
        const repoInfo = data.repoInfo || {};

        // Fetch real README content via GitHub API
        const [owner, repo] = currentEditRepo.split('/');
        const readmeContent = await getRepoReadme(owner, repo);

        // Pass localized labels so AI follows the current UI language.
        const availableTags = currentLanguage === 'zh_CN'
            ? allTags.map(getLocalizedTagLabel)
            : allTags;
        const result = await generateSummary(repoInfo, readmeContent, availableTags);

        // If modal was closed while waiting, abort silently
        if (signal.aborted) return;

        summaryBox.innerHTML = `<span style="color:var(--text-primary)">${result.summary}</span>`;

        // Auto-add new tags
        let currentTags = data.tags || [];
        if (result.tags && result.tags.length > 0) {
            let tagsChanged = false;
            for (const rawTag of result.tags) {
                const tag = normalizeTagForStorage(rawTag);
                if (!tag) continue;
                if (!currentTags.includes(tag)) {
                    currentTags.push(tag);
                    tagsChanged = true;
                    // Add to global tags if it's completely new
                    if (!allTags.includes(tag)) {
                        await addTag(tag);
                        allTags.push(tag);
                    }
                }
            }
            if (tagsChanged) {
                renderModalTags(currentTags);
            }
        }

        starsData[currentEditRepo] = {
            ...data,
            tags: currentTags,
            aiSummary: result.summary
        };
    } catch (err) {
        if (err.name === 'AbortError' || signal.aborted) return; // Modal closed, silently stop
        summaryBox.innerHTML = `<span style="color:var(--color-danger)">${err.message}</span>`;
    } finally {
        if (!signal.aborted) {
            btn.disabled = false;
            btn.textContent = t('popupModalAIBtn');
            currentAIController = null;
        }
    }
}

// ===== Sync =====
async function handleSync() {
    const btn = $('#btn-sync');
    btn.classList.add('syncing');
    btn.disabled = true;
    setStatus(t('msgSyncing'));

    try {
        await syncToGitHub();
        setStatus(t('msgSyncComplete'));
        setSyncStatus(t('msgLastSync', [new Date().toLocaleTimeString(document.documentElement.lang)]));
    } catch (err) {
        setStatus(t('msgError', [err.message]));
    }

    btn.classList.remove('syncing');
    btn.disabled = false;
}

// ===== Status =====
function setStatus(text) {
    $('#status-text').textContent = text;
}

function setSyncStatus(text) {
    $('#status-sync').textContent = text;
}
