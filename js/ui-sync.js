/**
 * 🧠 FSRS 與自由加練雙軌介面同步器 (js/ui-sync.js)
 * 負責自動更新：
 * 1. 首頁待複習與新字數量徽章
 * 2. 卡片輪播上方的排程 / 自由加練狀態膠囊
 * 3. 卡片正背面的等級標籤（正式 Lv / 臨時 Lv）、保留率與按鈕間隔預覽
 */

(function () {
    function getSafeDefaultCatName() {
        if (typeof t === 'function') {
            const val = t('defaultCategoryName');
            if (val && val !== 'defaultCategoryName') return val;
        }
        return '預設字庫';
    }

    function formatIntervalShort(days) {
        if (!days || days < 0.02) return '10 分鐘後';
        if (days < 1) {
            const hrs = Math.max(1, Math.round(days * 24));
            return `${hrs} 小時後`;
        }
        const d = Math.round(days);
        return `${d} 天後`;
    }

    function getActiveFilteredCards() {
        if (typeof wordList === 'undefined' || !Array.isArray(wordList)) return [];
        const activeCats = Array.isArray(window.selectedCategories) ? window.selectedCategories : ['ALL'];
        if (activeCats.includes('ALL')) return wordList;
        if (activeCats.length === 0) return [];

        const defaultCatName = getSafeDefaultCatName();
        const activeSet = new Set(activeCats);
        return wordList.filter(w => {
            if (!w || typeof w !== 'object') return false;
            const cat = (w.category && w.category.trim() !== '') ? w.category.trim() : defaultCatName;
            return activeSet.has(cat);
        });
    }

    function findDisplayedCard() {
        if (typeof currentCard !== 'undefined' && currentCard) return currentCard;
        const wordText = (document.getElementById('cardWord')?.innerText || '').trim().toLowerCase();
        if (!wordText || wordText === 'word') return null;
        const pool = getActiveFilteredCards();
        return pool.find(w => (w.word || '').trim().toLowerCase() === wordText) || null;
    }

    function isCurrentlyFreePractice() {
        if (window.isManualFreePractice) return true;
        const pool = getActiveFilteredCards();
        if (pool.length === 0) return false;
        const now = Date.now();
        const dueCount = pool.filter(w => w.state && w.state !== 'new' && (w.nextReview || 0) <= now).length;
        const newCount = pool.filter(w => !w.state || w.state === 'new').length;
        return dueCount === 0 && newCount === 0;
    }

    window.handleFSRSGrade = function (rating) {
        if (typeof handleCardRating === 'function') {
            handleCardRating(rating);
            return;
        }
        const card = findDisplayedCard();
        if (!card) return;

        if (isCurrentlyFreePractice() && typeof recordFreePracticeReview === 'function') {
            recordFreePracticeReview(card, rating);
        } else if (typeof recordCardReview === 'function') {
            recordCardReview(card, rating);
        }

        if (typeof saveStorage === 'function') saveStorage();
        if (typeof updateUI === 'function') updateUI();
        if (typeof nextCard === 'function') nextCard(true);
    };

    let isSyncingBadges = false;

    window.refreshFSRSUIBadges = function () {
        if (isSyncingBadges) return;
        isSyncingBadges = true;

        try {
            const pool = getActiveFilteredCards();
            const now = Date.now();
            const dueCount = pool.filter(w => w.state && w.state !== 'new' && (w.nextReview || 0) <= now).length;
            const newCount = pool.filter(w => !w.state || w.state === 'new').length;
            const isManualFree = Boolean(window.isManualFreePractice);
            const isFreeMode = isManualFree || (pool.length > 0 && dueCount === 0 && newCount === 0);

            const homeBadge = document.getElementById('homeFsrsDueBadge');
            if (homeBadge) {
                if (pool.length === 0) {
                    homeBadge.innerText = '尚無單字';
                } else if (dueCount > 0) {
                    homeBadge.innerText = `🔥 待複習 ${dueCount} · 新字 ${newCount}`;
                } else if (newCount > 0) {
                    homeBadge.innerText = `🆕 待學新字 ${newCount}`;
                } else {
                    homeBadge.innerText = '✨ 今日到期已清空';
                }
            }

            const sessionBadge = document.getElementById('fsrsSessionBadge');
            if (sessionBadge) {
                if (isManualFree) {
                    sessionBadge.innerText = '💪 自由加練中（點擊切回排程）';
                    sessionBadge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer';
                } else if (dueCount > 0) {
                    sessionBadge.innerText = `🔥 今日到期：${dueCount} 字 · 點擊自由加練`;
                    sessionBadge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800 transition cursor-pointer';
                } else if (newCount > 0) {
                    sessionBadge.innerText = `🆕 新字學習 (${newCount}) · 點擊自由加練`;
                    sessionBadge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800 transition cursor-pointer';
                } else {
                    sessionBadge.innerText = '✨ 自由加練模式';
                    sessionBadge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer';
                }
            }

            const card = findDisplayedCard();
            const metaFront = document.getElementById('cardFsrsMetaFront');
            const metaBack = document.getElementById('cardFsrsMetaBack');
            const lvFront = document.getElementById('cardLevelFront');
            const lvBack = document.getElementById('cardLevelBack');
            let metaText = '';

            if (card) {
                const p1 = document.getElementById('fsrsPreview1');
                const p2 = document.getElementById('fsrsPreview2');
                const p3 = document.getElementById('fsrsPreview3');
                const p4 = document.getElementById('fsrsPreview4');

                if (isFreeMode && typeof getFreeLevelInfo === 'function') {
                    // ⚡ 自由加練模式：顯示獨立的「臨時 Lv.1~5」與升降級預覽
                    const freeLvInfo = getFreeLevelInfo(card.freeLevel || 1);
                    if (lvFront) {
                        lvFront.innerText = freeLvInfo.name;
                        lvFront.className = `px-2.5 py-1 rounded-full text-xs font-bold border ${freeLvInfo.color}`;
                    }
                    if (lvBack) {
                        lvBack.innerText = freeLvInfo.name;
                        lvBack.className = `px-2.5 py-1 rounded-full text-xs font-bold border ${freeLvInfo.color}`;
                    }

                    metaText = `⚡ 考前臨時熟悉 · 連對 ${card.freeStreak || 0}/2（不影響 FSRS）`;

                    if (typeof previewFreePracticeTransitions === 'function') {
                        const previews = previewFreePracticeTransitions(card);
                        if (p1) p1.innerText = previews[1];
                        if (p2) p2.innerText = previews[2];
                        if (p3) p3.innerText = previews[3];
                        if (p4) p4.innerText = previews[4];
                    }
                } else {
                    // 🧠 FSRS 排程模式：還原正式等級與遺忘曲線天數預覽
                    if (typeof getLevelInfo === 'function') {
                        const stdLvInfo = getLevelInfo(card.level || 1);
                        if (lvFront) {
                            lvFront.innerText = stdLvInfo.name;
                            lvFront.className = `px-2.5 py-1 rounded-full text-xs font-bold border ${stdLvInfo.color}`;
                        }
                        if (lvBack) {
                            lvBack.innerText = stdLvInfo.name;
                            lvBack.className = `px-2.5 py-1 rounded-full text-xs font-bold border ${stdLvInfo.color}`;
                        }
                    }

                    if (!card.state || card.state === 'new') {
                        metaText = '🆕 全新單字';
                    } else if (typeof calculateRetrievability === 'function') {
                        const rPct = Math.round(calculateRetrievability(card, now) * 100);
                        const sDays = Math.max(0.1, card.stability || 0).toFixed(1);
                        metaText = `保留率 ${rPct}% · 穩定度 ${sDays}天`;
                    }

                    const s = Math.max(0.5, card.stability || 1);
                    const isNew = !card.state || card.state === 'new';

                    if (typeof previewNextIntervals === 'function') {
                        const previews = previewNextIntervals(card);
                        if (p1 && previews[1]) p1.innerText = previews[1];
                        if (p2 && previews[2]) p2.innerText = previews[2];
                        if (p3 && previews[3]) p3.innerText = previews[3];
                        if (p4 && previews[4]) p4.innerText = previews[4];
                    } else {
                        if (p1) p1.innerText = '10 分鐘後';
                        if (p2) p2.innerText = isNew ? '12 小時後' : formatIntervalShort(s * 0.8);
                        if (p3) p3.innerText = isNew ? '1 天後' : formatIntervalShort(s * 2.2);
                        if (p4) p4.innerText = isNew ? '4 天後' : formatIntervalShort(s * 3.5);
                    }
                }
            }

            if (metaFront) metaFront.innerText = metaText;
            if (metaBack) metaBack.innerText = metaText;
        } finally {
            isSyncingBadges = false;
        }
    };

    function initUISyncObserver() {
        const targets = ['cardWord', 'cardCountDisplay', 'categoryDropdownBtnText'];
        const observer = new MutationObserver(() => {
            window.refreshFSRSUIBadges();
        });
        targets.forEach(id => {
            const el = document.getElementById(id);
            if (el) observer.observe(el, { childList: true, characterData: true, subtree: true });
        });
        setTimeout(window.refreshFSRSUIBadges, 300);
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initUISyncObserver);
    } else {
        initUISyncObserver();
    }
})();
