// ===== GitHub Stars Manager — Utility Functions =====

/**
 * Format a date string to relative time (e.g. "3天前", "2小时前")
 */
export function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  const intervals = [
    { label: '年', seconds: 31536000 },
    { label: '个月', seconds: 2592000 },
    { label: '天', seconds: 86400 },
    { label: '小时', seconds: 3600 },
    { label: '分钟', seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) return `${count}${interval.label}前`;
  }
  return '刚刚';
}

/**
 * Format numbers with K/M suffix
 */
export function formatCount(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

/**
 * Debounce function
 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Simple hash for generating consistent tag colors
 */
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Get a consistent color class for a tag name
 */
const TAG_COLORS = ['tag-blue', 'tag-green', 'tag-purple', 'tag-orange', 'tag-red', 'tag-pink', 'tag-cyan'];
export function getTagColor(tagName) {
  return TAG_COLORS[hashString(tagName) % TAG_COLORS.length];
}

/**
 * Parse a GitHub URL to extract owner/repo
 */
export function parseGitHubUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Truncate text to max length
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text || '';
  return text.slice(0, maxLength) + '...';
}

/**
 * Create DOM element with attributes
 */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') el.className = value;
    else if (key === 'textContent') el.textContent = value;
    else if (key === 'innerHTML') el.innerHTML = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value);
  }
  for (const child of children) {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child) el.appendChild(child);
  }
  return el;
}

/**
 * Show a toast notification
 */
export function showToast(message, type = 'info', duration = 3000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = createElement('div', {
    className: `toast toast-${type}`,
    textContent: message,
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Generate language color badge (matching GitHub's language colors)
 */
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584',
  'C++': '#f34b7d', C: '#555555', 'C#': '#178600',
  Ruby: '#701516', PHP: '#4F5D95', Swift: '#F05138',
  Kotlin: '#A97BFF', Dart: '#00B4AB', Vue: '#41b883',
  HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051',
  Lua: '#000080', Zig: '#ec915c', Elixir: '#6e4a7e',
};

export function getLangColor(language) {
  return LANG_COLORS[language] || '#8b949e';
}
