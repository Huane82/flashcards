/**
 * 🧠 FSRS 現代認知記憶演算法與混合排程引擎 (js/algorithm.js)
 */

const LEVEL_NAMES = {
    1: "Lv.1",
    2: "Lv.2",
    3: "Lv.3",
    4: "Lv.4",
    5: "Lv.5"
};

const LEVEL_COLORS = {
    1: "bg-rose-50 text-rose-700 border-rose-200",
    2: "bg-amber-50 text-amber-700 border-amber-200",
    3: "bg-blue-50 text-blue-700 border-blue-200",
    4: "bg-indigo-50 text-indigo-700 border-indigo-200",
    5: "bg-emerald-50 text-emerald-700 border-emerald-200"
};

const FSRS_CONFIG = {
    REQUEST_RETENTION: 0.90,
    DECAY: -0.5,
    FACTOR: 19 / 81,
    MAX_INTERVAL_DAYS: 365,
    LEARNING_STEP_MS: 10 * 60 * 1000,
    NEW_FOCUS_BATCH_SIZE: 6,
    W: [
        0.4072, 1.1829, 3.1262, 15.4722,
        7.2102, 0.5316, 1.0651, 0.0234,
        1.6160, 0.1544, 1.0824,
        1.9813, 0.0953, 0.2975, 2.2042,
        0.2407, 2.9466
    ]
};

const DAY_MS = 24 * 60 * 60 * 1000;

let activeNewFocusPool = [];
let recentHistoryIds = [];
window.isManualFreePractice = false;

/**
 * 🏷️ 取得等級顯示名稱與樣式
 */
function getLevelInfo(level) {
    const lv = level || 1;
    return {
        name: LEVEL_NAMES[lv] || LEVEL_NAMES[1],
        color: LEVEL_COLORS[lv] || LEVEL_COLORS[1]
    };
}

/**
 * 📊 根據記憶穩定度映射視覺等級 Lv.1 ~ Lv.5
 */
function computeLevelFromStability(card) {
    if (!card || card.state === 'new' || card.state === 'learning' || card.state === 'relearning') {
        return 1;
    }
    const s = card.stability || 0;
    if (s < 1.0) return 1;
    if (s < 3.0) return 2;
    if (s < 8.0) return 3;
    if (s < 21.0) return 4;
    return 5;
}

/**
 * 🔄 為單張卡片補齊或遷移 FSRS 記憶欄位
 */
function migrateCardFSRS(card) {
    if (!card || typeof card !== 'object') return card;

    if (typeof card.stability !== 'number' || typeof card.difficulty !== 'number' || typeof card.nextReview !== 'number') {
        const legacyLevel = card.level || 1;
        const legacyStreak = card.knowStreak || 0;
        const baseTime = typeof card.updatedAt === 'number' ? card.updatedAt : Date.now();

        const initStabilityMap = { 1: 0, 2: 1.5, 3: 4.0, 4: 10.0, 5: 24.0 };
        const s = initStabilityMap[legacyLevel] || 0;

        card.stability = s;
        card.difficulty = legacyLevel === 1 ? 5.5 : Math.max(2.5, 6.0 - legacyLevel * 0.6);
        card.lapses = typeof card.lapses === 'number' ? card.lapses : 0;
        card.reps = typeof card.reps === 'number' ? card.reps : (legacyLevel > 1 ? legacyLevel : 0);
        card.lastReview = baseTime;

        if (legacyLevel <= 1 && legacyStreak === 0 && card.reps === 0) {
            card.state = 'new';
            card.nextReview = 0;
        } else if (legacyLevel <= 1) {
            card.state = 'learning';
            card.nextReview = baseTime + FSRS_CONFIG.LEARNING_STEP_MS;
        } else {
            card.state = 'review';
            card.nextReview = baseTime + s * DAY_MS;
        }
    }

    if (typeof card.knowStreak !== 'number') card.knowStreak = 0;
    if (typeof card.level !== 'number') card.level = computeLevelFromStability(card);
    return card;
}

/**
 * 📉 計算單張卡片在「此時此刻」的可提取性 Retrievability (0 ~ 1)
 */
function calculateRetrievability(card, now = Date.now()) {
    migrateCardFSRS(card);
    if (card.state === 'new' || !card.stability || card.stability <= 0) {
        return 0;
    }
    const elapsedDays = Math.max(0, (now - (card.lastReview || now)) / DAY_MS);
    return Math.pow(1 + FSRS_CONFIG.FACTOR * (elapsedDays / card.stability), FSRS_CONFIG.DECAY);
}

