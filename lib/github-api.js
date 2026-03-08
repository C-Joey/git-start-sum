// ===== GitHub Stars Manager — GitHub API =====

import { getSettings } from './storage.js';

/**
 * Make an authenticated GitHub API request
 */
async function apiRequest(path, options = {}) {
    const settings = await getSettings();
    if (!settings.githubToken) {
        throw new Error('请先配置 GitHub Token');
    }

    const apiBase = settings.githubApiBase ? settings.githubApiBase.replace(/\/+$/, '') : 'https://api.github.com';
    const url = path.startsWith('http') ? path : `${apiBase}${path}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${settings.githubToken}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...options.headers,
        },
    });

    if (response.status === 403) {
        const remaining = response.headers.get('x-ratelimit-remaining');
        if (remaining === '0') {
            const resetTime = new Date(response.headers.get('x-ratelimit-reset') * 1000);
            throw new Error(`GitHub API 速率限制，将在 ${resetTime.toLocaleTimeString()} 重置`);
        }
    }

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `GitHub API 错误: ${response.status}`);
    }

    // Handle 204 No Content (e.g. star/unstar)
    if (response.status === 204) return null;

    return response.json();
}

// ===== User =====

export async function getCurrentUser() {
    return apiRequest('/user');
}

// ===== Stars =====

/**
 * Get all starred repos (handles pagination automatically)
 */
export async function getAllStarredRepos(onProgress) {
    const allRepos = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const repos = await apiRequest(
            `/user/starred?per_page=${perPage}&page=${page}&sort=created&direction=desc`,
            {
                headers: { 'Accept': 'application/vnd.github.star+json' },
            }
        );

        if (!repos || repos.length === 0) break;

        // star+json format includes starred_at
        const mapped = repos.map(item => ({
            fullName: item.repo.full_name,
            name: item.repo.name,
            owner: item.repo.owner.login,
            ownerAvatar: item.repo.owner.avatar_url,
            description: item.repo.description || '',
            language: item.repo.language,
            stars: item.repo.stargazers_count,
            forks: item.repo.forks_count,
            url: item.repo.html_url,
            homepage: item.repo.homepage,
            topics: item.repo.topics || [],
            starredAt: item.starred_at,
            updatedAt: item.repo.updated_at,
            isArchived: item.repo.archived,
            license: item.repo.license?.spdx_id || null,
        }));

        allRepos.push(...mapped);
        if (onProgress) onProgress(allRepos.length);
        if (repos.length < perPage) break;
        page++;
    }

    return allRepos;
}

/**
 * Check if a repo is starred
 */
export async function isRepoStarred(owner, repo) {
    try {
        await apiRequest(`/user/starred/${owner}/${repo}`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Star a repo
 */
export async function starRepo(owner, repo) {
    await apiRequest(`/user/starred/${owner}/${repo}`, { method: 'PUT' });
}

/**
 * Unstar a repo
 */
export async function unstarRepo(owner, repo) {
    await apiRequest(`/user/starred/${owner}/${repo}`, { method: 'DELETE' });
}

/**
 * Get repo README content
 */
export async function getRepoReadme(owner, repo) {
    try {
        const data = await apiRequest(`/repos/${owner}/${repo}/readme`);
        // Content is base64 encoded
        const content = atob(data.content);
        // Decode UTF-8
        const bytes = new Uint8Array(content.split('').map(c => c.charCodeAt(0)));
        return new TextDecoder().decode(bytes);
    } catch {
        return null;
    }
}

// ===== Repo Sync (for data storage) =====

/**
 * Create a private repository for storing data
 */
export async function createSyncRepo(repoName) {
    return apiRequest('/user/repos', {
        method: 'POST',
        body: JSON.stringify({
            name: repoName,
            description: '⭐ My GitHub Stars — managed by GitHub Stars Manager',
            private: true,
            auto_init: true,
        }),
    });
}

/**
 * Check if sync repo exists
 */
export async function checkSyncRepo(repoName) {
    try {
        const user = await getCurrentUser();
        await apiRequest(`/repos/${user.login}/${repoName}`);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get file content from sync repo
 */
export async function getRepoFile(repoName, path) {
    try {
        const user = await getCurrentUser();
        const data = await apiRequest(`/repos/${user.login}/${repoName}/contents/${path}`);
        const content = atob(data.content.replace(/\n/g, ''));
        const bytes = new Uint8Array(content.split('').map(c => c.charCodeAt(0)));
        return {
            content: new TextDecoder().decode(bytes),
            sha: data.sha,
        };
    } catch {
        return null;
    }
}

/**
 * Create or update a file in sync repo
 */
export async function putRepoFile(repoName, path, content, message, sha) {
    const user = await getCurrentUser();
    const encoded = btoa(unescape(encodeURIComponent(content)));
    const body = {
        message,
        content: encoded,
    };
    if (sha) body.sha = sha;

    return apiRequest(`/repos/${user.login}/${repoName}/contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

// ===== Gist (for sharing) =====

/**
 * Create a public gist for sharing
 */
export async function createGist(description, filename, content) {
    return apiRequest('/gists', {
        method: 'POST',
        body: JSON.stringify({
            description,
            public: true,
            files: {
                [filename]: { content },
            },
        }),
    });
}
