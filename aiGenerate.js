// ===============================================
// AI Word Generation — Google Gemini API (Free Tier)
// Uses built-in key from ai-config.js (gitignored)
// ===============================================

const MODEL = 'gemini-2.5-flash';
let _builtInKey = null;

async function getBuiltInKey() {
    if (_builtInKey !== null) return _builtInKey;
    try {
        // Keep AI key optional: avoid bundler hard-resolving a gitignored file.
        const cfgPath = './ai-config.js';
        const cfg = await import(/* @vite-ignore */ cfgPath);
        _builtInKey = (cfg.GEMINI_API_KEY || '').trim();
    } catch {
        _builtInKey = '';
    }
    return _builtInKey;
}

function buildPrompt(categoryName, count, difficulty) {
    const difficultyGuide = {
        easy: 'Use only very well-known, universally recognized items that almost anyone would know.',
        medium: 'Mix well-known items with some moderately known ones. Most people should recognize at least 70% of them.',
        hard: 'Include niche, obscure, or expert-level items that only enthusiasts or specialists would know.'
    };

    const diffText = difficultyGuide[difficulty] || difficultyGuide.medium;

    return `You are generating words for a party game called "Secret Word Imposter." In this game, every player gets the same secret word except one person (the imposter). Players take turns describing the word without saying it, and everyone tries to figure out who the imposter is.

CRITICAL: The category name describes WHAT KIND of things to list. You must generate specific EXAMPLES or MEMBERS of that category — NOT objects, equipment, or things associated with it.

For example:
- "Young Soccer Players" → list actual names of young soccer players (e.g. Jude Bellingham, Pedri, Lamine Yamal) — NOT soccer equipment
- "Fast Food Chains" → list actual chain names (e.g. McDonald's, Wendy's, Chick-fil-A) — NOT food items
- "Horror Movies" → list actual movie titles (e.g. The Shining, Get Out, Scream) — NOT scary objects
- "Fruits" → list actual fruit names (e.g. Apple, Mango, Kiwi)
- "Countries" → list actual country names (e.g. Japan, Brazil, Egypt)

Good words are ones that:
- People can describe in multiple ways without giving it away too easily
- Are concrete enough that players know what they are
- Are fun and spark interesting descriptions

Generate exactly ${count} specific examples/members for the category "${categoryName.trim()}".

Difficulty: ${difficulty.toUpperCase()} — ${diffText}

Rules:
- Return ONLY the items, one per line
- No numbering, no bullets, no dashes, no extra text or explanation
- Each item should be 1-4 words maximum (names can be longer)
- Every item must be a real, specific, recognizable example WITHIN the category
- No duplicates
- No generic or vague items like "Other" or "Misc"
- Do NOT list objects, tools, or equipment related to the category — list actual members/examples of it`;
}

function cleanWords(text) {
    return text
        .split('\n')
        .map(w => w
            .replace(/^[\d\.\-\*\•\)\]\s]+/, '')  // strip numbering/bullets
            .replace(/^["']+|["']+$/g, '')          // strip quotes
            .replace(/\(.*?\)/g, '')                // strip parenthetical notes
            .trim()
        )
        .filter(w =>
            w.length >= 2 &&
            w.length <= 40 &&
            !/^(other|misc|etc|none|n\/a)$/i.test(w)
        );
}

/**
 * Generate words for a category using Gemini API.
 * @param {string} categoryName - e.g. "Countries", "Roman Emperors"
 * @param {string} [apiKey] - optional override (uses built-in key if not provided)
 * @param {number} count - number of words to generate (default 20)
 * @param {string} [difficulty] - 'easy', 'medium', or 'hard' (default 'medium')
 * @param {string[]} [existingWords] - words already in the list to avoid duplicates
 * @returns {Promise<string[]>} array of word strings
 */
export async function generateWordsForCategory(categoryName, apiKey, count = 20, difficulty = 'medium', existingWords = []) {
    if (!categoryName?.trim()) {
        throw new Error('Please enter a category name first.');
    }
    const key = (apiKey || '').trim() || await getBuiltInKey();
    if (!key) {
        throw new Error('AI is not configured. Add ai-config.js with your Gemini API key.');
    }

    const requestCount = count + 10;
    const prompt = buildPrompt(categoryName, requestCount, difficulty);

    const existingLower = new Set((existingWords || []).map(w => w.toLowerCase()));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
            }
        })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || res.statusText;
        if (res.status === 429) throw new Error('Rate limit reached. Try again in a minute.');
        if (res.status === 400) throw new Error('Invalid API key. Check it at aistudio.google.com');
        throw new Error(msg || 'AI request failed.');
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No response from AI. Try again.');

    const allWords = cleanWords(text);

    const unique = [];
    const seen = new Set();
    for (const w of allWords) {
        const lower = w.toLowerCase();
        if (!seen.has(lower) && !existingLower.has(lower)) {
            seen.add(lower);
            unique.push(w);
        }
    }

    return unique.slice(0, count);
}
