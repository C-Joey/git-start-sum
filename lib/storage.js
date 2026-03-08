// ===== GitHub Stars Manager — Storage Layer =====

const STORAGE_KEYS = {
    STARS_DATA: 'gsm_stars_data',
    STARS_LIST_CACHE: 'gsm_stars_list_cache',
    TAGS: 'gsm_tags',
    HISTORY: 'gsm_history',
    SETTINGS: 'gsm_settings',
    LAST_SYNC: 'gsm_last_sync',
};

const DEFAULT_SETTINGS = {
    githubToken: '',
    syncRepoName: 'my-github-stars',
    syncEnabled: true,
    syncInterval: 30, // minutes
    aiProvider: 'gemini', // 'gemini' | 'openai' | 'custom'
    aiApiKey: '',
    aiCustomEndpoint: '',
    aiCustomModel: '',
    autoSummary: true,
    recordHistory: true,
};

/**
 * Get data from Chrome storage
 */
async function getStorage(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => {
            resolve(result[key] ?? null);
        });
    });
}

/**
 * Set data in Chrome storage
 */
async function setStorage(key, value) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
    });
}

// ===== Settings =====

export async function getSettings() {
    const settings = await getStorage(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(settings) {
    const current = await getSettings();
    await setStorage(STORAGE_KEYS.SETTINGS, { ...current, ...settings });
}

// ===== Stars Data =====

/**
 * Get cached GitHub stars list
 * Array of repo info from GitHub API
 */
export async function getCachedStars() {
    return (await getStorage(STORAGE_KEYS.STARS_LIST_CACHE)) || [];
}

/**
 * Save GitHub stars list to cache
 */
export async function saveCachedStars(starsList) {
    await setStorage(STORAGE_KEYS.STARS_LIST_CACHE, starsList);
}

/**
 * Get all stars data
 * Returns: { "owner/repo": { tags, note, aiSummary, starredAt, repoInfo } }
 */
export async function getStarsData() {
    return (await getStorage(STORAGE_KEYS.STARS_DATA)) || {};
}

/**
 * Get data for a single star
 */
export async function getStarData(fullName) {
    const data = await getStarsData();
    return data[fullName] || null;
}

/**
 * Save/update data for a single star
 */
export async function saveStarData(fullName, starData) {
    const data = await getStarsData();
    data[fullName] = { ...(data[fullName] || {}), ...starData };
    await setStorage(STORAGE_KEYS.STARS_DATA, data);
}

/**
 * Batch update stars data (for syncing)
 */
export async function batchUpdateStars(starsMap) {
    const data = await getStarsData();
    for (const [key, value] of Object.entries(starsMap)) {
        data[key] = { ...(data[key] || {}), ...value };
    }
    await setStorage(STORAGE_KEYS.STARS_DATA, data);
}

/**
 * Remove a star entry
 */
export async function removeStarData(fullName) {
    const data = await getStarsData();
    delete data[fullName];
    await setStorage(STORAGE_KEYS.STARS_DATA, data);
}

/**
 * Replace all stars data (for import/sync)
 */
export async function replaceAllStarsData(starsData) {
    await setStorage(STORAGE_KEYS.STARS_DATA, starsData);
}

// ===== Tags =====

export async function getTags() {
    return (await getStorage(STORAGE_KEYS.TAGS)) || [];
}

export async function saveTags(tags) {
    await setStorage(STORAGE_KEYS.TAGS, [...new Set(tags)]);
}

export async function addTag(tag) {
    const tags = await getTags();
    if (!tags.includes(tag)) {
        tags.push(tag);
        await saveTags(tags);
    }
}

export async function removeTag(tag) {
    const tags = await getTags();
    await saveTags(tags.filter(t => t !== tag));
    // Also remove this tag from all stars
    const data = await getStarsData();
    for (const key of Object.keys(data)) {
        if (data[key].tags) {
            data[key].tags = data[key].tags.filter(t => t !== tag);
        }
    }
    await setStorage(STORAGE_KEYS.STARS_DATA, data);
}

// ===== Browsing History =====

/**
 * Add a browsing history entry
 */
export async function addHistoryEntry(entry) {
    const history = await getHistory();
    // Check if already visited recently (within 5 min)
    const recent = history.find(
        h => h.repo === entry.repo &&
            (new Date(entry.visitedAt) - new Date(h.visitedAt)) < 5 * 60 * 1000
    );
    if (recent) return; // Skip duplicate

    history.unshift({
        repo: entry.repo,
        visitedAt: entry.visitedAt || new Date().toISOString(),
        title: entry.title || '',
        description: entry.description || '',
    });

    // Keep only last 1000 entries
    if (history.length > 1000) history.length = 1000;
    await setStorage(STORAGE_KEYS.HISTORY, history);
}

export async function getHistory() {
    return (await getStorage(STORAGE_KEYS.HISTORY)) || [];
}

export async function clearHistory() {
    await setStorage(STORAGE_KEYS.HISTORY, []);
}

// ===== Sync Metadata =====

export async function getLastSync() {
    return await getStorage(STORAGE_KEYS.LAST_SYNC);
}

export async function setLastSync(timestamp) {
    await setStorage(STORAGE_KEYS.LAST_SYNC, timestamp);
}

// ===== Export all data =====

export async function exportAllData() {
    const [starsData, tags, history, settings] = await Promise.all([
        getStarsData(),
        getTags(),
        getHistory(),
        getSettings(),
    ]);
    return { starsData, tags, history, settings, exportedAt: new Date().toISOString() };
}

export async function importAllData(data) {
    if (data.starsData) await setStorage(STORAGE_KEYS.STARS_DATA, data.starsData);
    if (data.tags) await setStorage(STORAGE_KEYS.TAGS, data.tags);
    if (data.history) await setStorage(STORAGE_KEYS.HISTORY, data.history);
    if (data.settings) await saveSettings(data.settings);
}
