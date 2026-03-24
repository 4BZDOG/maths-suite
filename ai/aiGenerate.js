// =============================================================
// ai/aiGenerate.js — AI word + clue generation (BYOK)
// =============================================================
// Security: API keys are NEVER sent to any server other than
// the chosen AI provider. All requests go browser → provider.
// Keys are stored in localStorage (user-controlled device only).
// =============================================================

export const AI_PROVIDERS = [
    {
        id: 'google',
        name: 'Google Gemini',
        badge: 'Free tier',
        models: [
            { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (fastest)', default: true },
            { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
            { id: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro (premium)' },
        ],
        keyPlaceholder: 'AIza...',
        keyHint: 'Get a free key at aistudio.google.com',
        keyLink: 'https://aistudio.google.com/app/apikey',
    },
    {
        id: 'groq',
        name: 'Groq',
        badge: 'Free tier',
        models: [
            { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B Instant (fastest)', default: true },
            { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
            { id: 'openai/gpt-oss-20b',      label: 'GPT OSS 20B (agentic)' },
            { id: 'openai/gpt-oss-120b',     label: 'GPT OSS 120B (agentic, slower)' },
        ],
        keyPlaceholder: 'gsk_...',
        keyHint: 'Get a free key at console.groq.com',
        keyLink: 'https://console.groq.com/keys',
    },
    {
        id: 'openai',
        name: 'OpenAI',
        badge: 'Paid',
        models: [
            { id: 'gpt-4o-mini', label: 'GPT-4o Mini (fastest)', default: true },
            { id: 'gpt-4o',      label: 'GPT-4o (premium)' },
        ],
        keyPlaceholder: 'sk-...',
        keyHint: 'Get a key at platform.openai.com',
        keyLink: 'https://platform.openai.com/api-keys',
    },
    {
        id: 'anthropic',
        name: 'Anthropic Claude',
        badge: 'Paid',
        models: [
            { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku (fastest)', default: true },
            { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet (premium)' },
        ],
        keyPlaceholder: 'sk-ant-...',
        keyHint: 'Get a key at console.anthropic.com',
        keyLink: 'https://console.anthropic.com/settings/keys',
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        badge: 'Free + Paid',
        models: [
            { id: 'meta-llama/llama-3.3-70b-instruct:free',        label: 'Llama 3.3 70B (free)', default: true },
            { id: 'openai/gpt-oss-120b:free',                      label: 'GPT OSS 120B (free, slower)' },
            { id: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'Mistral Small 3.1 24B (free, fast)' },
            { id: 'anthropic/claude-haiku-4-5',                    label: 'Claude Haiku (paid)' },
        ],
        keyPlaceholder: 'sk-or-...',
        keyHint: 'Get a free key at openrouter.ai',
        keyLink: 'https://openrouter.ai/keys',
    },
];

// Local-storage key for persisted API keys (one per provider)
const LS_KEYS_KEY = 'puzzleSuiteAIKeys';

export function loadSavedKeys() {
    try { return JSON.parse(localStorage.getItem(LS_KEYS_KEY) || '{}'); }
    catch { return {}; }
}

export function saveKey(providerId, key) {
    const saved = loadSavedKeys();
    if (key) saved[providerId] = key;
    else delete saved[providerId];
    localStorage.setItem(LS_KEYS_KEY, JSON.stringify(saved));
}

// ---- Prompt builder ------------------------------------------
function buildPrompt(topic, gradeLevel, subject, difficulty, count) {
    return `You are a curriculum specialist. Generate exactly ${count} vocabulary words for a ${gradeLevel} ${subject} lesson about: "${topic}".

Rules for words:
- Single words only (no phrases), ALL CAPS
- 3 to 15 letters, appropriate for ${gradeLevel} students
- Difficulty level: ${difficulty}
- No duplicates

Rules for definitions:
- 5 to 15 words each, clear and grade-appropriate
- Do NOT use the word itself in its definition
- Define what the word MEANS, not how it is used

Return ONLY a valid JSON array with no extra text, no markdown fences:
[{"word": "EXAMPLE", "clue": "The definition goes here"}, ...]`;
}

// ---- Provider fetch functions --------------------------------

const AI_TIMEOUT_MS = 30000;

async function _fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function fetchGoogle(apiKey, modelId, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const res = await _fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function fetchGroq(apiKey, modelId, prompt) {
    const res = await _fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 2048,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}

async function fetchOpenAI(apiKey, modelId, prompt) {
    const res = await _fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 2048,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}

async function fetchAnthropic(apiKey, modelId, prompt) {
    const res = await _fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-allow-browser': 'true',
        },
        body: JSON.stringify({
            model: modelId,
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }],
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text || '';
}

async function fetchOpenRouter(apiKey, modelId, prompt) {
    const res = await _fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Puzzle Suite',
        },
        body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 2048,
            provider: { allow_fallbacks: true },
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || `HTTP ${res.status}`;
        const meta = err?.error?.metadata?.raw || err?.error?.metadata?.provider_name || '';
        throw new Error(meta ? `${msg} — ${meta}` : msg);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}

// ---- Response parser -----------------------------------------
function parseResponse(text) {
    // Strip markdown code fences if present
    let clean = text.trim();
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    // Find JSON array bounds robustly
    const start = clean.indexOf('[');
    const end   = clean.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array found in response.');
    clean = clean.slice(start, end + 1);

    const arr = JSON.parse(clean);
    if (!Array.isArray(arr)) throw new Error('Response is not an array.');

    return arr
        .filter(item => item && typeof item.word === 'string' && typeof item.clue === 'string')
        .map(item => ({
            word: item.word.trim().toUpperCase().replace(/[^A-Z]/g, ''),
            clue: item.clue.trim(),
        }))
        .filter(item => item.word.length >= 2 && item.clue.length > 0);
}

// ---- Main entry point ----------------------------------------
/**
 * Generate vocabulary words using the chosen AI provider.
 * @param {Object} opts
 * @param {string} opts.providerId  - 'google' | 'groq' | 'openai' | 'anthropic' | 'openrouter'
 * @param {string} opts.modelId     - model id string
 * @param {string} opts.apiKey      - user's API key
 * @param {string} opts.topic       - lesson topic / context
 * @param {string} opts.gradeLevel  - e.g. '5th grade'
 * @param {string} opts.subject     - e.g. 'Science'
 * @param {string} opts.difficulty  - 'easy' | 'medium' | 'hard'
 * @param {number} opts.count       - number of words to generate
 * @returns {Promise<Array<{word:string, clue:string}>>}
 */
export async function generateWords(opts) {
    const { providerId, modelId, apiKey, topic, gradeLevel, subject, difficulty, count } = opts;

    if (!apiKey?.trim()) throw new Error('Please enter your API key.');
    if (!topic?.trim())  throw new Error('Please enter a topic or context.');

    const prompt = buildPrompt(topic, gradeLevel, subject, difficulty, count);

    let rawText;
    switch (providerId) {
        case 'google':      rawText = await fetchGoogle(apiKey, modelId, prompt);      break;
        case 'groq':        rawText = await fetchGroq(apiKey, modelId, prompt);        break;
        case 'openai':      rawText = await fetchOpenAI(apiKey, modelId, prompt);      break;
        case 'anthropic':   rawText = await fetchAnthropic(apiKey, modelId, prompt);   break;
        case 'openrouter':  rawText = await fetchOpenRouter(apiKey, modelId, prompt);  break;
        default: throw new Error(`Unknown provider: ${providerId}`);
    }

    return parseResponse(rawText);
}
