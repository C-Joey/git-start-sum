// ===== GitHub Stars Manager — Content Script =====
// Injected into GitHub pages to add note/tag buttons

(function () {
    'use strict';

    let currentRepo = null;
    let currentLanguage = null;
    let contentMessages = null;

    function normalizeLanguage(language) {
        if (language === 'en' || language === 'zh_CN') return language;
        return 'system';
    }

    function resolveLanguage(language) {
        const normalized = normalizeLanguage(language);
        if (normalized !== 'system') return normalized;

        const uiLanguage = chrome.i18n.getUILanguage?.() || navigator.language || '';
        return uiLanguage.toLowerCase().startsWith('zh') ? 'zh_CN' : 'en';
    }

    async function loadContentMessages(language) {
        const resolvedLanguage = resolveLanguage(language);
        if (contentMessages && currentLanguage === resolvedLanguage) return;

        currentLanguage = resolvedLanguage;
        const response = await fetch(chrome.runtime.getURL(`_locales/${currentLanguage}/messages.json`));
        if (!response.ok) throw new Error(`Failed to load locale: ${currentLanguage}`);
        contentMessages = await response.json();
    }

    function t(key, substitutions = []) {
        const message = contentMessages?.[key]?.message;
        if (!message) {
            return chrome.i18n.getMessage(key, substitutions) || key;
        }

        const values = Array.isArray(substitutions) ? substitutions : [substitutions];
        let text = message;
        values.forEach((value, index) => {
            text = text.replaceAll(`$${index + 1}`, String(value));
        });
        return text;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        })[char]);
    }

    const ZH_TAG_LABELS = {
        Frontend: '前端',
        Backend: '后端',
        Tool: '工具',
        Framework: '框架',
        Automation: '自动化',
        'Chrome Extension': 'Chrome 插件',
        Collection: '收藏集',
    };

    function getLocalizedTagLabel(tag) {
        if (currentLanguage !== 'zh_CN') return String(tag ?? '');
        return ZH_TAG_LABELS[tag] || String(tag ?? '');
    }

    function normalizeTagForStorage(tag, allTags) {
        const label = String(tag ?? '').trim();
        if (!label || currentLanguage !== 'zh_CN') return label;

        const existingTag = allTags.find(existing => getLocalizedTagLabel(existing) === label);
        return existingTag || label;
    }

    function applyContentTheme(theme) {
        if (theme === 'light' || theme === 'dark') {
            document.documentElement.setAttribute('data-gsm-theme', theme);
            return;
        }
        document.documentElement.removeAttribute('data-gsm-theme');
    }

    function loadContentSettings() {
        return new Promise(resolve => {
            chrome.storage.local.get('gsm_settings', async (result) => {
                const settings = result.gsm_settings || {};
                applyContentTheme(settings.theme);
                await loadContentMessages(settings.appLanguage);
                resolve(settings);
            });
        });
    }

    function isImeComposing(event) {
        return event.isComposing || event.keyCode === 229 || event.key === 'Process';
    }

    // ===== Detect repo page =====
    function detectRepo() {
        const url = window.location.pathname;
        const parts = url.split('/').filter(Boolean);
        if (parts.length >= 2) {
            const exclude = ['settings', 'organizations', 'orgs', 'explore', 'topics', 'trending', 'notifications', 'new', 'login', 'signup', 'search', 'marketplace'];
            if (!exclude.includes(parts[0])) {
                return `${parts[0]}/${parts[1]}`;
            }
        }
        return null;
    }

    // ===== Inject UI =====
    function injectUI() {
        const repo = detectRepo();
        if (!repo || repo === currentRepo) return;
        currentRepo = repo;

        // Remove existing injected UI
        document.querySelectorAll('.gsm-injected').forEach(el => el.remove());

        // Find the Star button area
        const starButton = document.querySelector('[data-view-component="true"].btn-sm.btn');
        // Find the repo header actions area
        const repoActions = document.querySelector('.pagehead-actions') ||
            document.querySelector('ul.pagehead-actions') ||
            document.querySelector('[class*="starring-container"]')?.parentElement;

        if (!repoActions && !starButton) {
            // Try the newer GitHub UI layout
            tryInjectNewLayout(repo);
            return;
        }

        // Create our Note button
        const noteBtn = document.createElement('li');
        noteBtn.className = 'gsm-injected';
        noteBtn.innerHTML = `
      <button class="gsm-note-btn btn btn-sm" title="${t('contentBtnNoteTitle')}">
        <span class="gsm-icon">📝</span>
        <span class="gsm-label">${t('contentBtnNote')}</span>
      </button>`;

        if (repoActions) {
            repoActions.appendChild(noteBtn);
        }

        // Load existing data
        loadStarData(repo, noteBtn.querySelector('.gsm-note-btn'));

        // Click handler
        noteBtn.querySelector('.gsm-note-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showNotePanel(repo);
        });
    }

    // Try injecting in newer GitHub layout
    function tryInjectNewLayout(repo) {
        // New GitHub UI: look for the star/watch/fork area
        const actionGroup = document.querySelector('.d-flex.gap-2') ||
            document.querySelector('[class*="BorderGrid"]')?.parentElement;

        // Also try above the README
        const aboutSection = document.querySelector('[class*="about-module"]') ||
            document.querySelector('[class*="BorderGrid-cell"]');

        if (aboutSection) {
            const noteWidget = document.createElement('div');
            noteWidget.className = 'gsm-injected gsm-widget';
            noteWidget.innerHTML = `
        <div class="gsm-widget-header">
          <span class="gsm-icon">📝</span>
          <span>${t('contentWidgetTitle')}</span>
          <button class="gsm-widget-edit" title="${t('contentWidgetEdit')}">✏️</button>
        </div>
        <div class="gsm-widget-body">
          <div class="gsm-widget-note"></div>
          <div class="gsm-widget-tags"></div>
        </div>`;

            aboutSection.parentElement.insertBefore(noteWidget, aboutSection.nextSibling);

            loadStarData(repo, null, noteWidget);

            noteWidget.querySelector('.gsm-widget-edit').addEventListener('click', () => {
                showNotePanel(repo);
            });
        }
    }

    // ===== Load star data from storage =====
    function loadStarData(repo, btnEl, widgetEl) {
        chrome.runtime.sendMessage({ type: 'GET_STAR_DATA', fullName: repo }, (data) => {
            if (chrome.runtime.lastError) {
                console.warn('[GSM] Failed to load star data:', chrome.runtime.lastError.message);
                return;
            }
            if (!data) return;

            if (btnEl && (data.note || data.aiSummary)) {
                btnEl.classList.add('gsm-has-note');
                btnEl.querySelector('.gsm-label').textContent = t('contentLabelHasNote');
            }

            if (widgetEl) {
                const noteDiv = widgetEl.querySelector('.gsm-widget-note');
                const tagsDiv = widgetEl.querySelector('.gsm-widget-tags');

                if (data.note) {
                    noteDiv.textContent = data.note;
                    noteDiv.classList.add('gsm-has-content');
                } else if (data.aiSummary) {
                    noteDiv.innerHTML = `<span class="gsm-ai-badge">🤖</span> ${data.aiSummary}`;
                    noteDiv.classList.add('gsm-has-content');
                } else {
                    noteDiv.innerHTML = `<span class="gsm-placeholder">${t('contentPlaceholderNote')}</span>`;
                }

                if (data.tags && data.tags.length > 0) {
                    tagsDiv.innerHTML = data.tags.map(tag => `<span class="gsm-tag" title="${escapeHtml(tag)}">${escapeHtml(getLocalizedTagLabel(tag))}</span>`).join('');
                }
            }
        });
    }

    // ===== Note Panel (floating) =====
    function showNotePanel(repo) {
        // Remove existing panel
        document.querySelector('.gsm-panel')?.remove();

        const panel = document.createElement('div');
        panel.className = 'gsm-injected gsm-panel';
        panel.innerHTML = `
      <div class="gsm-panel-overlay"></div>
      <div class="gsm-panel-content">
        <div class="gsm-panel-header">
          <h3>📝 ${repo}</h3>
          <button class="gsm-panel-close">✕</button>
        </div>
        <div class="gsm-panel-body">
          <div class="gsm-field">
            <label>${t('contentLabelTags')}</label>
            <div class="gsm-panel-tags"></div>
            <div class="gsm-tag-input-row">
              <input type="text" class="gsm-input gsm-tag-input" placeholder="${t('contentPlaceholderAddTag')}">
              <button class="gsm-btn gsm-tag-add">${t('contentBtnAdd')}</button>
            </div>
          </div>
          <div class="gsm-field">
            <label>${t('contentLabelNote')}</label>
            <textarea class="gsm-input gsm-note-textarea" rows="3" placeholder="${t('contentPlaceholderNoteArea')}"></textarea>
          </div>
          <div class="gsm-field">
            <label>${t('contentLabelAI')}</label>
            <div class="gsm-ai-result"></div>
            <button class="gsm-btn gsm-ai-generate">${t('contentBtnAIGenerate')}</button>
          </div>
        </div>
        <div class="gsm-panel-footer">
          <button class="gsm-btn gsm-btn-primary gsm-save">${t('contentBtnSave')}</button>
        </div>
      </div>`;

        document.body.appendChild(panel);

        // Current state
        let currentTags = [];
        let currentNote = '';
        let currentAISummary = '';

        // Load existing data
        chrome.runtime.sendMessage({ type: 'GET_STAR_DATA', fullName: repo }, (data) => {
            if (chrome.runtime.lastError) {
                console.warn('[GSM] Failed to load panel data:', chrome.runtime.lastError.message);
                return;
            }
            if (data) {
                currentTags = data.tags || [];
                currentNote = data.note || '';
                currentAISummary = data.aiSummary || '';

                panel.querySelector('.gsm-note-textarea').value = currentNote;
                renderPanelTags();

                if (currentAISummary) {
                    panel.querySelector('.gsm-ai-result').textContent = currentAISummary;
                    panel.querySelector('.gsm-ai-result').classList.add('gsm-has-content');
                }
            }
        });

        function renderPanelTags() {
            const container = panel.querySelector('.gsm-panel-tags');
            container.innerHTML = currentTags.map(tag => `
        <span class="gsm-tag" title="${escapeHtml(tag)}">
          ${escapeHtml(getLocalizedTagLabel(tag))}
          <span class="gsm-tag-remove" data-tag="${escapeHtml(tag)}">✕</span>
        </span>`).join('') || `<span class="gsm-placeholder">${t('contentNoTags')}</span>`;

            container.querySelectorAll('.gsm-tag-remove').forEach(el => {
                el.addEventListener('click', () => {
                    currentTags = currentTags.filter(t => t !== el.dataset.tag);
                    renderPanelTags();
                });
            });
        }

        // Events
        panel.querySelector('.gsm-panel-close').addEventListener('click', () => panel.remove());
        panel.querySelector('.gsm-panel-overlay').addEventListener('click', () => panel.remove());

        panel.querySelector('.gsm-tag-add').addEventListener('click', () => {
            const input = panel.querySelector('.gsm-tag-input');
            const tag = input.value.trim();
            if (tag && !currentTags.includes(tag)) {
                currentTags.push(tag);
                renderPanelTags();
                input.value = '';
            }
        });

        panel.querySelector('.gsm-tag-input').addEventListener('keydown', (e) => {
            if (isImeComposing(e)) return;
            if (e.key === 'Enter') panel.querySelector('.gsm-tag-add').click();
        });

        panel.querySelector('.gsm-ai-generate').addEventListener('click', async () => {
            const btn = panel.querySelector('.gsm-ai-generate');
            const result = panel.querySelector('.gsm-ai-result');
            btn.disabled = true;
            btn.textContent = t('contentAIGeneratingBtn');
            result.textContent = t('contentAIGenerating');

            try {
                // Get fresh README content
                const readmeEl = document.querySelector('#readme article');
                const readmeContent = readmeEl ? readmeEl.textContent : '';

                // Get available tags from storage to pass to AI
                const data = await new Promise(resolve => chrome.storage.local.get('gsm_tags', resolve));
                const allTags = data.gsm_tags || [];

                const parts = repo.split('/');

                // Wrap sendMessage in a Promise with timeout
                const response = await new Promise((resolve, reject) => {
                    const timer = setTimeout(() => {
                        reject(new Error(t('contentAITimeoutFront')));
                    }, 35000);

                    chrome.runtime.sendMessage({
                        type: 'GENERATE_SUMMARY',
                        owner: parts[0],
                        repo: parts[1],
                        repoInfo: {
                            fullName: repo,
                            description: document.querySelector('meta[name="description"]')?.content || ''
                        },
                        readmeContent: readmeContent,
                        availableTags: currentLanguage === 'zh_CN'
                            ? allTags.map(getLocalizedTagLabel)
                            : allTags
                    }, (resp) => {
                        clearTimeout(timer);
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message || t('contentComError')));
                            return;
                        }
                        resolve(resp);
                    });
                });

                btn.disabled = false;
                btn.textContent = t('contentBtnAIGenerate');

                if (response?.error) {
                    result.textContent = '❌ ' + response.error;
                    return;
                }

                if (response?.summary) {
                    currentAISummary = response.summary;
                    result.textContent = response.summary;
                    result.classList.add('gsm-has-content');

                    // Check if AI suggested tags
                    if (response.tags && response.tags.length > 0) {
                        let newlyAdded = false;
                        for (const rawTag of response.tags) {
                            const tag = normalizeTagForStorage(rawTag, allTags);
                            if (!tag) continue;
                            if (!currentTags.includes(tag)) {
                                currentTags.push(tag);
                                newlyAdded = true;

                                // Add to global tags if it's completely new
                                if (!allTags.includes(tag)) {
                                    allTags.push(tag);
                                }
                            }
                        }
                        if (newlyAdded) {
                            renderPanelTags();
                            chrome.storage.local.set({ gsm_tags: allTags });
                        }
                    }
                } else {
                    result.textContent = '❌ ' + t('contentAIGenerateFail');
                }
            } catch (err) {
                btn.disabled = false;
                btn.textContent = t('contentBtnAIGenerate');
                result.textContent = '❌ ' + (err.message || t('contentAIGenerateFailGeneric'));
            }
        });

        panel.querySelector('.gsm-save').addEventListener('click', () => {
            const note = panel.querySelector('.gsm-note-textarea').value.trim();
            chrome.runtime.sendMessage({
                type: 'SAVE_STAR_DATA',
                fullName: repo,
                data: {
                    tags: currentTags,
                    note,
                    aiSummary: currentAISummary,
                },
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('[GSM] Failed to save star data:', chrome.runtime.lastError.message);
                    return;
                }
                panel.remove();
                // Refresh injected widgets
                currentRepo = null;
                injectUI();
            });
        });

        renderPanelTags();
    }

    // ===== Watch for navigation (GitHub uses PJAX/Turbo) =====
    function observeNavigation() {
        // GitHub uses Turbo for navigation
        document.addEventListener('turbo:load', () => {
            currentRepo = null;
            setTimeout(injectUI, 500);
        });

        // Fallback: MutationObserver for URL changes
        let lastUrl = location.href;
        const observer = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                currentRepo = null;
                setTimeout(injectUI, 500);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ===== Init =====
    loadContentSettings().then(() => {
        injectUI();
    }).catch((err) => {
        console.warn('[GSM] Failed to load content settings:', err);
        injectUI();
    });
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.gsm_settings) {
            const newSettings = changes.gsm_settings.newValue || {};
            const oldSettings = changes.gsm_settings.oldValue || {};
            applyContentTheme(newSettings.theme);
            if (newSettings.appLanguage !== oldSettings.appLanguage) {
                loadContentMessages(newSettings.appLanguage).then(() => {
                    currentRepo = null;
                    document.querySelectorAll('.gsm-injected').forEach(el => el.remove());
                    injectUI();
                }).catch(err => console.warn('[GSM] Failed to reload content locale:', err));
            }
        }
    });
    observeNavigation();
})();
