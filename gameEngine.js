// Shared game engine helpers.
// These functions are framework-agnostic so both legacy and React flows
// can use the same game logic during migration.

function cryptoRandom(cryptoObj) {
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
        const randomBuffer = new Uint32Array(1);
        cryptoObj.getRandomValues(randomBuffer);
        return randomBuffer[0] / 4294967296;
    }
    return Math.random();
}

function normalizeCount(value, min = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.max(min, Math.floor(parsed));
}

export function getRandomInt(min, max, rng = Math.random) {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (hi < lo) return lo;
    return Math.floor(rng() * (hi - lo + 1)) + lo;
}

export function secureShuffle(array, cryptoObj = globalThis.crypto) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(cryptoRandom(cryptoObj) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function getRandomWord(categoryKey, categories, customCategories = [], rng = Math.random) {
    if (typeof categoryKey === 'string' && categoryKey.startsWith('custom:')) {
        const cat = customCategories.find((entry) => `custom:${entry.id}` === categoryKey);
        if (cat && Array.isArray(cat.words) && cat.words.length > 0) {
            return cat.words[getRandomInt(0, cat.words.length - 1, rng)];
        }
        return 'Mystery';
    }

    const words = categories?.[categoryKey]?.words;
    if (!Array.isArray(words) || words.length === 0) {
        return 'Mystery';
    }
    return words[getRandomInt(0, words.length - 1, rng)];
}

function getQuestionPair(categoryKey, questionCategories, getRandomQuestion, rng = Math.random) {
    if (typeof getRandomQuestion === 'function') {
        return getRandomQuestion(categoryKey);
    }

    const questions = questionCategories?.[categoryKey]?.questions;
    if (!Array.isArray(questions) || questions.length === 0) return null;
    const idx = getRandomInt(0, questions.length - 1, rng);
    return questions[idx] ?? null;
}

export function createLocalRound({
    gameType,
    selectedCategory,
    players,
    imposterCount,
    categories,
    questionCategories,
    customCategories,
    getRandomQuestion,
    rng = Math.random,
    cryptoObj = globalThis.crypto
}) {
    const playerList = Array.isArray(players) ? players : [];
    const normalizedImposters = normalizeCount(imposterCount, 1);

    let secretWord = null;
    let secretQuestion = null;
    let playerAnswers = [];

    if (gameType === 'word') {
        secretWord = getRandomWord(selectedCategory, categories, customCategories, rng);
    } else if (gameType === 'question' && typeof selectedCategory === 'string' && selectedCategory.startsWith('q:')) {
        const qKey = selectedCategory.slice(2);
        const pair = getQuestionPair(qKey, questionCategories, getRandomQuestion, rng);
        if (pair) {
            secretQuestion = pair;
            playerAnswers = new Array(playerList.length).fill(null);
        }
    }

    const playerIndices = playerList.map((_, index) => index);
    const shuffledIndices = secureShuffle(playerIndices, cryptoObj);
    const imposterIndices = shuffledIndices.slice(0, normalizedImposters);

    return {
        secretWord,
        secretQuestion,
        playerAnswers,
        imposterIndices,
        currentRevealIndex: 0,
        isRevealed: false
    };
}
