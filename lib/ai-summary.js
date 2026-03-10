// ===== GitHub Stars Manager — AI Summary =====

import { getSettings } from './storage.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';


/**
 * Generate AI summary for a repo
 */
export async function generateSummary(repoInfo, readmeContent, availableTags = []) {
    const settings = await getSettings();

    const prompt = chrome.i18n.getMessage('aiSummaryPrompt', [
        availableTags.join(', ') || chrome.i18n.getMessage('aiSummaryNoTags'),
        repoInfo.fullName || repoInfo.name || '',
        repoInfo.description || chrome.i18n.getMessage('aiSummaryNoDesc'),
        (readmeContent || chrome.i18n.getMessage('aiSummaryNoReadme')).slice(0, 500)
    ]);

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
            throw new Error(chrome.i18n.getMessage('aiSummaryNoAIConfig'));
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
            summary: data.summary || chrome.i18n.getMessage('aiSummaryFail'),
            tags: Array.isArray(data.tags) ? data.tags : [],
        };
    } catch (err) {
        throw new Error(chrome.i18n.getMessage('aiSummaryFormatError', [text]));
    }
}

/**
 * Call Gemini API (free tier)
 */
async function callGemini(prompt, settings) {
    const apiKey = settings.aiApiKey;
    if (!apiKey) throw new Error(chrome.i18n.getMessage('aiSummaryGeminiNoKey'));

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
        if (err.name === 'AbortError') throw new Error(chrome.i18n.getMessage('aiSummaryTimeout'));
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || chrome.i18n.getMessage('aiSummaryGeminiError', [String(response.status)]));
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || chrome.i18n.getMessage('aiSummaryFail');
}

/**
 * Call OpenAI-compatible API
 */
async function callOpenAI(prompt, settings) {
    const apiKey = settings.aiApiKey;
    if (!apiKey) throw new Error(chrome.i18n.getMessage('aiSummaryNoAIAPIKey'));

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
        if (err.name === 'AbortError') throw new Error(chrome.i18n.getMessage('aiSummaryTimeoutCustom'));
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || chrome.i18n.getMessage('aiSummaryGeneralAPIError', [String(response.status)]));
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || chrome.i18n.getMessage('aiSummaryFail');
}

/**
 * Check if AI is configured
 */
export async function isAIConfigured() {
    const settings = await getSettings();
    return !!settings.aiApiKey;
}
