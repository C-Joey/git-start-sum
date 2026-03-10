// ===== GitHub Stars Manager — Content Script =====
// Injected into GitHub pages to add note/tag buttons

(function () {
    'use strict';

    let currentRepo = null;

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
      <button class="gsm-note-btn btn btn-sm" title="${chrome.i18n.getMessage('contentBtnNoteTitle')}">
        <span class="gsm-icon">📝</span>
        <span class="gsm-label">${chrome.i18n.getMessage('contentBtnNote')}</span>
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
          <span>${chrome.i18n.getMessage('contentWidgetTitle')}</span>
          <button class="gsm-widget-edit" title="${chrome.i18n.getMessage('contentWidgetEdit')}">✏️</button>
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
            if (!data) return;

            if (btnEl && (data.note || data.aiSummary)) {
                btnEl.classList.add('gsm-has-note');
                btnEl.querySelector('.gsm-label').textContent = chrome.i18n.getMessage('contentLabelHasNote');
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
                    noteDiv.innerHTML = `<span class="gsm-placeholder">${chrome.i18n.getMessage('contentPlaceholderNote')}</span>`;
                }

                if (data.tags && data.tags.length > 0) {
                    tagsDiv.innerHTML = data.tags.map(t => `<span class="gsm-tag">${t}</span>`).join('');
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
            <label>${chrome.i18n.getMessage('contentLabelTags')}</label>
            <div class="gsm-panel-tags"></div>
            <div class="gsm-tag-input-row">
              <input type="text" class="gsm-input gsm-tag-input" placeholder="${chrome.i18n.getMessage('contentPlaceholderAddTag')}">
              <button class="gsm-btn gsm-tag-add">${chrome.i18n.getMessage('contentBtnAdd')}</button>
            </div>
          </div>
          <div class="gsm-field">
            <label>${chrome.i18n.getMessage('contentLabelNote')}</label>
            <textarea class="gsm-input gsm-note-textarea" rows="3" placeholder="${chrome.i18n.getMessage('contentPlaceholderNoteArea')}"></textarea>
          </div>
          <div class="gsm-field">
            <label>${chrome.i18n.getMessage('contentLabelAI')}</label>
            <div class="gsm-ai-result"></div>
            <button class="gsm-btn gsm-ai-generate">${chrome.i18n.getMessage('contentBtnAIGenerate')}</button>
          </div>
        </div>
        <div class="gsm-panel-footer">
          <button class="gsm-btn gsm-btn-primary gsm-save">${chrome.i18n.getMessage('contentBtnSave')}</button>
        </div>
      </div>`;

        document.body.appendChild(panel);

        // Current state
        let currentTags = [];
        let currentNote = '';
        let currentAISummary = '';

        // Load existing data
        chrome.runtime.sendMessage({ type: 'GET_STAR_DATA', fullName: repo }, (data) => {
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
            container.innerHTML = currentTags.map(t => `
        <span class="gsm-tag">
          ${t}
          <span class="gsm-tag-remove" data-tag="${t}">✕</span>
        </span>`).join('') || `<span class="gsm-placeholder">${chrome.i18n.getMessage('contentNoTags')}</span>`;

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
            if (e.key === 'Enter') panel.querySelector('.gsm-tag-add').click();
        });

        panel.querySelector('.gsm-ai-generate').addEventListener('click', async () => {
            const btn = panel.querySelector('.gsm-ai-generate');
            const result = panel.querySelector('.gsm-ai-result');
            btn.disabled = true;
            btn.textContent = chrome.i18n.getMessage('contentAIGeneratingBtn');
            result.textContent = chrome.i18n.getMessage('contentAIGenerating');

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
                        reject(new Error(chrome.i18n.getMessage('contentAITimeoutFront')));
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
                        availableTags: allTags
                    }, (resp) => {
                        clearTimeout(timer);
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message || chrome.i18n.getMessage('contentComError')));
                            return;
                        }
                        resolve(resp);
                    });
                });

                btn.disabled = false;
                btn.textContent = chrome.i18n.getMessage('contentBtnAIGenerate');

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
                        for (const tag of response.tags) {
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
                    result.textContent = '❌ ' + chrome.i18n.getMessage('contentAIGenerateFail');
                }
            } catch (err) {
                btn.disabled = false;
                btn.textContent = chrome.i18n.getMessage('contentBtnAIGenerate');
                result.textContent = '❌ ' + (err.message || chrome.i18n.getMessage('contentAIGenerateFailGeneric'));
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
    injectUI();
    observeNavigation();
})();