/**
 * ⏱️ 根據目標保留率 (90%) 與穩定度計算最佳複習間隔天數
 */
function nextIntervalDays(stability) {
    const rawDays = (stability / FSRS_CONFIG.FACTOR) *
        (Math.pow(FSRS_CONFIG.REQUEST_RETENTION, 1 / FSRS_CONFIG.DECAY) - 1);
    return Math.min(FSRS_CONFIG.MAX_INTERVAL_DAYS, Math.max(1, rawDays));
}

function updateDifficulty(currentD, rating) {
    const W = FSRS_CONFIG.W;
    const d0Easy = W[4] - Math.exp(W[5] * 3) + 1;
    const dNext = currentD - W[6] * (rating - 3);
    const meanReverted = W[7] * d0Easy + (1 - W[7]) * dNext;
    return Math.min(10, Math.max(1, Number(meanReverted.toFixed(3))));
}

function updateRecallStability(d, s, r, rating) {
    const W = FSRS_CONFIG.W;
    const hardPenalty = rating === 2 ? W[15] : 1;
    const easyBonus = rating === 4 ? W[16] : 1;

    const growth = 1 +
        Math.exp(W[8]) *
        (11 - d) *
        Math.pow(Math.max(s, 0.1), -W[9]) *
        (Math.exp((1 - r) * W[10]) - 1) *
        hardPenalty *
        easyBonus;

    return Number((s * growth).toFixed(3));
}

function updateLapseStability(d, s, r) {
    const W = FSRS_CONFIG.W;
    const postLapseS = W[11] *
        Math.pow(d, -W[12]) *
        (Math.pow(s + 1, W[13]) - 1) *
        Math.exp((1 - r) * W[14]);

    const capped = Math.min(Math.max(postLapseS, 0.5), Math.min(Math.max(s * 0.4, 0.5), 2.5));
    return Number(capped.toFixed(3));
}

/**
 * 🏆 內部進度比對（回傳 > 0 代表 a 進度高於 b）
 */
function _compareProgress(a, b) {
    if (typeof compareCardProgress === 'function') {
        return compareCardProgress(a, b);
    }
    const aLv = a?.level || 1;
    const bLv = b?.level || 1;
    if (aLv !== bLv) return aLv - bLv;
    return (a?.stability || 0) - (b?.stability || 0);
}

/**
 * ✍️ 核心複習狀態更新器（以最高進度為基準計算，並同步升級所有字庫的同名單字）
 */
