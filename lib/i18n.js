// ===== GitHub Stars Manager — Runtime i18n =====

const SUPPORTED_LANGUAGES = ['en', 'zh_CN'];
let activeLanguage = null;
let messages = null;

export function normalizeLanguage(language) {
    if (language === 'en' || language === 'zh_CN') return language;
    return 'system';
}

export function resolveLanguage(language) {
    const normalized = normalizeLanguage(language);
    if (normalized !== 'system') return normalized;

    const uiLanguage = chrome.i18n.getUILanguage?.() || navigator.language || '';
    return uiLanguage.toLowerCase().startsWith('zh') ? 'zh_CN' : 'en';
}

async function loadMessages(language) {
    const response = await fetch(chrome.runtime.getURL(`_locales/${language}/messages.json`));
    if (!response.ok) {
        throw new Error(`Failed to load locale: ${language}`);
    }
    return response.json();
}

export async function initI18n(language) {
    const resolvedLanguage = resolveLanguage(language);
    if (messages && activeLanguage === resolvedLanguage) {
        return activeLanguage;
    }

    activeLanguage = SUPPORTED_LANGUAGES.includes(resolvedLanguage) ? resolvedLanguage : 'en';
    messages = await loadMessages(activeLanguage);
    document.documentElement.lang = activeLanguage === 'zh_CN' ? 'zh-CN' : 'en';
    return activeLanguage;
}

export function t(key, substitutions = []) {
    const message = messages?.[key]?.message;
    if (!message) {
        return chrome.i18n.getMessage(key, substitutions) || key;
    }

    const values = Array.isArray(substitutions) ? substitutions : [substitutions];
    let text = message;
    values.forEach((value, index) => {
        text = text.replaceAll(`$${index + 1}`, String(value));
    });

    const placeholders = messages[key]?.placeholders || {};
    Object.entries(placeholders).forEach(([name, config]) => {
        const content = config.content || '';
        const match = content.match(/^\$(\d+)$/);
        if (!match) return;
        const value = values[Number(match[1]) - 1] ?? '';
        text = text.replaceAll(`$${name.toUpperCase()}$`, String(value));
        text = text.replaceAll(`$${name}$`, String(value));
    });

    return text;
}

export function localizeDocument(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.getAttribute('data-i18n-title'));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
}
