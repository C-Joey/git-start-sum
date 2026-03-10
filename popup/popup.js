// ===== GitHub Stars Manager — Popup Main =====

import { getSettings, saveSettings, getStarsData, saveStarData, getTags, saveTags, addTag, removeTag, getHistory, getCachedStars, saveCachedStars } from '../lib/storage.js';
import { getAllStarredRepos, getRepoReadme } from '../lib/github-api.js';
import { generateSummary, isAIConfigured } from '../lib/ai-summary.js';
import { syncToGitHub } from '../lib/sync.js';
import { timeAgo, formatCount, getTagColor, debounce, getLangColor, truncateText } from '../lib/utils.js';

// ===== State =====
let allStars = [];        // Array of repo info from GitHub API
let starsData = {};       // Our local metadata (tags, notes, etc.)
let allTags = [];
let historyData = [];
let activeTagFilter = null;
let currentEditRepo = null;
let currentAIController = null; // AbortController for in-flight AI request

// ===== DOM References =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
    localizeHtmlPage();
    const settings = await getSettings();

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


// ===== Setup =====
function showSetupScreen() {
    $('#setup-screen').classList.remove('hidden');
    $('#main-content').classList.add('hidden');
}

function showMainContent() {
    $('#setup-screen').classList.add('hidden');
    $('#main-content').classList.remove('hidden');
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
                searchInput.placeholder = chrome.i18n.getMessage('popupSearchPlaceholder');
                searchInput.value = '';
            } else if (tabName === 'history') {
                $('.search-bar').classList.remove('hidden');
                $('#tag-filter-bar').classList.add('hidden');
                searchInput.placeholder = chrome.i18n.getMessage('popupHistorySearchPlaceholder');
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

    // Search
    $('#search-input').addEventListener('input', debounce((e) => {
        const activeTab = document.querySelector('.tab.active').dataset.tab;
        if (activeTab === 'stars') {
            renderStars(e.target.value);
        } else if (activeTab === 'history') {
            renderHistory(e.target.value);
        }
    }, 200));

    // Sync
    $('#btn-sync').addEventListener('click', handleSync);

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
        const list = $('#modal-tag-autocomplete');
        if (e.key === 'Enter' && !list.classList.contains('hidden') && list.querySelector('.selected')) {
            return;
        }
        if (e.key === 'Enter') handleModalAddTag();
    });

    // Tag Manager
    $('#btn-add-tag').addEventListener('click', handleAddTag);
    $('#new-tag-input').addEventListener('keydown', (e) => {
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
        const query = input.value.trim().toLowerCase();
        const existingTags = getExistingTags ? getExistingTags() : [];
        const availableTags = allTags.filter(t => !existingTags.includes(t));

        let matches = availableTags;
        if (query) {
            matches = availableTags.filter(t => t.toLowerCase().includes(query));
        }

        if (matches.length === 0) {
            list.classList.add('hidden');
            return;
        }

        list.innerHTML = matches.map((t, i) => `
            <li class="autocomplete-item ${i === selectedIndex ? 'selected' : ''}" data-tag="${t}">${t}</li>
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
    setStatus(chrome.i18n.getMessage('msgLoadingCache'));

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
            allTags = ['Frontend', 'Backend', 'AI', 'Tool', 'Web3', 'Framework'];
            await saveTags(allTags);
        }

        // Render instantly from cache if available
        if (allStars && allStars.length > 0) {
            renderStars();
            renderTagFilterBar();
            setStatus(chrome.i18n.getMessage('msgLoadedCache', [allStars.length.toString()]));
            $('#stars-stats').classList.remove('hidden');
            $('#stars-stats').textContent = chrome.i18n.getMessage('msgStarsStats', [allStars.length.toString(), allTags.length.toString()]);
        }

        // Fetch stars from GitHub API in the background
        const freshStars = await getAllStarredRepos((count) => {
            if (!allStars || allStars.length === 0) {
                setStatus(chrome.i18n.getMessage('msgFirstLoad', [count.toString()]));
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

        setStatus(chrome.i18n.getMessage('msgSyncDone', [allStars.length.toString()]));
        $('#stars-stats').classList.remove('hidden');
        $('#stars-stats').textContent = chrome.i18n.getMessage('msgStarsStats', [allStars.length.toString(), allTags.length.toString()]);
    } catch (err) {
        setStatus(chrome.i18n.getMessage('msgError', [err.message]));
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
    const query = searchQuery.toLowerCase().trim();

    let filtered = allStars;

    // Filter by search
    if (query) {
        filtered = filtered.filter(star => {
            const data = starsData[star.fullName] || {};
            return star.fullName.toLowerCase().includes(query) ||
                (star.description || '').toLowerCase().includes(query) ||
                (data.note || '').toLowerCase().includes(query) ||
                (data.aiSummary || '').toLowerCase().includes(query) ||
                (star.topics || []).some(t => t.includes(query));
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
        <p class="empty-state-text">${query ? chrome.i18n.getMessage('msgNoSearchMatch') : chrome.i18n.getMessage('msgNoStars')}</p>
      </div>`;
        return;
    }

    list.innerHTML = filtered.map((star, i) => {
        const data = starsData[star.fullName] || {};
        const tags = data.tags || [];
        const notePreview = data.note || data.aiSummary || '';

        return `
      <div class="star-item" data-repo="${star.fullName}" style="animation-delay:${Math.min(i * 30, 300)}ms">
        <img class="star-avatar" src="${star.ownerAvatar}" alt="${star.owner}" loading="lazy">
        <div class="star-info">
          <div class="star-name">
            <a href="${star.url}" target="_blank" title="${star.fullName}">${star.fullName}</a>
            ${star.isArchived ? `<span class="tag tag-orange" style="font-size:9px">${chrome.i18n.getMessage('msgArchived')}</span>` : ''}
          </div>
          <div class="star-desc">${star.description || ''}</div>
          ${notePreview ? `<div class="star-note-preview">${data.note ? '📝' : '🤖'} ${truncateText(notePreview, 60)}</div>` : ''}
          <div class="star-meta">
            ${star.language ? `<span class="star-lang"><span class="lang-dot" style="background:${getLangColor(star.language)}"></span>${star.language}</span>` : ''}
            <span>⭐ ${formatCount(star.stars)}</span>
            <span>${timeAgo(star.starredAt)}</span>
          </div>
          ${tags.length > 0 ? `<div class="star-tags">${tags.map(t => `<span class="tag ${getTagColor(t)}" style="font-size:10px">${t}</span>`).join('')}</div>` : ''}
        </div>
        <div class="star-actions">
          <button class="star-edit-btn" data-repo="${star.fullName}" title="${chrome.i18n.getMessage('msgEditNoteTags')}">📝</button>
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

    bar.innerHTML = `
    <span class="tag tag-filter ${!activeTagFilter ? 'active' : ''}" data-tag="">${chrome.i18n.getMessage('msgFilterAll')}</span>
    ${allTags.map(t => `<span class="tag tag-filter ${getTagColor(t)} ${activeTagFilter === t ? 'active' : ''}" data-tag="${t}">${t} (${tagCounts[t] || 0})</span>`).join('')}
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
    const query = searchQuery.toLowerCase().trim();

    let filtered = historyData;
    if (query) {
        filtered = filtered.filter(entry =>
            entry.repo.toLowerCase().includes(query) ||
            (entry.title || '').toLowerCase().includes(query) ||
            (entry.description || '').toLowerCase().includes(query)
        );
    }

    if (filtered.length === 0) {
        list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <p class="empty-state-text">${query ? chrome.i18n.getMessage('msgNoSearchMatch') : chrome.i18n.getMessage('popupEmptyHistory')}</p>
        ${!query ? `<p class="text-xs text-secondary" style="margin-top:8px">${chrome.i18n.getMessage('popupEmptyHistoryDesc')}</p>` : ''}
      </div>`;
        return;
    }

    // Group by date
    const byDate = {};
    for (const entry of filtered) {
        const date = new Date(entry.visitedAt).toLocaleDateString('zh-CN');
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(entry);
    }

    let html = '';
    for (const [date, entries] of Object.entries(byDate)) {
        html += `<div class="history-date">${date}</div>`;
        for (const entry of entries) {
            const time = new Date(entry.visitedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
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
        list.innerHTML = `<p class="text-secondary text-sm">${chrome.i18n.getMessage('msgNoTags')}</p>`;
        return;
    }

    list.innerHTML = allTags.map(t => `
    <div class="tag-item">
      <span class="tag ${getTagColor(t)}">${t}</span>
      <span class="tag-count">${tagCounts[t] || 0}</span>
      <span class="tag-delete" data-tag="${t}" title="${chrome.i18n.getMessage('popupBtnDeleteTag')}">✕</span>
    </div>
  `).join('');

    list.querySelectorAll('.tag-delete').forEach(el => {
        el.addEventListener('click', async () => {
            if (confirm(chrome.i18n.getMessage('msgConfirmDeleteTag', [el.dataset.tag]))) {
                await removeTag(el.dataset.tag);
                allTags = await getTags();
                starsData = await getStarsData();
                renderTagManager();
                renderTagFilterBar();
            }
        });
    });
}

async function handleAddTag() {
    const input = $('#new-tag-input');
    const tag = input.value.trim();
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
        : `<span class="text-secondary text-sm">${chrome.i18n.getMessage('popupModalAIPromptFull')}</span>`;

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
    btn.textContent = chrome.i18n.getMessage('popupModalAIBtn');

    $('#note-modal').classList.add('hidden');
    currentEditRepo = null;
}

function renderModalTags(tags) {
    const container = $('#modal-tags');
    container.innerHTML = tags.map(t => `
        <span class="tag ${getTagColor(t)}">
            ${t}
            <span class="tag-remove" data-tag="${t}">✕</span>
        </span>
    `).join('') || `<span class="text-secondary text-xs">${chrome.i18n.getMessage('msgEmptyTags')}</span>`;

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
    const tag = input.value.trim();
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
    setStatus(chrome.i18n.getMessage('msgSaved'));
}

async function handleAISummary() {
    if (!currentEditRepo) return;

    // Check if AI is configured first
    const configured = await isAIConfigured();
    if (!configured) {
        const summaryBox = $('#modal-ai-summary');
        summaryBox.innerHTML = `<span style="color:var(--color-danger)">${chrome.i18n.getMessage('msgAIConfigWarning')} <a href="#" id="go-settings-link" style="color:var(--color-accent);text-decoration:underline;margin:0 4px;">${chrome.i18n.getMessage('msgSettingsInMessage')}</a></span>`;
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
    btn.textContent = chrome.i18n.getMessage('msgAIGenerating');
    summaryBox.innerHTML = '<div class="spinner" style="width:16px;height:16px;"></div>';

    try {
        const data = starsData[currentEditRepo] || {};
        const repoInfo = data.repoInfo || {};

        // Fetch real README content via GitHub API
        const [owner, repo] = currentEditRepo.split('/');
        const readmeContent = await getRepoReadme(owner, repo);

        // Pass allTags so AI can try to use existing tags
        const result = await generateSummary(repoInfo, readmeContent, allTags);

        // If modal was closed while waiting, abort silently
        if (signal.aborted) return;

        summaryBox.innerHTML = `<span style="color:var(--text-primary)">${result.summary}</span>`;

        // Auto-add new tags
        let currentTags = data.tags || [];
        if (result.tags && result.tags.length > 0) {
            let tagsChanged = false;
            for (const tag of result.tags) {
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
            btn.textContent = chrome.i18n.getMessage('popupModalAIBtn');
            currentAIController = null;
        }
    }
}

// ===== Sync =====
async function handleSync() {
    const btn = $('#btn-sync');
    btn.classList.add('syncing');
    btn.disabled = true;
    setStatus(chrome.i18n.getMessage('msgSyncing'));

    try {
        await syncToGitHub();
        setStatus(chrome.i18n.getMessage('msgSyncComplete'));
        setSyncStatus(chrome.i18n.getMessage('msgLastSync', [new Date().toLocaleTimeString(chrome.i18n.getUILanguage())]));
    } catch (err) {
        setStatus(chrome.i18n.getMessage('msgError', [err.message]));
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