function recordCardReview(cardOrId, rating = 3, now = Date.now()) {
    if (!Array.isArray(wordList) || wordList.length === 0) return null;

    const rawCard = typeof cardOrId === 'object'
        ? cardOrId
        : wordList.find(w => w.id === cardOrId);

    if (!rawCard) return null;

    // 找出所有字庫中的同名單字，並取進度最高者作為計算基準
    const normalizedWord = (rawCard.word || '').trim().toLowerCase();
    const matchingCards = normalizedWord
        ? wordList.filter(w => (w.word || '').trim().toLowerCase() === normalizedWord)
        : [rawCard];

    let baseCard = rawCard;
    matchingCards.forEach(c => {
        migrateCardFSRS(c);
        if (_compareProgress(c, baseCard) > 0) {
            baseCard = c;
        }
    });
    migrateCardFSRS(baseCard);

    const W = FSRS_CONFIG.W;
    const prevState = baseCard.state;
    const prevS = baseCard.stability || 0;
    const prevD = baseCard.difficulty || 5.5;
    const r = calculateRetrievability(baseCard, now);

    let nextState = prevState;
    let nextS = prevS;
    let nextD = prevD;
    let nextReview = now;
    let nextLapses = baseCard.lapses || 0;
    let nextReps = (baseCard.reps || 0) + 1;
    let nextStreak = baseCard.knowStreak || 0;

    if (rating === 1) {
        nextStreak = 0;
        if (prevState === 'review') {
            nextLapses += 1;
            nextS = updateLapseStability(prevD, prevS, r);
        } else {
            nextS = W[0];
        }
        nextD = prevState === 'new'
            ? Math.min(10, Math.max(1, W[4] - Math.exp(W[5] * 0) + 1))
            : updateDifficulty(prevD, 1);
        nextState = prevState === 'new' ? 'learning' : 'relearning';
        nextReview = now + FSRS_CONFIG.LEARNING_STEP_MS;

    } else if (prevState === 'new' || prevState === 'learning' || prevState === 'relearning') {
        nextD = prevState === 'new'
            ? Math.min(10, Math.max(1, W[4] - Math.exp(W[5] * (rating - 1)) + 1))
            : updateDifficulty(prevD, rating);

        if (rating === 2) {
            nextState = prevState === 'new' ? 'learning' : prevState;
            nextS = Math.max(prevS, W[1] * 0.6);
            nextReview = now + FSRS_CONFIG.LEARNING_STEP_MS;
        } else if (rating === 3) {
            nextStreak += 1;
            if (nextStreak < 2) {
                nextState = prevState === 'new' ? 'learning' : prevState;
                nextS = Math.max(prevS, 0.6);
                nextReview = now + FSRS_CONFIG.LEARNING_STEP_MS;
            } else {
                nextState = 'review';
                nextStreak = 0;
                nextS = prevState === 'relearning' && prevS > 0
                    ? Math.max(1.0, prevS)
                    : Number((1.2 + (10 - nextD) * 0.08).toFixed(3));
                nextReview = now + nextIntervalDays(nextS) * DAY_MS;
            }
        } else if (rating === 4) {
            nextState = 'review';
            nextStreak = 0;
            nextS = 4.0;
            nextReview = now + nextIntervalDays(nextS) * DAY_MS;
        }

    } else {
        nextD = updateDifficulty(prevD, rating);
        nextS = updateRecallStability(prevD, prevS, r, rating);
        nextState = 'review';
        nextStreak = 0;
        const intervalDays = nextIntervalDays(nextS);
        nextReview = now + intervalDays * DAY_MS;
    }

    const updatedLevel = computeLevelFromStability({
        state: nextState,
        stability: nextS
    });

    // 🔗 同步升級所有字庫中的同名單字
    matchingCards.forEach(w => {
        w.state = nextState;
        w.stability = nextS;
        w.difficulty = nextD;
        w.lapses = nextLapses;
        w.reps = nextReps;
        w.knowStreak = nextStreak;
        w.level = updatedLevel;
        w.lastReview = now;
        w.nextReview = nextReview;
        w.updatedAt = now;
    });

    return baseCard;
}

/**
 * 🔮 預覽各選項的下次複習時間文字
 */
function previewNextIntervals(card, now = Date.now()) {
    if (!card) return { 1: '10 分鐘後', 2: '10 分鐘後', 3: '1 天後', 4: '4 天後' };
    migrateCardFSRS(card);

    const formatSpan = (ms) => {
        const diffMin = Math.round((ms - now) / 60000);
        if (diffMin < 60) return `${Math.max(1, diffMin)} 分鐘後`;
        const diffHours = Math.round(diffMin / 60);
        if (diffHours < 24) return `${diffHours} 小時後`;
        const diffDays = Math.round(diffHours / 24);
        return `${diffDays} 天後`;
    };

    const result = {};
    [1, 2, 3, 4].forEach(rating => {
        const clone = { ...card };
        const r = calculateRetrievability(clone, now);

        if (rating === 1) {
            result[rating] = '10 分鐘後';
        } else if (clone.state === 'new' || clone.state === 'learning' || clone.state === 'relearning') {
            if (rating === 2 || (rating === 3 && (clone.knowStreak || 0) + 1 < 2)) {
                result[rating] = '10 分鐘後';
            } else if (rating === 3) {
                const d = updateDifficulty(clone.difficulty || 5.5, 3);
                const s = clone.state === 'relearning' && clone.stability > 0
                    ? Math.max(1.0, clone.stability)
                    : 1.2 + (10 - d) * 0.08;
                result[rating] = formatSpan(now + nextIntervalDays(s) * DAY_MS);
            } else {
                result[rating] = '4 天後';
            }
        } else {
            const s = updateRecallStability(clone.difficulty || 5.5, clone.stability || 1, r, rating);
            result[rating] = formatSpan(now + nextIntervalDays(s) * DAY_MS);
        }
    });

    return result;
}

/**
 * 🔎 取得當前勾選字庫並去重後的有效單字清單（重複字只出現一次，以進度最高者為主）
 */
