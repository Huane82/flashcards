/**
 * 🧠 FSRS 現代認知記憶演算法與混合排程引擎 (js/algorithm.js)
 * 結合 FSRS-4.5 DSR 模型（難度 Difficulty / 穩定度 Stability / 可提取性 Retrievability）
 * 與「到期優先 + 定量新字 + 自由加練」三層佇列架構
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

// 📐 FSRS-4.5 核心常數與預設權重（目標保留率 90%）
const FSRS_CONFIG = {
    REQUEST_RETENTION: 0.90,
    DECAY: -0.5,
    FACTOR: 19 / 81, // 當 t = S 時，R = (1 + 19/81)^(-0.5) = 0.90
    MAX_INTERVAL_DAYS: 365,
    LEARNING_STEP_MS: 10 * 60 * 1000, // 新字 / 遺忘字的短期鞏固間隔：10 分鐘
    NEW_FOCUS_BATCH_SIZE: 6,          // 每次導入的新字焦點上限
    W: [
        0.4072, 1.1829, 3.1262, 15.4722, // w0~w3: 初始穩定度 (Again, Hard, Good, Easy)
        7.2102, 0.5316, 1.0651, 0.0234,  // w4~w7: 難度初始化與均值回歸
        1.6160, 0.1544, 1.0824,          // w8~w10: 答對後穩定度成長因子
        1.9813, 0.0953, 0.2975, 2.2042,  // w11~w14: 遺忘後穩定度重設因子
        0.2407, 2.9466                   // w15~w16: Hard 懲罰倍率 / Easy 獎勵倍率
    ]
};

const DAY_MS = 24 * 60 * 60 * 1000;

let activeNewFocusPool = [];
let recentHistoryIds = [];

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
 * 📊 根據記憶穩定度 (Stability, 天數) 與學習階段，映射視覺等級 Lv.1 ~ Lv.5
 * 防止同一天內連按直接跳上 Lv.5，必須經過跨日間隔驗證才能升級
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
 * 🔄 為單張卡片補齊或遷移 FSRS 記憶欄位（完全相容舊版字庫資料）
 */
