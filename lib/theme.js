// ===== Theme Helpers =====

export const THEME_VALUES = new Set(['system', 'light', 'dark']);

export function normalizeTheme(theme) {
    return THEME_VALUES.has(theme) ? theme : 'system';
}

export function applyTheme(theme) {
    const normalizedTheme = normalizeTheme(theme);
    if (normalizedTheme === 'system') {
        document.documentElement.removeAttribute('data-theme');
        return;
    }
    document.documentElement.setAttribute('data-theme', normalizedTheme);
}

