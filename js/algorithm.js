/**
 * 🧠 艾賓浩斯演算法與抽卡邏輯 (js/algorithm.js)
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

const LEVEL1_POOL_SIZE = 6;   // Lv.1 焦點循環池上限
const LEVEL2_POOL_SIZE = 4;   // 🌟 Lv.2 焦點循環池上限（限定一次 4 個循環）
const LV2_RELATIVE_BOOST = 1.8; // 🌟 Lv.2 相較於 Lv.3/4/5 的權重倍率（不影響 Lv.1 總機率）

let activeLevel1Pool = [];
let activeLevel2Pool = [];
let historyQueue = [];
let level5HistoryQueue = []; // 🌟 專屬記錄 Lv.5 出現過的單字佇列

function getLevelInfo(level) {
    const lv = level || 1;
    return {
        name: LEVEL_NAMES[lv] || LEVEL_NAMES[1],
        color: LEVEL_COLORS[lv] || LEVEL_COLORS[1]
    };
}

function getNextCardSpacedRepetition() {
    if (!wordList || wordList.length === 0) return null;

    const activeCats = window.selectedCategories || ['ALL'];
    const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : '預設字庫';

    // 1️⃣ 篩選當前勾選字庫的單字
    const rawFiltered = wordList.filter(w => {
        if (activeCats.includes("ALL")) return true;
        return activeCats.includes(w.category || defaultCatName);
    });

    if (rawFiltered.length === 0) return null;

    // 2️⃣ 依單字名稱去重（轉小寫比對），確保多字庫勾選時重複單字不會被加倍計算機率
    const uniqueMap = new Map();
    rawFiltered.forEach(w => {
        if (!w || !w.word) return;
        const key = w.word.trim().toLowerCase();
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, w);
        }
    });
    const filteredList = Array.from(uniqueMap.values());

    filteredList.forEach(w => {
        if (!w.level) w.level = 1;
        if (typeof w.knowStreak === 'undefined') w.knowStreak = 0;
    });

    // 🌟 Level 1 焦點池
    activeLevel1Pool = activeLevel1Pool.filter(id => {
        const w = filteredList.find(item => item.id === id);
        return w && w.level === 1;
    });
    const allLevel1Words = filteredList.filter(w => w.level === 1);
    for (const w of allLevel1Words) {
        if (activeLevel1Pool.length >= LEVEL1_POOL_SIZE) break;
        if (!activeLevel1Pool.includes(w.id)) {
            activeLevel1Pool.push(w.id);
        }
    }

    // 🌟 Level 2 焦點池（限定一次 4 個單字循環）
    activeLevel2Pool = activeLevel2Pool.filter(id => {
        const w = filteredList.find(item => item.id === id);
        return w && w.level === 2;
    });
    const allLevel2Words = filteredList.filter(w => w.level === 2);
    for (const w of allLevel2Words) {
        if (activeLevel2Pool.length >= LEVEL2_POOL_SIZE) break;
        if (!activeLevel2Pool.includes(w.id)) {
            activeLevel2Pool.push(w.id);
        }
    }

    const candidateWords = filteredList.filter(w => {
        if (w.level === 1) return activeLevel1Pool.includes(w.id);
        if (w.level === 2) return activeLevel2Pool.includes(w.id);
        return true;
    });

    if (candidateWords.length === 0) return filteredList[0];
    if (candidateWords.length === 1) return candidateWords[0];

    // 🚫 嚴格防止同一張牌連續出現第二次
    const lastCardId = historyQueue.length > 0 ? historyQueue[historyQueue.length - 1] : null;
    let poolToSelectFrom = candidateWords;

    if (candidateWords.length > 1 && lastCardId) {
        const nonRepeatPool = candidateWords.filter(w => w.id !== lastCardId);
        if (nonRepeatPool.length > 0) {
            poolToSelectFrom = nonRepeatPool;
        }
    }

    const BASE_WEIGHTS = { 1: 250, 2: 70, 3: 35, 4: 15, 5: 4 };
    const weightedCandidates = [];

    // 1️⃣ 處理 Lv.1 單字（維持原始權重，確保相對於 2~5 級的總機率完全不變）
    const lv1Words = poolToSelectFrom.filter(w => w.level === 1);
    lv1Words.forEach(word => {
        let weight = BASE_WEIGHTS[1];
        if (historyQueue.indexOf(word.id) !== -1) {
            weight *= 0.25;
        }
        weightedCandidates.push({ word, weight: Math.max(weight, 0.1) });
    });

    // 2️⃣ 收集 Lv.2 ~ Lv.5 單字的原始權重
    const lv2to5Items = [];

    // 2a. Lv.2 ~ Lv.4 基礎權重
    const lv234Words = poolToSelectFrom.filter(w => w.level >= 2 && w.level <= 4);
    lv234Words.forEach(word => {
        let baseWeight = BASE_WEIGHTS[word.level] || 50;
        if (historyQueue.indexOf(word.id) !== -1) {
            baseWeight *= 0.25;
        }
        lv2to5Items.push({ word, baseWeight: Math.max(baseWeight, 0.1) });
    });

    // 2b. Lv.5 單字（保持 Lv.5 總權重不變，內部優先抽沒出現過的字）
    const lv5Words = poolToSelectFrom.filter(w => w.level === 5);
    if (lv5Words.length > 0) {
        const targetTotalLv5Weight = lv5Words.length * BASE_WEIGHTS[5];

        const lv5Freshness = lv5Words.map(word => {
            const hIndex = level5HistoryQueue.indexOf(word.id);
            let freshWeight = 1.0;
            if (hIndex !== -1) {
                const recencyRatio = (hIndex + 1) / level5HistoryQueue.length;
                freshWeight = 0.01 + 0.09 * recencyRatio;
            }
            return { word, freshWeight };
        });

        const totalFreshness = lv5Freshness.reduce((sum, item) => sum + item.freshWeight, 0);

        lv5Freshness.forEach(item => {
            const normalizedWeight = (item.freshWeight / totalFreshness) * targetTotalLv5Weight;
            lv2to5Items.push({ word: item.word, baseWeight: Math.max(normalizedWeight, 0.01) });
        });
    }

    // 3️⃣ 群組權重歸一化：提高 Lv.2 相對於 Lv.3/4/5 的比重，同時維持 Lv.2~5 總權重不變
    if (lv2to5Items.length > 0) {
        const originalLv2to5Sum = lv2to5Items.reduce((sum, item) => sum + item.baseWeight, 0);

        const boostedItems = lv2to5Items.map(item => ({
            word: item.word,
            boostedWeight: item.word.level === 2
                ? item.baseWeight * LV2_RELATIVE_BOOST
                : item.baseWeight
        }));

        const boostedLv2to5Sum = boostedItems.reduce((sum, item) => sum + item.boostedWeight, 0);
        const scaleFactor = boostedLv2to5Sum > 0 ? (originalLv2to5Sum / boostedLv2to5Sum) : 1;

        boostedItems.forEach(item => {
            weightedCandidates.push({
                word: item.word,
                weight: Math.max(item.boostedWeight * scaleFactor, 0.01)
            });
        });
    }

    // 🎲 加權隨機抽卡
    const totalWeight = weightedCandidates.reduce((sum, item) => sum + item.weight, 0);
    let randomNum = Math.random() * totalWeight;

    let selectedCard = weightedCandidates[0].word;
    for (const item of weightedCandidates) {
        if (randomNum < item.weight) {
            selectedCard = item.word;
            break;
        }
        randomNum -= item.weight;
    }

    // 📝 更新通用歷史佇列
    historyQueue.push(selectedCard.id);
    if (historyQueue.length > 4) historyQueue.shift();

    // 📝 若抽中 Lv.5 單字，更新專屬的 Lv.5 歷史佇列
    if (selectedCard.level === 5) {
        level5HistoryQueue.push(selectedCard.id);
        const maxLv5History = Math.max(10, lv5Words.length - 1);
        if (level5HistoryQueue.length > maxLv5History) {
            level5HistoryQueue.shift();
        }
    }

    return selectedCard;
}

function getNextCardNoRepeat() {
    return getNextCardSpacedRepetition();
}