function getDeduplicatedActiveWords() {
    if (!wordList || wordList.length === 0) return [];

    const activeCats = window.selectedCategories || ['ALL'];
    const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : '預設字庫';

    const uniqueMap = new Map();
    for (let i = 0; i < wordList.length; i++) {
        const w = wordList[i];
        if (!w || !w.word) continue;

        const cat = w.category || defaultCatName;
        if (!activeCats.includes("ALL") && !activeCats.includes(cat)) continue;

        migrateCardFSRS(w);
        const key = w.word.trim().toLowerCase();
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, w);
        } else if (_compareProgress(w, uniqueMap.get(key)) > 0) {
            uniqueMap.set(key, w);
        }
    }

    return Array.from(uniqueMap.values());
}

/**
 * 📊 取得目前選取字庫的學習進度統計
 */
function getStudyQueueSummary(now = Date.now()) {
    const words = getDeduplicatedActiveWords();
    let dueCount = 0;
    let newCount = 0;
    let learningCount = 0;

    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (w.state === 'new') {
            newCount++;
        } else if (w.state === 'learning' || w.state === 'relearning') {
            learningCount++;
            if ((w.nextReview || 0) <= now) dueCount++;
        } else if ((w.nextReview || 0) <= now) {
            dueCount++;
        }
    }

    const autoFreePractice = words.length > 0 && dueCount === 0 && newCount === 0;

    return {
        totalCount: words.length,
        dueCount,
        newCount,
        learningCount,
        isFreePractice: Boolean(window.isManualFreePractice) || autoFreePractice,
        isManualFreePractice: Boolean(window.isManualFreePractice)
    };
}

/**
 * 🎲 依權重陣列進行加權隨機抽樣
 */
function weightedRandomPick(items) {
    if (!items || items.length === 0) return null;
    if (items.length === 1) return items[0].word;

    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) return items[Math.floor(Math.random() * items.length)].word;

    let threshold = Math.random() * totalWeight;
    for (let i = 0; i < items.length; i++) {
        if (threshold < items[i].weight) {
            return items[i].word;
        }
        threshold -= items[i].weight;
    }
    return items[items.length - 1].word;
}

/**
 * 🎯 核心抽卡排程器（支援手動/自動自由加練模式，且避免單卡無限重複）
 */
