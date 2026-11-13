/**
 * ⚡ 自由練習 / 考前臨時熟悉演算法 (js/algorithm_2.js)
 * 特性：
 * 1. 使用獨立欄位 `freeLevel` (1~5) 與 `freeStreak`，完全不影響 FSRS 排程數據
 * 2. 沿用 Lv.1 (6字) 與 Lv.2 (4字) 焦點循環池 + 雙層歸一化權重抽卡
 */

(function (window) {
    const FREE_LEVEL_NAMES = {
        1: "臨時 Lv.1",
        2: "臨時 Lv.2",
        3: "臨時 Lv.3",
        4: "臨時 Lv.4",
        5: "臨時 Lv.5"
    };

    const FREE_LEVEL_COLORS = {
        1: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
        2: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
        3: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
        4: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
        5: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
    };

    const LEVEL1_POOL_SIZE = 6;     // 臨時 Lv.1 焦點循環池上限
    const LEVEL2_POOL_SIZE = 4;     // 臨時 Lv.2 焦點循環池上限
    const LV2_RELATIVE_BOOST = 1.8; // Lv.2 相較於 Lv.3/4/5 的權重倍率
    const LV4_RELATIVE_BOOST = 2.0; // Lv.4 相較於 Lv.5 的權重倍率

    // 獨立的執行期佇列，不與 algorithm.js 混用
    let freeActiveLevel1Pool = [];
    let freeActiveLevel2Pool = [];
    let freeHistoryQueue = [];
    let freeLevel5HistoryQueue = [];

    function getFreeLevelInfo(level) {
        const lv = level || 1;
        return {
            name: FREE_LEVEL_NAMES[lv] || FREE_LEVEL_NAMES[1],
            color: FREE_LEVEL_COLORS[lv] || FREE_LEVEL_COLORS[1]
        };
    }

    /**
     * 🎲 自由練習專用抽卡函式
     */
    function getNextCardFreePractice() {
        if (typeof wordList === 'undefined' || !wordList || wordList.length === 0) return null;

        const activeCats = window.selectedCategories || ['ALL'];
        const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : '預設字庫';

        // 1️⃣ 篩選當前勾選字庫
        const rawFiltered = wordList.filter(w => {
            if (activeCats.includes("ALL")) return true;
            return activeCats.includes(w.category || defaultCatName);
        });

        if (rawFiltered.length === 0) return null;

        // 2️⃣ 依單字名稱去重（若同字多筆則保留臨時等級較高者）
        const uniqueMap = new Map();
        rawFiltered.forEach(w => {
            if (!w || !w.word) return;
            const key = w.word.trim().toLowerCase();
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, w);
            } else {
                const existing = uniqueMap.get(key);
                if ((w.freeLevel || 1) > (existing.freeLevel || 1) ||
                    ((w.freeLevel || 1) === (existing.freeLevel || 1) && (w.freeStreak || 0) > (existing.freeStreak || 0))) {
                    uniqueMap.set(key, w);
                }
            }
        });
        const filteredList = Array.from(uniqueMap.values());

        // 初始化獨立的自由練習欄位（不碰 w.level 與 FSRS 欄位）
        filteredList.forEach(w => {
            if (!w.freeLevel) w.freeLevel = 1;
            if (typeof w.freeStreak === 'undefined') w.freeStreak = 0;
        });

        // 🌟 臨時 Level 1 焦點池
        freeActiveLevel1Pool = freeActiveLevel1Pool.filter(id => {
            const w = filteredList.find(item => item.id === id);
            return w && w.freeLevel === 1;
        });
        const allLevel1Words = filteredList.filter(w => w.freeLevel === 1);
        for (const w of allLevel1Words) {
            if (freeActiveLevel1Pool.length >= LEVEL1_POOL_SIZE) break;
            if (!freeActiveLevel1Pool.includes(w.id)) {
                freeActiveLevel1Pool.push(w.id);
            }
        }

        // 🌟 臨時 Level 2 焦點池
        freeActiveLevel2Pool = freeActiveLevel2Pool.filter(id => {
            const w = filteredList.find(item => item.id === id);
            return w && w.freeLevel === 2;
        });
        const allLevel2Words = filteredList.filter(w => w.freeLevel === 2);
        for (const w of allLevel2Words) {
            if (freeActiveLevel2Pool.length >= LEVEL2_POOL_SIZE) break;
            if (!freeActiveLevel2Pool.includes(w.id)) {
                freeActiveLevel2Pool.push(w.id);
            }
        }

        const candidateWords = filteredList.filter(w => {
            if (w.freeLevel === 1) return freeActiveLevel1Pool.includes(w.id);
            if (w.freeLevel === 2) return freeActiveLevel2Pool.includes(w.id);
            return true;
        });

        if (candidateWords.length === 0) return filteredList[0];
        if (candidateWords.length === 1) return candidateWords[0];

        // 🚫 防止同一張卡連續出現兩次
        const lastCardId = freeHistoryQueue.length > 0 ? freeHistoryQueue[freeHistoryQueue.length - 1] : null;
        let poolToSelectFrom = candidateWords;

        if (candidateWords.length > 1 && lastCardId) {
            const nonRepeatPool = candidateWords.filter(w => w.id !== lastCardId);
            if (nonRepeatPool.length > 0) {
                poolToSelectFrom = nonRepeatPool;
            }
        }

        const BASE_WEIGHTS = { 1: 250, 2: 70, 3: 35, 4: 15, 5: 4 };
        const weightedCandidates = [];

        // 1️⃣ 處理臨時 Lv.1
        const lv1Words = poolToSelectFrom.filter(w => w.freeLevel === 1);
        lv1Words.forEach(word => {
            let weight = BASE_WEIGHTS[1];
            if (freeHistoryQueue.indexOf(word.id) !== -1) {
                weight *= 0.25;
            }
            weightedCandidates.push({ word, weight: Math.max(weight, 0.1) });
        });

        // 2️⃣ 收集臨時 Lv.2 ~ Lv.5
        const lv2to5Items = [];
        const lv234Words = poolToSelectFrom.filter(w => w.freeLevel >= 2 && w.freeLevel <= 4);
        lv234Words.forEach(word => {
            let baseWeight = BASE_WEIGHTS[word.freeLevel] || 50;
            if (freeHistoryQueue.indexOf(word.id) !== -1) {
                baseWeight *= 0.25;
            }
            lv2to5Items.push({ word, baseWeight: Math.max(baseWeight, 0.1) });
        });

        const lv5Words = poolToSelectFrom.filter(w => w.freeLevel === 5);
        if (lv5Words.length > 0) {
            const targetTotalLv5Weight = lv5Words.length * BASE_WEIGHTS[5];
            const lv5Freshness = lv5Words.map(word => {
                const hIndex = freeLevel5HistoryQueue.indexOf(word.id);
                let freshWeight = 1.0;
                if (hIndex !== -1) {
                    const recencyRatio = (hIndex + 1) / freeLevel5HistoryQueue.length;
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

        // 3️⃣ 第一層群組歸一化（提升 Lv.2 相對比重）
        const lv4to5Items = [];
        if (lv2to5Items.length > 0) {
            const originalLv2to5Sum = lv2to5Items.reduce((sum, item) => sum + item.baseWeight, 0);
            const lv2BoostedItems = lv2to5Items.map(item => ({
                word: item.word,
                boostedWeight: item.word.freeLevel === 2
                    ? item.baseWeight * LV2_RELATIVE_BOOST
                    : item.baseWeight
            }));
            const boostedLv2to5Sum = lv2BoostedItems.reduce((sum, item) => sum + item.boostedWeight, 0);
            const scale2to5 = boostedLv2to5Sum > 0 ? (originalLv2to5Sum / boostedLv2to5Sum) : 1;

            lv2BoostedItems.forEach(item => {
                const weightAfterLv2 = item.boostedWeight * scale2to5;
                if (item.word.freeLevel === 2 || item.word.freeLevel === 3) {
                    weightedCandidates.push({
                        word: item.word,
                        weight: Math.max(weightAfterLv2, 0.01)
                    });
                } else {
                    lv4to5Items.push({ word: item.word, weightAfterLv2 });
                }
            });
        }

        // 4️⃣ 第二層群組歸一化（提升 Lv.4 相對比重）
        if (lv4to5Items.length > 0) {
            const originalLv4to5Sum = lv4to5Items.reduce((sum, item) => sum + item.weightAfterLv2, 0);
            const lv4BoostedItems = lv4to5Items.map(item => ({
                word: item.word,
                boostedWeight: item.word.freeLevel === 4
                    ? item.weightAfterLv2 * LV4_RELATIVE_BOOST
                    : item.weightAfterLv2
            }));
            const boostedLv4to5Sum = lv4BoostedItems.reduce((sum, item) => sum + item.boostedWeight, 0);
            const scale4to5 = boostedLv4to5Sum > 0 ? (originalLv4to5Sum / boostedLv4to5Sum) : 1;

            lv4BoostedItems.forEach(item => {
                weightedCandidates.push({
                    word: item.word,
                    weight: Math.max(item.boostedWeight * scale4to5, 0.01)
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

        // 更新歷史佇列
        freeHistoryQueue.push(selectedCard.id);
        if (freeHistoryQueue.length > 4) freeHistoryQueue.shift();

        if (selectedCard.freeLevel === 5) {
            freeLevel5HistoryQueue.push(selectedCard.id);
            const maxLv5History = Math.max(10, lv5Words.length - 1);
            if (freeLevel5HistoryQueue.length > maxLv5History) {
                freeLevel5HistoryQueue.shift();
            }
        }

        return selectedCard;
    }

    /**
     * ✍️ 自由練習四段評分更新（僅更新 freeLevel 與 freeStreak，完全不改 FSRS）
     * @param {Object} card 單字物件
     * @param {number} rating 1:不熟悉, 2:模糊, 3:已掌握, 4:秒答
     */
    function recordFreePracticeReview(card, rating) {
        if (!card) return;
        if (!card.freeLevel) card.freeLevel = 1;
        if (typeof card.freeStreak === 'undefined') card.freeStreak = 0;

        switch (rating) {
            case 1: // 不熟悉：直接打回臨時 Lv.1 焦點池
                card.freeLevel = 1;
                card.freeStreak = 0;
                break;

            case 2: // 模糊：降一級，重置連對次數
                card.freeLevel = Math.max(1, card.freeLevel - 1);
                card.freeStreak = 0;
                break;

            case 3: // 已掌握：Lv.1 需連對 2 次才升 Lv.2；Lv.2 以上每次升 1 級
                if (card.freeLevel === 1) {
                    card.freeStreak += 1;
                    if (card.freeStreak >= 2) {
                        card.freeLevel = 2;
                        card.freeStreak = 0;
                    }
                } else {
                    card.freeLevel = Math.min(5, card.freeLevel + 1);
                    card.freeStreak = 0;
                }
                break;

            case 4: // 秒答：考前已熟練的字直接跳 2 級，快速離開高頻焦點池
                card.freeLevel = Math.min(5, card.freeLevel + 2);
                card.freeStreak = 0;
                break;
        }

        // 同步跨字庫重複單字的自由練習臨時進度
        if (typeof wordList !== 'undefined' && Array.isArray(wordList) && card.word) {
            const targetKey = card.word.trim().toLowerCase();
            wordList.forEach(w => {
                if (w !== card && (w.word || '').trim().toLowerCase() === targetKey) {
                    w.freeLevel = card.freeLevel;
                    w.freeStreak = card.freeStreak;
                }
            });
        }
    }

    /**
     * 🔮 預覽四個按鈕在自由練習模式下的等級變化（取代原本的 FSRS 天數預覽）
     */
    function previewFreePracticeTransitions(card) {
        const lv = (card && card.freeLevel) ? card.freeLevel : 1;
        const streak = (card && card.freeStreak) ? card.freeStreak : 0;

        const r1 = "重置為 Lv.1";
        const r2 = lv <= 1 ? "維持 Lv.1" : `降至 Lv.${lv - 1}`;
        const r3 = (lv === 1 && streak + 1 < 2)
            ? `連對 ${streak + 1}/2 升 Lv.2`
            : `升至 Lv.${Math.min(5, lv + 1)}`;
        const r4 = `直升 Lv.${Math.min(5, lv + 2)}`;

        return { 1: r1, 2: r2, 3: r3, 4: r4 };
    }

    /**
     * 🔄 考完試或準備下一科前，一鍵重置所有「臨時熟悉等級」為 Lv.1
     */
    function resetFreePracticeLevels(targetCategories = ['ALL']) {
        if (typeof wordList === 'undefined' || !Array.isArray(wordList)) return 0;
        const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : '預設字庫';
        let count = 0;

        wordList.forEach(w => {
            const cat = w.category || defaultCatName;
            if (targetCategories.includes('ALL') || targetCategories.includes(cat)) {
                w.freeLevel = 1;
                w.freeStreak = 0;
                count++;
            }
        });

        freeActiveLevel1Pool = [];
        freeActiveLevel2Pool = [];
        freeHistoryQueue = [];
        freeLevel5HistoryQueue = [];

        if (typeof saveStorage === 'function') saveStorage();
        if (typeof window.refreshFSRSUIBadges === 'function') window.refreshFSRSUIBadges();
        return count;
    }

    // 匯出全域介面
    window.getFreeLevelInfo = getFreeLevelInfo;
    window.getNextCardFreePractice = getNextCardFreePractice;
    window.recordFreePracticeReview = recordFreePracticeReview;
    window.previewFreePracticeTransitions = previewFreePracticeTransitions;
    window.resetFreePracticeLevels = resetFreePracticeLevels;
})(window);