function migrateCardFSRS(card) {
    if (!card || typeof card !== 'object') return card;

    if (typeof card.stability !== 'number' || typeof card.difficulty !== 'number' || typeof card.nextReview !== 'number') {
        const legacyLevel = card.level || 1;
        const legacyStreak = card.knowStreak || 0;
        const baseTime = typeof card.updatedAt === 'number' ? card.updatedAt : Date.now();

        // 依舊等級推算合理的初始穩定度與難度，避免舊資料全數歸零
        const initStabilityMap = { 1: 0, 2: 1.5, 3: 4.0, 4: 10.0, 5: 24.0 };
        const s = initStabilityMap[legacyLevel] || 0;

        card.stability = s;
        card.difficulty = legacyLevel === 1 ? 5.5 : Math.max(2.5, 6.0 - legacyLevel * 0.6);
        card.lapses = typeof card.lapses === 'number' ? card.lapses : 0;
        card.reps = typeof card.reps === 'number' ? card.reps : (legacyLevel > 1 ? legacyLevel : 0);
        card.lastReview = baseTime;

        if (legacyLevel <= 1 && legacyStreak === 0 && card.reps === 0) {
            card.state = 'new';
            card.nextReview = 0; // 新字立即可學
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
 * 數值越低代表大腦越接近遺忘臨界點
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

/**
 * 🧮 FSRS 難度更新公式 D'(D, rating)
 * rating: 1=Again(不熟悉), 2=Hard(模糊), 3=Good(已掌握), 4=Easy(秒答)
 */
function updateDifficulty(currentD, rating) {
    const W = FSRS_CONFIG.W;
    const d0Easy = W[4] - Math.exp(W[5] * 3) + 1;
    const dNext = currentD - W[6] * (rating - 3);
    const meanReverted = W[7] * d0Easy + (1 - W[7]) * dNext;
    return Math.min(10, Math.max(1, Number(meanReverted.toFixed(3))));
}

/**
 * 📈 FSRS 答對後的記憶穩定度成長公式 S'_r(D, S, R, rating)
 * 核心特性：若在剛背完幾分鐘內重複刷題 (R ≈ 0.999)，1 - R ≈ 0，穩定度幾乎不增加，
 * 徹底杜絕同一天連按刷上 Lv.5 的假性熟練。
 */
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

/**
 * 📉 FSRS 遺忘後的記憶穩定度重設公式 S'_f(D, S, R)
 * 保留部分歷史記憶痕跡，避免完全歸零，但強制進入短期重學步驟
 */
function updateLapseStability(d, s, r) {
    const W = FSRS_CONFIG.W;
    const postLapseS = W[11] *
        Math.pow(d, -W[12]) *
        (Math.pow(s + 1, W[13]) - 1) *
        Math.exp((1 - r) * W[14]);

    // 限制在 0.5 ~ 2.5 天之間，確保通過今天 10 分鐘重測後，明天一定會再次複習驗證
    const capped = Math.min(Math.max(postLapseS, 0.5), Math.min(Math.max(s * 0.4, 0.5), 2.5));
    return Number(capped.toFixed(3));
}

/**
 * ✍️ 核心複習狀態更新器（供卡片輪播與隨堂測驗共同呼叫）
 * @param {Object|string} cardOrId - 卡片物件或卡片 ID
 * @param {number} rating - 1: 不熟悉(Again) | 2: 模糊(Hard) | 3: 已掌握(Good) | 4: 秒答(Easy)
 * @param {number} now - 當前時間戳記
 */
function recordCardReview(cardOrId, rating = 3, now = Date.now()) {
    if (!Array.isArray(wordList) || wordList.length === 0) return null;

    const targetCard = typeof cardOrId === 'object'
        ? cardOrId
        : wordList.find(w => w.id === cardOrId);

    if (!targetCard) return null;
    migrateCardFSRS(targetCard);

    const W = FSRS_CONFIG.W;
    const prevState = targetCard.state;
    const prevS = targetCard.stability || 0;
    const prevD = targetCard.difficulty || 5.5;
    const r = calculateRetrievability(targetCard, now);

    let nextState = prevState;
    let nextS = prevS;
    let nextD = prevD;
    let nextReview = now;
    let nextLapses = targetCard.lapses || 0;
    let nextReps = (targetCard.reps || 0) + 1;
    let nextStreak = targetCard.knowStreak || 0;

    if (rating === 1) {
        // ❌ 不熟悉 (Again)：增加遺忘次數，進入 10 分鐘短期急救循環
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
        // 🌱 處於「新字」或「短期鞏固」階段
        nextD = prevState === 'new'
            ? Math.min(10, Math.max(1, W[4] - Math.exp(W[5] * (rating - 1)) + 1))
            : updateDifficulty(prevD, rating);

        if (rating === 2) {
            // 模糊：延長 10 分鐘再確認一次
            nextState = prevState === 'new' ? 'learning' : prevState;
            nextS = Math.max(prevS, W[1] * 0.6);
            nextReview = now + FSRS_CONFIG.LEARNING_STEP_MS;
        } else if (rating === 3) {
            // 已掌握：需累計 2 次短期確認（相隔 10 分鐘）才正式畢業進入跨日排程
            nextStreak += 1;
            if (nextStreak < 2) {
                nextState = prevState === 'new' ? 'learning' : prevState;
                nextS = Math.max(prevS, 0.6);
                nextReview = now + FSRS_CONFIG.LEARNING_STEP_MS;
            } else {
                // 畢業！排入明天（約 1.2 ~ 1.8 天後）進行跨日睡眠鞏固驗收
                nextState = 'review';
                nextStreak = 0;
                nextS = prevState === 'relearning' && prevS > 0
                    ? Math.max(1.0, prevS)
                    : Number((1.2 + (10 - nextD) * 0.08).toFixed(3));
                nextReview = now + nextIntervalDays(nextS) * DAY_MS;
            }
        } else if (rating === 4) {
            // 秒答：直接畢業，排入 4 天後複習
            nextState = 'review';
            nextStreak = 0;
            nextS = 4.0;
            nextReview = now + nextIntervalDays(nextS) * DAY_MS;
        }

    } else {
        // 🌳 已在長期記憶排程 ('review') 中的單字
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

    // 🔗 同步更新全站所有相同拼字的單字（多字庫共享學習進度）
    const normalizedWord = (targetCard.word || '').trim().toLowerCase();
    wordList.forEach(w => {
        if ((w.word || '').trim().toLowerCase() === normalizedWord) {
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
        }
    });

    return targetCard;
}

/**
 * 🔮 預覽各選項的下次複習時間文字（供 UI 按鈕提示使用）
 */
function previewNextIntervals(card, now = Date.now()) {
    if (!card) return { 1: '10 分鐘', 2: '10 分鐘', 3: '1 天', 4: '4 天' };
    migrateCardFSRS(card);

    const formatSpan = (ms) => {
        const diffMin = Math.round((ms - now) / 60000);
        if (diffMin < 60) return `${Math.max(1, diffMin)} 分鐘`;
        const diffHours = Math.round(diffMin / 60);
        if (diffHours < 24) return `${diffHours} 小時`;
        const diffDays = Math.round(diffHours / 24);
        return `${diffDays} 天`;
    };

    const result = {};
    [1, 2, 3, 4].forEach(rating => {
        // 使用淺拷貝模擬計算，不污染原卡片資料
        const clone = { ...card };
        const W = FSRS_CONFIG.W;
        const r = calculateRetrievability(clone, now);

        if (rating === 1) {
            result[rating] = '10 分鐘';
        } else if (clone.state === 'new' || clone.state === 'learning' || clone.state === 'relearning') {
            if (rating === 2 || (rating === 3 && (clone.knowStreak || 0) + 1 < 2)) {
                result[rating] = '10 分鐘';
            } else if (rating === 3) {
                const d = updateDifficulty(clone.difficulty || 5.5, 3);
                const s = clone.state === 'relearning' && clone.stability > 0
                    ? Math.max(1.0, clone.stability)
                    : 1.2 + (10 - d) * 0.08;
                result[rating] = formatSpan(now + nextIntervalDays(s) * DAY_MS);
            } else {
                result[rating] = '4 天';
            }
        } else {
            const s = updateRecallStability(clone.difficulty || 5.5, clone.stability || 1, r, rating);
            result[rating] = formatSpan(now + nextIntervalDays(s) * DAY_MS);
        }
    });

    return result;
}

/**
 * 🔎 取得當前勾選字庫並去重後的有效單字清單
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

        const key = w.word.trim().toLowerCase();
        if (!uniqueMap.has(key)) {
            migrateCardFSRS(w);
            uniqueMap.set(key, w);
        }
    }

    return Array.from(uniqueMap.values());
}

/**
 * 📊 取得目前選取字庫的學習進度統計（供主畫面徽章與統計頁使用）
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

    return {
        totalCount: words.length,
        dueCount,
        newCount,
        learningCount,
        isFreePractice: words.length > 0 && dueCount === 0 && newCount === 0 && learningCount === 0
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
 * 🎯 核心抽卡排程器（三層混合佇列）
 * Tier 1: 已到期複習字 & 昨日遺忘字 (nextReview <= now)
 * Tier 2: 定量新字焦點池 (每次最多 6 個新字交替導入)
 * Tier 3: 自由加練模式 (所有今日進度完成後，依遺忘風險與難度加權無限練習)
 */
function getNextCardSpacedRepetition() {
    const filteredList = getDeduplicatedActiveWords();
    if (filteredList.length === 0) return null;
    if (filteredList.length === 1) return filteredList[0];

    const now = Date.now();
    const lastCardId = recentHistoryIds.length > 0 ? recentHistoryIds[recentHistoryIds.length - 1] : null;

    // 排除上一張剛出現過的卡片（避免連續重複）
    const excludeLast = (pool) => {
        if (pool.length <= 1 || !lastCardId) return pool;
        const withoutLast = pool.filter(w => w.id !== lastCardId);
        return withoutLast.length > 0 ? withoutLast : pool;
    };

    // =========================================================================
    // 🥇 Tier 1：到期池（包含「今天該複習的熟字」與「昨天／剛剛沒背起來的字」）
    // =========================================================================
    const dueCards = filteredList.filter(w => w.state !== 'new' && (w.nextReview || 0) <= now);

    if (dueCards.length > 0) {
        const candidates = excludeLast(dueCards);
        const weighted = candidates.map(word => {
            const r = calculateRetrievability(word, now);
            const isRelearning = word.state === 'relearning' || word.state === 'learning';
            const lapsesBoost = 1 + (word.lapses || 0) * 0.45;
            // 可提取性 R 越低（越快徹底遺忘），權重呈平方級上升
            const urgency = Math.pow(Math.max(0.05, 1.15 - r), 2) * 100;
            let weight = (isRelearning ? 140 : urgency) * lapsesBoost;

            if (recentHistoryIds.includes(word.id)) {
                weight *= 0.2;
            }
            return { word, weight: Math.max(weight, 0.1) };
        });

        const picked = weightedRandomPick(weighted);
        recordHistoryId(picked.id);
        return picked;
    }

    // =========================================================================
    // 🥈 Tier 2：定量新字焦點池 ＋ 尚未滿 10 分鐘的短期學習字
    // =========================================================================
    const validIds = new Set(filteredList.map(w => w.id));
    activeNewFocusPool = activeNewFocusPool.filter(id => {
        if (!validIds.has(id)) return false;
        const w = filteredList.find(item => item.id === id);
        return w && (w.state === 'new' || w.state === 'learning');
    });

    const unseenNewWords = filteredList.filter(w => w.state === 'new');
    for (const w of unseenNewWords) {
        if (activeNewFocusPool.length >= FSRS_CONFIG.NEW_FOCUS_BATCH_SIZE) break;
        if (!activeNewFocusPool.includes(w.id)) {
            activeNewFocusPool.push(w.id);
        }
    }

    const learningPool = filteredList.filter(w =>
        activeNewFocusPool.includes(w.id) || w.state === 'learning' || w.state === 'relearning'
    );

    if (learningPool.length > 0) {
        const candidates = excludeLast(learningPool);
        const weighted = candidates.map(word => {
            let weight = word.state === 'new' ? 100 : 80;
            // 越接近 10 分鐘確認時間的卡片權重越高
            if (word.nextReview && word.nextReview <= now + FSRS_CONFIG.LEARNING_STEP_MS) {
                const remainRatio = Math.max(0, (word.nextReview - now) / FSRS_CONFIG.LEARNING_STEP_MS);
                weight += (1 - remainRatio) * 60;
            }
            if (recentHistoryIds.includes(word.id)) {
                weight *= 0.15;
            }
            return { word, weight: Math.max(weight, 0.1) };
        });

        const picked = weightedRandomPick(weighted);
        recordHistoryId(picked.id);
        return picked;
    }

    // =========================================================================
    // 🥉 Tier 3：自由加練模式（所有今日到期與新字皆已完成，依脆弱度加權無限練習）
    // =========================================================================
    const candidates = excludeLast(filteredList);
    const weighted = candidates.map(word => {
        const r = calculateRetrievability(word, now);
        const s = Math.max(0.5, word.stability || 1);
        const lapsesBoost = 1 + (word.lapses || 0) * 0.5;
        const difficultyBoost = 0.6 + (word.difficulty || 5) / 10;

        // 距離下次複習越近（R 越低）且穩定度越低（剛升級不久）的單字優先被抽中加練
        const vulnerability = ((1.05 - r) * 80 + (15 / s)) * lapsesBoost * difficultyBoost;
        let weight = Math.max(vulnerability, 0.5);

        if (recentHistoryIds.includes(word.id)) {
            weight *= 0.15;
        }
        return { word, weight };
    });

    const picked = weightedRandomPick(weighted);
    recordHistoryId(picked.id);
    return picked;
}

function recordHistoryId(id) {
    if (!id) return;
    recentHistoryIds.push(id);
    if (recentHistoryIds.length > 5) {
        recentHistoryIds.shift();
    }
}

function getNextCardNoRepeat() {
    return getNextCardSpacedRepetition();
}