function getNextCardSpacedRepetition() {
    const filteredList = getDeduplicatedActiveWords();
    if (filteredList.length === 0) return null;
    if (filteredList.length === 1) return filteredList[0];

    const now = Date.now();
    const lastWordKey = recentHistoryIds.length > 0 ? recentHistoryIds[recentHistoryIds.length - 1] : null;

    const excludeLast = (pool) => {
        if (pool.length <= 1 || !lastWordKey) return pool;
        const withoutLast = pool.filter(w => (w.word || '').trim().toLowerCase() !== lastWordKey);
        return withoutLast.length > 0 ? withoutLast : pool;
    };

    const pickFromFreePracticePool = (pool) => {
        const candidates = excludeLast(pool);
        const weighted = candidates.map(word => {
            const r = calculateRetrievability(word, now);
            const s = Math.max(0.5, word.stability || 1);
            const lapsesBoost = 1 + (word.lapses || 0) * 0.5;
            const difficultyBoost = 0.6 + (word.difficulty || 5) / 10;
            const isUnlearnedBonus = word.state === 'new' ? 1.25 : 1.0;

            const vulnerability = ((1.05 - r) * 80 + (15 / s)) * lapsesBoost * difficultyBoost * isUnlearnedBonus;
            let weight = Math.max(vulnerability, 0.5);

            const wKey = (word.word || '').trim().toLowerCase();
            if (recentHistoryIds.includes(wKey)) {
                weight *= 0.15;
            }
            return { word, weight };
        });

        const picked = weightedRandomPick(weighted);
        recordHistoryKey((picked.word || '').trim().toLowerCase());
        return picked;
    };

    // 🔥 若已手動開啟「自由加練模式」，直接對所有去重單字加權自由練習
    if (window.isManualFreePractice) {
        return pickFromFreePracticePool(filteredList);
    }

    // =========================================================================
    // 🥇 Tier 1：到期池
    // =========================================================================
    const dueCards = filteredList.filter(w => w.state !== 'new' && (w.nextReview || 0) <= now);

    if (dueCards.length > 0) {
        const candidates = excludeLast(dueCards);
        const weighted = candidates.map(word => {
            const r = calculateRetrievability(word, now);
            const isRelearning = word.state === 'relearning' || word.state === 'learning';
            const lapsesBoost = 1 + (word.lapses || 0) * 0.45;
            const urgency = Math.pow(Math.max(0.05, 1.15 - r), 2) * 100;
            let weight = (isRelearning ? 140 : urgency) * lapsesBoost;

            const wKey = (word.word || '').trim().toLowerCase();
            if (recentHistoryIds.includes(wKey)) {
                weight *= 0.2;
            }
            return { word, weight: Math.max(weight, 0.1) };
        });

        const picked = weightedRandomPick(weighted);
        recordHistoryKey((picked.word || '').trim().toLowerCase());
        return picked;
    }

    // =========================================================================
    // 🥈 Tier 2：定量新字焦點池 ＋ 短期學習字
    // =========================================================================
    const validKeys = new Set(filteredList.map(w => (w.word || '').trim().toLowerCase()));
    activeNewFocusPool = activeNewFocusPool.filter(k => {
        if (!validKeys.has(k)) return false;
        const w = filteredList.find(item => (item.word || '').trim().toLowerCase() === k);
        return w && (w.state === 'new' || w.state === 'learning');
    });

    const unseenNewWords = filteredList.filter(w => w.state === 'new');
    for (const w of unseenNewWords) {
        if (activeNewFocusPool.length >= FSRS_CONFIG.NEW_FOCUS_BATCH_SIZE) break;
        const wKey = (w.word || '').trim().toLowerCase();
        if (!activeNewFocusPool.includes(wKey)) {
            activeNewFocusPool.push(wKey);
        }
    }

    const learningPool = filteredList.filter(w => {
        const wKey = (w.word || '').trim().toLowerCase();
        return activeNewFocusPool.includes(wKey) || w.state === 'learning' || w.state === 'relearning';
    });

    if (learningPool.length > 0) {
        // 防卡死：若只剩 1 張處於 10 分鐘冷卻期的卡片，混入其他已學卡片讓使用者可繼續自由加練
        const effectivePool = (learningPool.length === 1 && (learningPool[0].nextReview || 0) > now && filteredList.length > 1)
            ? filteredList
            : learningPool;

        const candidates = excludeLast(effectivePool);
        const weighted = candidates.map(word => {
            let weight = word.state === 'new' ? 100 : 80;
            if (word.nextReview && word.nextReview <= now + FSRS_CONFIG.LEARNING_STEP_MS) {
                const remainRatio = Math.max(0, (word.nextReview - now) / FSRS_CONFIG.LEARNING_STEP_MS);
                weight += (1 - remainRatio) * 60;
            }
            const wKey = (word.word || '').trim().toLowerCase();
            if (recentHistoryIds.includes(wKey)) {
                weight *= 0.15;
            }
            return { word, weight: Math.max(weight, 0.1) };
        });

        const picked = weightedRandomPick(weighted);
        recordHistoryKey((picked.word || '').trim().toLowerCase());
        return picked;
    }

    // =========================================================================
    // 🥉 Tier 3：自動自由加練模式
    // =========================================================================
    return pickFromFreePracticePool(filteredList);
}

function recordHistoryKey(key) {
    if (!key) return;
    recentHistoryIds.push(key);
    if (recentHistoryIds.length > 5) {
        recentHistoryIds.shift();
    }
}

/**
 * ✨ 切換「自由加練模式」
 */
function toggleFreePracticeMode(forceState) {
    window.isManualFreePractice = typeof forceState === 'boolean'
        ? forceState
        : !window.isManualFreePractice;

    if (typeof refreshFSRSUIBadges === 'function') refreshFSRSUIBadges();
    if (typeof updateStudyQueueUI === 'function') updateStudyQueueUI();

    if (typeof currentTab !== 'undefined' && currentTab === 'flashcard' && typeof nextCard === 'function') {
        nextCard(true);
    }

    if (typeof showToast === 'function') {
        showToast(
            window.isManualFreePractice
                ? '已開啟「自由加練模式」：可無限練習所有已選單字'
                : '已切回「FSRS 智慧排程模式」',
            'info'
        );
    }
}

/**
 * 🚀 從主頁直接進入自由加練模式
 */
function startFreePracticeMode() {
    window.isManualFreePractice = true;
    if (typeof startFocusMode === 'function') {
        startFocusMode('flashcard');
    }
    if (typeof showToast === 'function') {
        showToast('已進入自由加練模式！', 'info');
    }
}

function getNextCardNoRepeat() {
    return getNextCardSpacedRepetition();
}
