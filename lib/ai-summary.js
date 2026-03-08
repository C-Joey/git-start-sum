// ===== GitHub Stars Manager — AI Summary =====

import { getSettings } from './storage.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const SUMMARY_PROMPT = `你是一个技术项目总结助手。请返回一段 JSON 数据。
包含两个字段：
1. "summary": 用简洁的中文（1-2句话，不超过80字）总结该 GitHub 项目的用途和特点。
2. "tags": 根据项目特征，从 [候选标签] 中选择最合适的 1-3 个标签。如果都不合适，也可以自己创建最合适的英文单词标签。

候选标签: {availableTags}

项目名称: {name}
项目描述: {description}
README 前500字: 
{readme}

请仅返回合法的 JSON 对象，不要包含其他解释文本。例如：
{
  "summary": "这是一个用于...",
  "tags": ["Frontend", "React"]
}`;

/**
 * Generate AI summary for a repo
 */
export async function generateSummary(repoInfo, readmeContent, availableTags = []) {
    const settings = await getSettings();

    const prompt = SUMMARY_PROMPT
        .replace('{availableTags}', availableTags.join(', ') || '无')
        .replace('{name}', repoInfo.fullName || repoInfo.name || '')
        .replace('{description}', repoInfo.description || '无描述')
        .replace('{readme}', (readmeContent || '无 README').slice(0, 500));

    let resultMsg = '';
    switch (settings.aiProvider) {
        case 'gemini':
            resultMsg = await callGemini(prompt, settings);
            break;
        case 'openai':
        case 'custom':
            resultMsg = await callOpenAI(prompt, settings);
            break;
        default:
            throw new Error('未配置 AI 服务');
    }

    return parseJSONSummary(resultMsg);
}

function parseJSONSummary(text) {
    try {
        // Strip out markdown code blocks if the AI wrapped the JSON
        let cleanText = text.trim();
        if (cleanText.startsWith('\`\`\`json')) {
            cleanText = cleanText.substring(7);
        } else if (cleanText.startsWith('\`\`\`')) {
            cleanText = cleanText.substring(3);
        }
        if (cleanText.endsWith('\`\`\`')) {
            cleanText = cleanText.substring(0, cleanText.length - 3);
        }

        const data = JSON.parse(cleanText.trim());
        return {
            summary: data.summary || '总结生成失败',
            tags: Array.isArray(data.tags) ? data.tags : [],
        };
    } catch (err) {
        throw new Error('AI 返回的数据格式不正确（非 JSON）:\n' + text);
    }
}

/**
 * Call Gemini API (free tier)
 */
async function callGemini(prompt, settings) {
    const apiKey = settings.aiApiKey;
    if (!apiKey) throw new Error('请在设置中配置 Gemini API Key');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
        response = await fetch(
            `${GEMINI_API_BASE}/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 200,
                    },
                }),
                signal: controller.signal,
            }
        );
    } catch (err) {
        if (err.name === 'AbortError') throw new Error('请求超时（30秒），请检查网络或 API Key');
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gemini API 错误: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '总结生成失败';
}

/**
 * Call OpenAI-compatible API
 */
async function callOpenAI(prompt, settings) {
    const apiKey = settings.aiApiKey;
    if (!apiKey) throw new Error('请在设置中配置 AI API Key');

    const endpoint = settings.aiProvider === 'custom' && settings.aiCustomEndpoint
        ? settings.aiCustomEndpoint
        : 'https://api.openai.com/v1/chat/completions';

    const model = settings.aiProvider === 'custom' && settings.aiCustomModel
        ? settings.aiCustomModel
        : 'gpt-4o-mini';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 200,
            }),
            signal: controller.signal,
        });
    } catch (err) {
        if (err.name === 'AbortError') throw new Error('请求超时（30秒），请检查网络或自定义 API 地址');
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `AI API 错误: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '总结生成失败';
}

/**
 * Check if AI is configured
 */
export async function isAIConfigured() {
    const settings = await getSettings();
    return !!settings.aiApiKey;
}
