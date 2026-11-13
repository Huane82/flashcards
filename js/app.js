/**
 * LZHCard - 主程式交互控制器 (FSRS 與自由練習雙軌 + 還原/重置 + i18n 完整版)
 */

/**
 * 🌐 i18n 安全轉接函式（支援 {key} 動態參數替換，未定義時自動退回預設文字）
 */
function tr(key, fallback, params = null) {
    let text = fallback;
    if (typeof t === 'function') {
        const translated = t(key);
        if (translated && translated !== key) {
            text = translated;
        }
    }
    if (params && typeof text === 'string') {
        Object.keys(params).forEach(k => {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
        });
    }
    return text;
}

/**
 * 🌐 取得本地化自由練習等級顯示文字
 */
function getLocalizedFreeLevelName(level) {
    const lv = Math.min(5, Math.max(1, Number(level) || 1));
    return tr('freeLevelShort', '臨時 Lv.{lv}', { lv });
}

function getSavedCategories() {
    try {
        const saved = localStorage.getItem('lzhcard_selected_categories');
        if (saved !== null) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {}
    return ['ALL'];
}

window.selectedCategories = getSavedCategories();
let currentCard = null;
let selectedWordIds = new Set();
let currentTab = 'home';
let isCardActionLocked = false;
let isAppLoaderHidden = false;
let currentLoaderProgress = 15;

// ↩️ 誤按還原堆疊（最多保留最近 10 步評分快照）
let ratingUndoStack = [];
const MAX_UNDO_STEPS = 10;

function updateUndoButtonUI() {
    const btn = document.getElementById('undoCardBtn') || document.getElementById('undoRatingBtn');
    if (!btn) return;
    const hasHistory = ratingUndoStack.length > 0;
    btn.disabled = !hasHistory;
    if (hasHistory) {
        btn.className = "px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold flex items-center space-x-1 transition cursor-pointer";
    } else {
        btn.className = "px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 font-bold flex items-center space-x-1 transition opacity-50 cursor-not-allowed";
    }
}

function setAppLoaderProgress(percent, statusText) {
    if (isAppLoaderHidden) return;
    currentLoaderProgress = Math.max(currentLoaderProgress, Math.min(100, percent));

    const bar = document.getElementById('appLoaderProgressBar');
    const pctText = document.getElementById('appLoaderProgressPercent');
    const statusEl = document.getElementById('appLoaderStatusText');

    if (bar) bar.style.width = `${currentLoaderProgress}%`;
    if (pctText) pctText.innerText = `${currentLoaderProgress}%`;
    if (statusEl && statusText) statusEl.innerText = statusText;
}

function hideAppLoader() {
    if (isAppLoaderHidden) return;
    setAppLoaderProgress(100, tr('appLoaderComplete', '初始化完成！'));
    isAppLoaderHidden = true;

    const overlay = document.getElementById('appLoadingOverlay');
    if (!overlay) return;

    setTimeout(() => {
        overlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300);
    }, 180);
}

if (window.__appReadyToHideLoader) {
    hideAppLoader();
}

setTimeout(hideAppLoader, 5000);

let wordListRenderLimit = 100;
window._cachedFilteredWords = [];

const MAX_AI_BATCH_LIMIT = 200;

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgColors = {
        success: 'bg-emerald-600 text-white',
        error: 'bg-rose-600 text-white',
        info: 'bg-brand-600 text-white',
        warning: 'bg-amber-500 text-white'
    };
    const icons = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        info: 'fa-circle-info',
        warning: 'fa-triangle-exclamation'
    };

    toast.className = `pointer-events-auto flex items-center space-x-2.5 px-4 py-3 rounded-xl shadow-xl font-semibold text-xs transition-all duration-300 transform translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info} text-sm"></i><span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function updateUserCoinsUI() {
    const el = document.getElementById('userCoinsDisplay');
    if (el) {
        const coins = (window.userData && typeof window.userData.coins === 'number') ? window.userData.coins : 0;
        el.innerText = coins;
    }
}

function getAllCategories() {
    const defaultCatName = tr('defaultCategoryName', '預設字庫');
    if (!wordList || !Array.isArray(wordList)) return [defaultCatName];
    const categories = new Set();
    wordList.forEach(w => {
        if (w.category && w.category.trim() !== '') {
            categories.add(w.category.trim());
        }
    });
    if (categories.size === 0) categories.add(defaultCatName);
    return Array.from(categories);
}

const CATEGORY_SELECTOR_MAP = {
    quickAdd: { selectId: 'quickAddCategorySelect', inputId: 'quickAddCategoryInput' },
    form: { selectId: 'formCategorySelect', inputId: 'formCategory' },
    batch: { selectId: 'batchTargetCategorySelect', inputId: 'batchTargetCategory' }
};

function refreshCategoryDropdownWithNew(selectId, inputId) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    if (!select) return;

    const prevValue = select.value;
    const cats = getAllCategories();
    const defaultCatName = tr('defaultCategoryName', '預設字庫');
    const unitText = tr('unitWord', '字');
    const createNewLabel = tr('optCreateNewDeck', '➕ 創建新字庫...');

    const escapeHtml = (str) => String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    let optionsHtml = cats.map(c => {
        const count = (typeof wordList !== 'undefined' && Array.isArray(wordList))
            ? wordList.filter(w => (w.category || defaultCatName) === c).length
            : 0;
        return `<option value="${escapeHtml(c)}">${escapeHtml(c)} (${count} ${unitText})</option>`;
    }).join('');

    optionsHtml += `<option value="__NEW_CATEGORY__">${createNewLabel}</option>`;
    select.innerHTML = optionsHtml;

    if (prevValue === '__NEW_CATEGORY__') {
        select.value = '__NEW_CATEGORY__';
        if (input) input.classList.remove('hidden');
    } else if (prevValue && cats.includes(prevValue)) {
        select.value = prevValue;
        if (input) {
            input.value = prevValue;
            input.classList.add('hidden');
        }
    } else if (cats.length > 0) {
        select.value = cats[0];
        if (input) {
            input.value = cats[0];
            input.classList.add('hidden');
        }
    }
}

function handleCategorySelectWithNew(type, autoFocus = true) {
    const cfg = CATEGORY_SELECTOR_MAP[type];
    if (!cfg) return;
    const select = document.getElementById(cfg.selectId);
    const input = document.getElementById(cfg.inputId);
    if (!select || !input) return;

    if (select.value === '__NEW_CATEGORY__') {
        input.classList.remove('hidden');
        input.value = '';
        if (autoFocus) input.focus();
    } else {
        input.classList.add('hidden');
        input.value = select.value;
    }
}

function setCategorySelectorValue(type, categoryName) {
    const cfg = CATEGORY_SELECTOR_MAP[type];
    if (!cfg) return;
    refreshCategoryDropdownWithNew(cfg.selectId, cfg.inputId);

    const select = document.getElementById(cfg.selectId);
    const input = document.getElementById(cfg.inputId);
    if (!select || !input) return;

    const target = (categoryName || '').trim();
    const hasOption = Array.from(select.options).some(
        opt => opt.value !== '__NEW_CATEGORY__' && opt.value === target
    );

    if (hasOption) {
        select.value = target;
        input.value = target;
        input.classList.add('hidden');
    } else {
        select.value = '__NEW_CATEGORY__';
        input.value = target;
        input.classList.remove('hidden');
    }
}

function getCategorySelectorValue(type) {
    const cfg = CATEGORY_SELECTOR_MAP[type];
    if (!cfg) return { isNew: false, value: '' };
    const select = document.getElementById(cfg.selectId);
    const input = document.getElementById(cfg.inputId);
    if (!select || !input) return { isNew: false, value: '' };

    if (select.value === '__NEW_CATEGORY__') {
        return { isNew: true, value: input.value.trim() };
    }
    return { isNew: false, value: select.value.trim() };
}

document.addEventListener('click', (e) => {
    const selector = document.getElementById('headerCategorySelector');
    const menu = document.getElementById('categoryDropdownMenu');
    if (selector && menu && !selector.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

function toggleCategoryDropdown(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('categoryDropdownMenu');
    if (menu) menu.classList.toggle('hidden');
}

function updateCategorySelects() {
    const cats = getAllCategories();
    const catAllText = tr('catAll', '全部字庫');
    const defaultCatName = tr('defaultCategoryName', '預設字庫');
    const noCatText = tr('noCategorySelected', '未選取字庫');
    const selectedPrefix = tr('selectedPrefix', '已選');
    const unitDeck = tr('unitDeck', '個字庫');
    const unitText = tr('unitWord', '字');

    const catCountMap = {};
    if (Array.isArray(wordList)) {
        for (let i = 0; i < wordList.length; i++) {
            const c = (wordList[i].category && wordList[i].category.trim() !== '')
                ? wordList[i].category.trim()
                : defaultCatName;
            catCountMap[c] = (catCountMap[c] || 0) + 1;
        }
    }

    let activeCats = window.selectedCategories || ['ALL'];

    const hadAll = activeCats.includes('ALL');
    const prevSubCats = activeCats.filter(c => c !== 'ALL');
    const validSubCats = prevSubCats.filter(c => cats.includes(c));

    if (hadAll) {
        if (validSubCats.length !== prevSubCats.length) {
            activeCats = ['ALL', ...cats];
            window.selectedCategories = activeCats;
            if (typeof saveSelectedCategoriesToCloud === 'function') {
                saveSelectedCategoriesToCloud(activeCats);
            }
        }
    } else if (validSubCats.length !== prevSubCats.length) {
        activeCats = validSubCats.length > 0 ? validSubCats : ['ALL'];
        window.selectedCategories = activeCats;
        if (typeof saveSelectedCategoriesToCloud === 'function') {
            saveSelectedCategoriesToCloud(activeCats);
        }
    }

    const menu = document.getElementById('categoryDropdownMenu');
    const btnText = document.getElementById('categoryDropdownBtnText');

    const isAllChecked = activeCats.includes('ALL') || (cats.length > 0 && cats.every(c => activeCats.includes(c)));

    if (menu) {
        let html = `
            <label class="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer font-bold text-slate-800 dark:text-slate-100">
                <input type="checkbox" value="ALL" ${isAllChecked ? 'checked' : ''} onchange="handleCategoryCheckboxChange(this)" class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500">
                <span>${catAllText} (${wordList.length} ${unitText})</span>
            </label>
            <div class="border-t border-slate-100 dark:border-slate-700 my-1"></div>
        `;

        cats.forEach(c => {
            const count = catCountMap[c] || 0;
            const isChecked = isAllChecked || activeCats.includes(c);
            html += `
                <label class="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-slate-700 dark:text-slate-200">
                    <input type="checkbox" value="${c}" ${isChecked ? 'checked' : ''} onchange="handleCategoryCheckboxChange(this)" class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500">
                    <span class="truncate">${c} (${count} ${unitText})</span>
                </label>
            `;
        });
        menu.innerHTML = html;
    }

    if (btnText) {
        if (isAllChecked) {
            btnText.innerText = catAllText;
        } else if (activeCats.length === 0) {
            btnText.innerText = noCatText;
        } else if (activeCats.length === 1) {
            btnText.innerText = activeCats[0];
        } else {
            btnText.innerText = `${selectedPrefix} ${activeCats.length} ${unitDeck}`;
        }
    }

    const exportSelect = document.getElementById('exportCategorySelect');
    if (exportSelect) {
        const exportAllText = tr('optExportAll', '包含全部字庫');
        exportSelect.innerHTML = `<option value="ALL">${exportAllText}</option>` + 
            cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const splitSelect = document.getElementById('splitTargetCategorySelect');
    if (splitSelect) {
        splitSelect.innerHTML = cats.map(c => {
            const count = catCountMap[c] || 0;
            return `<option value="${c}">${c} (${count} ${unitText})</option>`;
        }).join('');
    }
}

function handleCategoryCheckboxChange(checkbox) {
    const val = checkbox.value;
    const cats = getAllCategories();
    let activeCats = [...(window.selectedCategories || [])];

    let currentSubCats = activeCats.filter(c => c !== 'ALL');

    if (val === 'ALL') {
        if (checkbox.checked) {
            activeCats = ['ALL', ...cats];
        } else {
            activeCats = [];
        }
    } else {
        if (checkbox.checked) {
            if (!currentSubCats.includes(val)) currentSubCats.push(val);
            if (cats.length > 0 && cats.every(c => currentSubCats.includes(c))) {
                activeCats = ['ALL', ...currentSubCats];
            } else {
                activeCats = [...currentSubCats];
            }
        } else {
            currentSubCats = currentSubCats.filter(c => c !== val);
            activeCats = [...currentSubCats];
        }
    }

    window.selectedCategories = activeCats;
    if (typeof saveSelectedCategoriesToCloud === 'function') {
        saveSelectedCategoriesToCloud(activeCats);
    }

    selectedWordIds.clear();
    ratingUndoStack = [];
    updateUndoButtonUI();
    wordListRenderLimit = 100;
    updateUI();
    nextCard(true);
}

window.addEventListener('DOMContentLoaded', async () => {
    if (typeof loadStorage === 'function') {
        await loadStorage();
    }
    updateUserCoinsUI();
    updateUndoButtonUI();

    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            if (user && typeof initChatRealtimeListeners === 'function') {
                initChatRealtimeListeners();
            }
        });
    }
});

function updateStudyQueueUI() {
    if (typeof refreshFSRSUIBadges === 'function') {
        refreshFSRSUIBadges();
    }

    // 同步更新輪播頁籤的排程 / 自由加練切換按鈕多語系狀態
    const sessionBadge = document.getElementById('fsrsSessionBadge');
    if (sessionBadge) {
        const isFree = isFreePracticeActive();
        const spanEl = sessionBadge.querySelector('span');
        if (isFree) {
            sessionBadge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer';
            if (spanEl) {
                spanEl.setAttribute('data-i18n', 'fsrsFreeBadge');
                spanEl.innerText = tr('fsrsFreeBadge', '自由加練中');
            }
        } else {
            sessionBadge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800 transition cursor-pointer';
            if (spanEl) {
                spanEl.setAttribute('data-i18n', 'fsrsScheduleBadge');
                spanEl.innerText = tr('fsrsScheduleBadge', 'FSRS 排程');
            }
        }
    }

    if (typeof getStudyQueueSummary !== 'function') return;
    const summary = getStudyQueueSummary();
    const badge = document.getElementById('studyQueueBadge');
    if (!badge) return;

    if (summary.totalCount === 0) {
        badge.classList.add('hidden');
        return;
    }

    badge.classList.remove('hidden');
    if (summary.isFreePractice) {
        badge.className = 'inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
        badge.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>${tr('studyQueueDone', '今日進度已完成（自由加練模式）')}</span>`;
    } else {
        badge.className = 'inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
        badge.innerHTML = `<i class="fa-solid fa-clock"></i><span>${tr('studyQueueSummary', '待複習 {due} · 新字 {newCount}', { due: summary.dueCount, newCount: summary.newCount })}</span>`;
    }
}

function updateUI() {
    const defaultCatName = tr('defaultCategoryName', '預設字庫');
    const activeCats = window.selectedCategories || [];
    const isAll = activeCats.includes("ALL");
    const activeSet = isAll ? null : new Set(activeCats);

    let count = 0;
    if (typeof getDeduplicatedActiveWords === 'function') {
        count = getDeduplicatedActiveWords().length;
    } else if (Array.isArray(wordList)) {
        if (isAll) {
            count = wordList.length;
        } else {
            for (let i = 0; i < wordList.length; i++) {
                if (activeSet.has(wordList[i].category || defaultCatName)) {
                    count++;
                }
            }
        }
    }

    const totalWordCountElem = document.getElementById('totalWordCount');
    if (totalWordCountElem) totalWordCountElem.innerText = wordList.length;

    const cardCountDisplayElem = document.getElementById('cardCountDisplay');
    if (cardCountDisplayElem) cardCountDisplayElem.innerText = count;

    if (typeof applyLanguageUI === 'function') applyLanguageUI();
    if (typeof updateCategorySelects === 'function') updateCategorySelects();

    updateEmptyNoticeState(count);
    updateStudyQueueUI();
    updateUserCoinsUI();
    updateUndoButtonUI();

    if (currentTab === 'list') {
        renderWordList(false);
    }
    if (currentTab === 'stats' && typeof renderStats === 'function') renderStats();
}

function updateEmptyNoticeState(precomputedCount) {
    const emptyNotice = document.getElementById('emptyNotice');
    if (!emptyNotice) return;

    const showOnTabs = ['home', 'list', 'flashcard', 'quiz'];
    if (!showOnTabs.includes(currentTab)) {
        emptyNotice.classList.add('hidden');
        return;
    }

    let isEmpty = true;
    if (typeof precomputedCount === 'number') {
        isEmpty = precomputedCount === 0;
    } else if (typeof wordList !== 'undefined' && Array.isArray(wordList) && wordList.length > 0) {
        const defaultCatName = tr('defaultCategoryName', '預設字庫');
        const activeCats = window.selectedCategories || [];
        if (activeCats.includes("ALL")) {
            isEmpty = false;
        } else {
            const activeSet = new Set(activeCats);
            isEmpty = !wordList.some(w => activeSet.has(w.category || defaultCatName));
        }
    }

    if (isEmpty) {
        emptyNotice.classList.remove('hidden');
    } else {
        emptyNotice.classList.add('hidden');
    }
}

/**
 * ⚡ 判斷目前是否處於「自由練習 / 考前臨時熟悉模式」
 */
function isFreePracticeActive() {
    if (window.isManualFreePractice) return true;
    if (!Array.isArray(wordList) || wordList.length === 0) return false;

    const activePool = (typeof getDeduplicatedActiveWords === 'function')
        ? getDeduplicatedActiveWords()
        : wordList.filter(w => {
            const activeCats = window.selectedCategories || ['ALL'];
            const defaultCatName = tr('defaultCategoryName', '預設字庫');
            return activeCats.includes('ALL') || activeCats.includes(w.category || defaultCatName);
        });

    if (activePool.length === 0) return false;
    const now = Date.now();
    const dueCount = activePool.filter(w => w.state && w.state !== 'new' && (w.nextReview || 0) <= now).length;
    const newCount = activePool.filter(w => !w.state || w.state === 'new').length;
    return dueCount === 0 && newCount === 0;
}

/**
 * 🃏 抽取或更新字卡 (force = true 代表使用者主動換卡)
 */
function nextCard(force = false) {
    const flashcardElem = document.getElementById('flashcard');
    const defaultCatName = tr('defaultCategoryName', '預設字庫');
    const activeCats = window.selectedCategories || ['ALL'];
    const isFreeMode = isFreePracticeActive();

    let shouldDrawNew = force || !currentCard;

    if (!shouldDrawNew && currentCard && Array.isArray(wordList)) {
        const targetWord = (currentCard.word || '').trim().toLowerCase();
        const matching = wordList.filter(w => {
            const matchWord = (w.word || '').trim().toLowerCase() === targetWord;
            const matchCat = activeCats.includes("ALL") || activeCats.includes(w.category || defaultCatName);
            return matchWord && matchCat;
        });

        if (matching.length > 0) {
            let best = matching[0];
            matching.forEach(c => {
                if (typeof compareCardProgress === 'function' && compareCardProgress(c, best) > 0) {
                    best = c;
                }
            });
            currentCard = best;
        } else {
            shouldDrawNew = true;
        }
    }

    if (shouldDrawNew) {
        if (flashcardElem) {
            flashcardElem.classList.add('no-transition');
            flashcardElem.classList.remove('rotate-y-180');
            void flashcardElem.offsetHeight;
            flashcardElem.classList.remove('no-transition');
        }
        currentCard = (isFreeMode && typeof getNextCardFreePractice === 'function')
            ? getNextCardFreePractice()
            : getNextCardSpacedRepetition();
    }

    updateStudyQueueUI();

    if (!currentCard) {
        if (document.getElementById('cardWord')) document.getElementById('cardWord').innerText = tr('noWordAvailable', '尚無單字');
        if (document.getElementById('cardPhonetic')) document.getElementById('cardPhonetic').innerText = "/---/";
        if (document.getElementById('cardPhoneticBack')) document.getElementById('cardPhoneticBack').innerText = "";
        if (document.getElementById('cardPosFront')) document.getElementById('cardPosFront').innerText = "EMPTY";
        if (document.getElementById('cardPosBack')) document.getElementById('cardPosBack').innerText = "EMPTY";
        if (document.getElementById('cardMeaning')) document.getElementById('cardMeaning').innerText = tr('selectOtherDeck', '請新增單字或切換字庫');
        if (document.getElementById('cardSentence')) document.getElementById('cardSentence').innerText = `"${tr('selectOtherDeck', '請新增單字或切換字庫')}"`;
        if (document.getElementById('cardTranslation')) document.getElementById('cardTranslation').innerText = "";
        return;
    }

    if (typeof migrateCardFSRS === 'function') {
        migrateCardFSRS(currentCard);
    }

    const fsrsLvNum = currentCard.level || 1;
    const freeLvNum = currentCard.freeLevel || 1;
    const fsrsLvInfo = getLevelInfo(fsrsLvNum);
    const rawFreeInfo = (typeof getFreeLevelInfo === 'function')
        ? getFreeLevelInfo(freeLvNum)
        : { color: 'bg-slate-100 text-slate-600 border-slate-200' };
    const freeLvInfo = {
        name: getLocalizedFreeLevelName(freeLvNum),
        color: rawFreeInfo.color
    };

    const primaryLvInfo = isFreeMode ? freeLvInfo : fsrsLvInfo;
    const secondaryLvInfo = isFreeMode
        ? { name: tr('fsrsLevelShort', 'FSRS Lv.{lv}', { lv: fsrsLvNum }), color: fsrsLvInfo.color }
        : freeLvInfo;

    const streak = isFreeMode ? (currentCard.freeStreak || 0) : (currentCard.knowStreak || 0);
    const intervals = (isFreeMode && typeof previewFreePracticeTransitions === 'function')
        ? previewFreePracticeTransitions(currentCard)
        : ((typeof previewNextIntervals === 'function')
            ? previewNextIntervals(currentCard)
            : {
                1: tr('fsrsInterval10m', '10 分鐘後'),
                2: tr('fsrsInterval10m', '10 分鐘後'),
                3: tr('fsrsInterval10m', '10 分鐘後'),
                4: tr('fsrsInterval4d', '4 天後')
            });

    const streakTextElem = document.getElementById('knowStreakText');
    if (streakTextElem) {
        if (!isFreeMode && currentCard.state === 'review') {
            streakTextElem.innerText = intervals[3];
        } else {
            streakTextElem.innerText = `${streak}/2`;
        }
    }

    [1, 2, 3, 4].forEach(rating => {
        const hintEl = document.getElementById(`intervalHint${rating}`) || document.getElementById(`fsrsPreview${rating}`);
        if (hintEl) hintEl.innerText = intervals[rating] || '';
    });

    const memoryMetaEl = document.getElementById('cardMemoryMeta');
    if (memoryMetaEl) {
        const lapses = currentCard.lapses || 0;
        if (lapses >= 2) {
            memoryMetaEl.innerText = tr('cardLapseBadge', '易忘 ×{count}', { count: lapses });
            memoryMetaEl.classList.remove('hidden');
        } else if (currentCard.state === 'review' && currentCard.stability >= 1) {
            memoryMetaEl.innerText = tr('cardStabilityBadge', '記憶穩定 {days}天', { days: Math.round(currentCard.stability) });
            memoryMetaEl.classList.remove('hidden');
        } else {
            memoryMetaEl.classList.add('hidden');
        }
    }

    const displayMode = localStorage.getItem('lzhcard_display_mode') || 'target_front';
    const wordText = currentCard.word || '';
    const meaningText = currentCard.meaning || '';

    const frontWordElem = document.getElementById('cardWord');
    const backMeaningElem = document.getElementById('cardMeaning');

    if (displayMode === 'native_front') {
        if (frontWordElem) frontWordElem.innerText = meaningText || tr('noMeaning', '未設定釋義');
        if (backMeaningElem) backMeaningElem.innerText = wordText;
    } else if (displayMode === 'both_front') {
        if (frontWordElem) frontWordElem.innerHTML = `${wordText}<div class="text-xl sm:text-2xl font-medium text-amber-500 dark:text-amber-400 mt-2">${meaningText}</div>`;
        if (backMeaningElem) backMeaningElem.innerText = `${wordText} - ${meaningText}`;
    } else {
        if (frontWordElem) frontWordElem.innerText = wordText;
        if (backMeaningElem) backMeaningElem.innerText = meaningText;
    }

    const phoneticPos = localStorage.getItem('lzhcard_phonetic_pos') || 'front';
    const frontPhonetic = document.getElementById('cardPhonetic');
    const backPhonetic = document.getElementById('cardPhoneticBack');

    if (phoneticPos === 'back') {
        if (frontPhonetic) frontPhonetic.innerText = '';
        if (backPhonetic) backPhonetic.innerText = currentCard.phonetic ? `[ ${currentCard.phonetic} ]` : '';
    } else {
        if (frontPhonetic) frontPhonetic.innerText = currentCard.phonetic || '/---/';
        if (backPhonetic) backPhonetic.innerText = '';
    }

    const syncSecondaryBadge = (anchorEl, badgeId, info) => {
        if (!anchorEl || !anchorEl.parentNode) return;
        let altEl = document.getElementById(badgeId);
        if (!altEl) {
            altEl = document.createElement('span');
            altEl.id = badgeId;
            anchorEl.insertAdjacentElement('afterend', altEl);
        }
        altEl.innerText = info.name;
        altEl.className = `ml-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border opacity-90 ${info.color}`;
    };

    if (document.getElementById('cardPosFront')) document.getElementById('cardPosFront').innerText = currentCard.pos || 'N/A';
    
    const levelFront = document.getElementById('cardLevelFront');
    if (levelFront) {
        levelFront.innerText = isFreeMode ? primaryLvInfo.name : `${currentCard.category || defaultCatName} | ${primaryLvInfo.name}`;
        levelFront.className = `px-2.5 py-1 rounded-full text-xs font-bold border ${primaryLvInfo.color}`;
        syncSecondaryBadge(levelFront, 'cardAltLevelFront', secondaryLvInfo);
    }

    if (document.getElementById('cardPosBack')) document.getElementById('cardPosBack').innerText = currentCard.pos || 'N/A';
    const levelBack = document.getElementById('cardLevelBack');
    if (levelBack) {
        levelBack.innerText = isFreeMode ? primaryLvInfo.name : `${currentCard.category || defaultCatName} | ${primaryLvInfo.name}`;
        levelBack.className = `px-2.5 py-1 rounded-full text-xs font-bold border ${primaryLvInfo.color}`;
        syncSecondaryBadge(levelBack, 'cardAltLevelBack', secondaryLvInfo);
    }

    if (document.getElementById('cardSentence')) document.getElementById('cardSentence').innerText = currentCard.sentence ? `"${currentCard.sentence}"` : `"${tr('noSentence', '暫無例句')}"`;
    if (document.getElementById('cardTranslation')) document.getElementById('cardTranslation').innerText = currentCard.translation || '';

    if (typeof refreshFSRSUIBadges === 'function') {
        refreshFSRSUIBadges();
    }
}

/**
 * 📸 評分前建立單字記憶狀態快照（支援誤按還原）
 */
function pushRatingSnapshot(card) {
    if (!card || !Array.isArray(wordList)) return;
    const normWord = (card.word || '').trim().toLowerCase();
    const affectedCards = normWord
        ? wordList.filter(w => (w.word || '').trim().toLowerCase() === normWord)
        : [card];

    const records = affectedCards.map(w => ({
        id: w.id,
        level: w.level,
        knowStreak: w.knowStreak,
        state: w.state,
        stability: w.stability,
        difficulty: w.difficulty,
        reps: w.reps,
        lapses: w.lapses,
        lastReview: w.lastReview,
        nextReview: w.nextReview,
        updatedAt: w.updatedAt,
        freeLevel: w.freeLevel,
        freeStreak: w.freeStreak
    }));

    ratingUndoStack.push({
        cardId: card.id,
        word: card.word,
        records
    });

    if (ratingUndoStack.length > MAX_UNDO_STEPS) {
        ratingUndoStack.shift();
    }
    updateUndoButtonUI();
}

/**
 * ↩️ 誤按還原上一步評分（對應 index.html 的 handleUndoLastCard）
 */
function handleUndoLastCard() {
    if (ratingUndoStack.length === 0) {
        showToast(tr('toastNothingToUndo', '目前沒有可還原的評分紀錄！'), 'info');
        return;
    }

    const snapshot = ratingUndoStack.pop();
    updateUndoButtonUI();

    if (Array.isArray(wordList) && Array.isArray(snapshot.records)) {
        snapshot.records.forEach(rec => {
            const target = wordList.find(w => w.id === rec.id);
            if (target) {
                target.level = rec.level;
                target.knowStreak = rec.knowStreak;
                target.state = rec.state;
                target.stability = rec.stability;
                target.difficulty = rec.difficulty;
                target.reps = rec.reps;
                target.lapses = rec.lapses;
                target.lastReview = rec.lastReview;
                target.nextReview = rec.nextReview;
                target.updatedAt = rec.updatedAt;
                target.freeLevel = rec.freeLevel;
                target.freeStreak = rec.freeStreak;
            }
        });
    }

    const restoredCard = wordList.find(w => w.id === snapshot.cardId);
    if (restoredCard) {
        currentCard = restoredCard;
        const flashcardElem = document.getElementById('flashcard');
        if (flashcardElem) {
            flashcardElem.classList.add('no-transition');
            flashcardElem.classList.remove('rotate-y-180');
            void flashcardElem.offsetHeight;
            flashcardElem.classList.remove('no-transition');
        }
    }

    saveStorage();
    updateUI();
    nextCard(false);
    showToast(tr('toastUndoSuccess', '↩️ 已還原【{word}】的評分進度！', { word: snapshot.word || '' }), 'info');
}

const undoLastCardRating = handleUndoLastCard;

/**
 * 🔄 批次還原已勾選單字的記憶進度（同時歸零 FSRS 與自由練習臨時等級）
 */
function handleBatchResetProgress() {
    if (selectedWordIds.size === 0) {
        showToast(tr('toastSelectResetWords', '請先勾選要還原進度的單字！'), 'warning');
        return;
    }

    if (!confirm(tr('confirmBatchReset', '確定要將已勾選的 {count} 筆單字記憶進度還原為 Lv.1（新單字）嗎？', { count: selectedWordIds.size }))) {
        return;
    }

    const now = Date.now();
    const targetSpellings = new Set();

    wordList.forEach(w => {
        if (selectedWordIds.has(w.id) && w.word) {
            targetSpellings.add(w.word.trim().toLowerCase());
        }
    });

    let resetCount = 0;
    wordList.forEach(w => {
        if (!w || typeof w !== 'object') return;
        const normWord = (w.word || '').trim().toLowerCase();
        if (selectedWordIds.has(w.id) || (normWord && targetSpellings.has(normWord))) {
            w.level = 1;
            w.knowStreak = 0;
            w.state = 'new';
            w.stability = 0;
            w.difficulty = 5.5;
            w.reps = 0;
            w.lapses = 0;
            w.lastReview = 0;
            w.nextReview = 0;
            w.freeLevel = 1;
            w.freeStreak = 0;
            w.updatedAt = now;
            if (selectedWordIds.has(w.id)) resetCount++;
        }
    });

    ratingUndoStack = [];
    selectedWordIds.clear();

    saveStorage();
    updateUI();
    if (currentCard) nextCard(false);
    showToast(tr('toastBatchResetSuccess', '🔄 已將 {count} 筆單字的記憶進度還原為 Lv.1 新單字！', { count: resetCount }), 'success');
}

/**
 * ⚡ 批次重置已勾選單字的「自由練習臨時等級」（完全不影響 FSRS 排程）
 */
function handleBatchResetFreeLevel() {
    if (selectedWordIds.size === 0) {
        showToast(tr('toastSelectResetFreeWords', '請先勾選要重置臨時等級的單字！'), 'warning');
        return;
    }

    if (!confirm(tr('confirmBatchResetFree', '確定要將已勾選的 {count} 筆單字「自由練習臨時等級」重置為 Lv.1 嗎？（不會影響 FSRS 排程）', { count: selectedWordIds.size }))) {
        return;
    }

    const now = Date.now();
    const targetSpellings = new Set();

    wordList.forEach(w => {
        if (selectedWordIds.has(w.id) && w.word) {
            targetSpellings.add(w.word.trim().toLowerCase());
        }
    });

    let resetCount = 0;
    wordList.forEach(w => {
        if (!w || typeof w !== 'object') return;
        const normWord = (w.word || '').trim().toLowerCase();
        if (selectedWordIds.has(w.id) || (normWord && targetSpellings.has(normWord))) {
            w.freeLevel = 1;
            w.freeStreak = 0;
            w.updatedAt = now;
            if (selectedWordIds.has(w.id)) resetCount++;
        }
    });

    selectedWordIds.clear();

    saveStorage();
    updateUI();
    if (currentCard) nextCard(false);
    showToast(tr('toastBatchResetFreeSuccess', '⚡ 已將 {count} 筆單字的自由練習等級重置為 臨時 Lv.1！', { count: resetCount }), 'success');
}

/**
 * 🔄 重置所有單字的「記憶進度、等級與權重」，完整保留單字、詞性、音標、釋義與例句
 */
function handleResetLearningProgress() {
    if (!Array.isArray(wordList) || wordList.length === 0) {
        showToast(tr('noWordAvailable', '尚無單字'), 'warning');
        return;
    }

    const confirmMsg = tr(
        'confirmResetProgress',
        '確定要將所有單字的「記憶進度、等級與權重」全部歸零嗎？\n（放心：單字、詞性、音標、釋義與例句都會完整保留）'
    );

    if (!confirm(confirmMsg)) return;

    const now = Date.now();
    let resetCount = 0;

    wordList.forEach(w => {
        if (!w || typeof w !== 'object') return;
        w.level = 1;
        w.knowStreak = 0;
        w.state = 'new';
        w.stability = 0;
        w.difficulty = 5.5;
        w.reps = 0;
        w.lapses = 0;
        w.lastReview = 0;
        w.nextReview = 0;
        w.freeLevel = 1;
        w.freeStreak = 0;
        w.updatedAt = now;
        resetCount++;
    });

    if (typeof resetFSRSMemoryPools === 'function') {
        resetFSRSMemoryPools();
    }
    if (typeof resetFreePracticeLevels === 'function') {
        resetFreePracticeLevels(['ALL']);
    }

    ratingUndoStack = [];
    currentCard = null;

    saveStorage();
    updateUI();
    nextCard(true);
    showToast(tr('toastProgressReset', '已重置 {count} 個單字的記憶進度與權重！', { count: resetCount }), 'success');
}

/**
 * 🧠 統一處理卡片記憶評分回饋（1: 不熟悉 | 2: 模糊 | 3: 已掌握 | 4: 秒答）
 */
function handleCardRating(rating, e) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (isCardActionLocked || !currentCard) return;
    isCardActionLocked = true;
    setTimeout(() => { isCardActionLocked = false; }, 60);

    if (e && e.currentTarget) e.currentTarget.blur();
    else if (document.activeElement) document.activeElement.blur();

    // 評分前先備份狀態快照，供誤按還原使用
    pushRatingSnapshot(currentCard);

    if (isFreePracticeActive() && typeof recordFreePracticeReview === 'function') {
        recordFreePracticeReview(currentCard, rating);
        const targetWord = (currentCard.word || '').trim().toLowerCase();
        if (Array.isArray(wordList)) {
            wordList.forEach(w => {
                if ((w.word || '').trim().toLowerCase() === targetWord) {
                    w.freeLevel = currentCard.freeLevel;
                    w.freeStreak = currentCard.freeStreak;
                    w.updatedAt = currentCard.updatedAt || Date.now();
                }
            });
        }
    } else if (typeof recordCardReview === 'function') {
        recordCardReview(currentCard, rating);
    } else {
        const targetWord = (currentCard.word || '').trim().toLowerCase();
        wordList.forEach(w => {
            if ((w.word || '').trim().toLowerCase() === targetWord) {
                if (rating === 1) {
                    w.level = Math.max(1, (w.level || 1) - 1);
                    w.knowStreak = 0;
                } else {
                    w.knowStreak = (w.knowStreak || 0) + 1;
                    if (w.knowStreak >= 2 && (w.level || 1) < 5) {
                        w.level = (w.level || 1) + 1;
                        w.knowStreak = 0;
                    }
                }
                w.updatedAt = Date.now();
            }
        });
    }

    saveStorage();
    updateUI();
    nextCard(true);
}

function handleDontKnow(e) {
    handleCardRating(1, e);
}

function handleHard(e) {
    handleCardRating(2, e);
}

function handleKnow(e) {
    handleCardRating(3, e);
}

function handleEasy(e) {
    handleCardRating(4, e);
}

function flipCard() {
    const flashcardElem = document.getElementById('flashcard');
    if (flashcardElem) flashcardElem.classList.toggle('rotate-y-180');
}

function speakWord() {
    if (!currentCard || !currentCard.word) return;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(currentCard.word);
        const targetLang = localStorage.getItem('user_target_lang') || localStorage.getItem('lzhcard_target_lang') || 'en';
        if (targetLang === 'ja') {
            utterance.lang = 'ja-JP';
        } else if (targetLang === 'zh-TW') {
            utterance.lang = 'zh-TW';
        } else {
            utterance.lang = 'en-US';
        }
        window.speechSynthesis.speak(utterance);
    }
}

function switchTab(tab) {
    currentTab = tab;

    const secHome = document.getElementById('sec-home');
    const secFlashcard = document.getElementById('sec-flashcard');
    const secQuiz = document.getElementById('sec-quiz');
    const secList = document.getElementById('sec-list');
    const secStore = document.getElementById('sec-store');
    const secSettings = document.getElementById('sec-settings');
    const secStats = document.getElementById('sec-stats');

    const bnavHome = document.getElementById('bnav-home');
    const bnavList = document.getElementById('bnav-list');
    const bnavStore = document.getElementById('bnav-store');
    const bnavSettings = document.getElementById('bnav-settings');
    const bnavStats = document.getElementById('bnav-stats');

    const catSelector = document.getElementById('headerCategorySelector');
    if (catSelector) {
        if (tab === 'store' || tab === 'settings') {
            catSelector.classList.add('hidden');
        } else {
            catSelector.classList.remove('hidden');
        }
    }

    [secHome, secFlashcard, secQuiz, secList, secStore, secSettings, secStats].forEach(el => el && el.classList.add('hidden'));

    [bnavHome, bnavList, bnavStore, bnavSettings, bnavStats].forEach(el => {
        if (el) el.className = "flex flex-col items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 space-y-1 transition";
    });

    const header = document.getElementById('main-header');
    const bottomNav = document.getElementById('bottom-nav');
    if (header) header.classList.remove('hidden');
    if (bottomNav) bottomNav.classList.remove('hidden');

    if (tab === 'home') {
        if (secHome) secHome.classList.remove('hidden');
        if (bnavHome) bnavHome.className = "flex flex-col items-center justify-center text-brand-600 dark:text-brand-400 space-y-1 font-bold";
        updateStudyQueueUI();
    } else if (tab === 'list') {
        if (secList) secList.classList.remove('hidden');
        if (bnavList) bnavList.className = "flex flex-col items-center justify-center text-brand-600 dark:text-brand-400 space-y-1 font-bold";
        renderWordList();
    } else if (tab === 'store') {
        if (secStore) secStore.classList.remove('hidden');
        if (bnavStore) bnavStore.className = "flex flex-col items-center justify-center text-brand-600 dark:text-brand-400 space-y-1 font-bold";
        if (typeof renderStore === 'function') renderStore();
        updateUserCoinsUI();
    } else if (tab === 'settings') {
        if (secSettings) secSettings.classList.remove('hidden');
        if (bnavSettings) bnavSettings.className = "flex flex-col items-center justify-center text-brand-600 dark:text-brand-400 space-y-1 font-bold";
    } else if (tab === 'stats') {
        if (secStats) secStats.classList.remove('hidden');
        if (bnavStats) bnavStats.className = "flex flex-col items-center justify-center text-brand-600 dark:text-brand-400 space-y-1 font-bold";
        if (typeof renderStats === 'function') renderStats();
    }

    updateEmptyNoticeState();
}

function startFocusMode(mode) {
    currentTab = mode;
    const header = document.getElementById('main-header');
    const bottomNav = document.getElementById('bottom-nav');

    if (header) header.classList.add('hidden');
    if (bottomNav) bottomNav.classList.add('hidden');

    const secHome = document.getElementById('sec-home');
    if (secHome) secHome.classList.add('hidden');

    if (mode === 'flashcard') {
        const secFlashcard = document.getElementById('sec-flashcard');
        if (secFlashcard) secFlashcard.classList.remove('hidden');
        nextCard(true);
    } else if (mode === 'quiz') {
        const secQuiz = document.getElementById('sec-quiz');
        if (secQuiz) secQuiz.classList.remove('hidden');
        if (typeof nextQuizQuestion === 'function') nextQuizQuestion();
    }

    updateEmptyNoticeState();
}

if (typeof window.startFreePracticeMode !== 'function') {
    window.startFreePracticeMode = function () {
        window.isManualFreePractice = true;
        startFocusMode('flashcard');
    };
}

if (typeof window.toggleFreePracticeMode !== 'function') {
    window.toggleFreePracticeMode = function () {
        window.isManualFreePractice = !window.isManualFreePractice;
        updateStudyQueueUI();
        nextCard(true);
    };
}

function exitFocusMode() {
    window.isManualFreePractice = false;
    switchTab('home');
}

/**
 * ⚡ 動態注入與更新字庫排序選單中的「自由練習臨時等級」選項（支援即時 i18n）
 */
function ensureFreeLevelSortOptions() {
    const sortSelect = document.getElementById('sortSelect');
    if (!sortSelect) return;

    let group = document.getElementById('sortGroupFreeLevel');
    if (!group) {
        group = document.createElement('optgroup');
        group.id = 'sortGroupFreeLevel';
        sortSelect.appendChild(group);
    }

    group.label = tr('optGroupFreeLevel', '⚡ 自由練習臨時等級');
    group.innerHTML = `
        <option value="free-level-asc">${tr('optSortFreeAsc', '自由練習：臨時 Lv.1 → Lv.5')}</option>
        <option value="free-level-desc">${tr('optSortFreeDesc', '自由練習：臨時 Lv.5 → Lv.1')}</option>
        <option value="only_free_level_1">${tr('optOnlyFreeLv1', '僅顯示：臨時 Lv.1')}</option>
        <option value="only_free_level_2">${tr('optOnlyFreeLv2', '僅顯示：臨時 Lv.2')}</option>
        <option value="only_free_level_3">${tr('optOnlyFreeLv3', '僅顯示：臨時 Lv.3')}</option>
        <option value="only_free_level_4">${tr('optOnlyFreeLv4', '僅顯示：臨時 Lv.4')}</option>
        <option value="only_free_level_5">${tr('optOnlyFreeLv5', '僅顯示：臨時 Lv.5')}</option>
    `;
}

/**
 * ⚡ 動態注入與更新批次工具列的「重置臨時等級」按鈕（支援即時 i18n）
 */
function ensureBatchFreeResetButton() {
    const resetBtn = document.querySelector('[onclick*="handleBatchResetProgress"]');
    if (!resetBtn || !resetBtn.parentNode) return;

    let btn = document.getElementById('batchResetFreeLevelBtn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'batchResetFreeLevelBtn';
        btn.type = 'button';
        btn.onclick = handleBatchResetFreeLevel;
        btn.className = resetBtn.className;
        resetBtn.insertAdjacentElement('afterend', btn);
    }
    btn.innerText = tr('btnBatchResetFree', '重置臨時等級');
}

function getFilteredWords() {
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const defaultCatName = tr('defaultCategoryName', '預設字庫');
    const noMeaningText = tr('noMeaning', '未設定釋義');

    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const sortBy = sortSelect ? sortSelect.value : 'default';
    const activeCats = window.selectedCategories || [];

    const isMissing = (item, field) => {
        if (field === 'meaning') return !item.meaning || !item.meaning.trim() || item.meaning === noMeaningText;
        return !item[field] || !String(item[field]).trim();
    };

    let filtered = wordList.filter(item => {
        const matchesSearch = !search ||
            (item.word || '').toLowerCase().includes(search) ||
            (item.meaning && item.meaning.toLowerCase().includes(search)) ||
            (item.category && item.category.toLowerCase().includes(search)) ||
            (item.pos && item.pos.toLowerCase().includes(search));
            
        const itemCat = item.category || defaultCatName;
        let matchesCategory = activeCats.includes("ALL") || activeCats.includes(itemCat);

        if (sortBy === 'only_missing_meaning' && !isMissing(item, 'meaning')) return false;
        if (sortBy === 'only_missing_sentence' && !isMissing(item, 'sentence')) return false;
        if (sortBy === 'only_missing_pos' && !isMissing(item, 'pos')) return false;
        if (sortBy === 'only_missing_phonetic' && !isMissing(item, 'phonetic')) return false;

        // 僅顯示指定 FSRS 記憶等級 (Lv.1 ~ Lv.5)
        if (sortBy.startsWith('only_level_')) {
            const targetLv = parseInt(sortBy.replace('only_level_', ''), 10);
            if ((item.level || 1) !== targetLv) return false;
        }

        // 僅顯示指定自由練習臨時等級 (臨時 Lv.1 ~ Lv.5)
        if (sortBy.startsWith('only_free_level_')) {
            const targetFreeLv = parseInt(sortBy.replace('only_free_level_', ''), 10);
            if ((item.freeLevel || 1) !== targetFreeLv) return false;
        }

        return matchesSearch && matchesCategory;
    });

    filtered.sort((a, b) => {
        if (sortBy === 'missing_meaning_first') return (isMissing(b, 'meaning') ? 1 : 0) - (isMissing(a, 'meaning') ? 1 : 0);
        if (sortBy === 'missing_sentence_first') return (isMissing(b, 'sentence') ? 1 : 0) - (isMissing(a, 'sentence') ? 1 : 0);
        if (sortBy === 'missing_pos_first') return (isMissing(b, 'pos') ? 1 : 0) - (isMissing(a, 'pos') ? 1 : 0);
        if (sortBy === 'missing_phonetic_first') return (isMissing(b, 'phonetic') ? 1 : 0) - (isMissing(a, 'phonetic') ? 1 : 0);

        if (search && sortBy === 'default') {
            const wA = (a.word || '').toLowerCase();
            const wB = (b.word || '').toLowerCase();

            const aStarts = wA.startsWith(search);
            const bStarts = wB.startsWith(search);

            if (wA === search && wB !== search) return -1;
            if (wB === search && wA !== search) return 1;

            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            if (aStarts && bStarts && wA.length !== wB.length) {
                return wA.length - wB.length;
            }
        }

        if (sortBy === 'alpha-asc') return (a.word || '').localeCompare(b.word || '');
        if (sortBy === 'alpha-desc') return (b.word || '').localeCompare(a.word || '');
        if (sortBy === 'pos') return (a.pos || '').localeCompare(b.pos || '');
        if (sortBy === 'level-asc') return (a.level || 1) - (b.level || 1);
        if (sortBy === 'level-desc') return (b.level || 1) - (a.level || 1);
        if (sortBy === 'free-level-asc') return (a.freeLevel || 1) - (b.freeLevel || 1);
        if (sortBy === 'free-level-desc') return (b.freeLevel || 1) - (a.freeLevel || 1);

        return 0;
    });

    return filtered;
}

/**
 * ⚡ 在字庫列表直接點擊徽章循環切換自由練習等級 (1 -> 2 -> 3 -> 4 -> 5 -> 1)
 */
function cycleWordFreeLevel(id) {
    const item = wordList.find(w => w.id === id);
    if (!item) return;

    const currentFreeLv = Math.min(5, Math.max(1, item.freeLevel || 1));
    const nextFreeLv = currentFreeLv >= 5 ? 1 : currentFreeLv + 1;
    const now = Date.now();

    item.freeLevel = nextFreeLv;
    item.freeStreak = 0;
    item.updatedAt = now;

    if (typeof syncDuplicateWordsProgress === 'function') {
        syncDuplicateWordsProgress(item);
    }

    saveStorage();
    renderWordList(false);
    updateStudyQueueUI();
    showToast(
        tr('toastFreeLevelCycled', '【{word}】已調整為 {level}', {
            word: item.word,
            level: getLocalizedFreeLevelName(nextFreeLv)
        }),
        'info'
    );
}

function loadMoreWordList() {
    wordListRenderLimit += 100;
    renderWordList(false);
}

function renderWordList(resetLimit = true) {
    ensureFreeLevelSortOptions();
    ensureBatchFreeResetButton();

    const tbody = document.getElementById('wordTableBody');
    if (!tbody) return;

    if (resetLimit) {
        wordListRenderLimit = 100;
    }

    const defaultCatName = tr('defaultCategoryName', '預設字庫');
    const emptySearchResultText = tr('emptySearchResult', '查無符合條件的單字');
    const editTooltipText = tr('modalTitleEdit', '編輯單字');
    const deleteTooltipText = tr('btnBatchDelete', '刪除');
    const cycleFreeTooltipText = tr('titleCycleFreeLevel', '點擊直接切換自由練習等級');

    const escapeHtml = (str) => String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const filtered = getFilteredWords();
    window._cachedFilteredWords = filtered;

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-folder-open text-2xl mb-2 block"></i>
                    ${emptySearchResultText}
                </td>
            </tr>
        `;
    } else {
        const visibleItems = filtered.slice(0, wordListRenderLimit);
        const remainingCount = filtered.length - visibleItems.length;

        let rowsHtml = visibleItems.map(item => {
            const lvInfo = getLevelInfo(item.level || 1);
            const freeLvNum = item.freeLevel || 1;
            const rawFreeInfo = (typeof getFreeLevelInfo === 'function')
                ? getFreeLevelInfo(freeLvNum)
                : { color: 'bg-slate-100 text-slate-600 border-slate-200' };
            const freeLvText = getLocalizedFreeLevelName(freeLvNum);

            const isChecked = selectedWordIds.has(item.id) ? 'checked' : '';
            const safeId = escapeHtml(item.id);
            const catText = escapeHtml(item.category || defaultCatName);
            const stabilityDays = typeof item.stability === 'number' ? Math.round(item.stability * 10) / 10 : 0;
            const lapsesCount = item.lapses || 0;
            const lvTitle = tr('wordDualStabilityTooltip', 'FSRS 穩定度: {days} 天 | 遺忘: {lapses} 次 | 自由練習: {freeLv}', {
                days: stabilityDays,
                lapses: lapsesCount,
                freeLv: freeLvText
            });
            const leechMark = lapsesCount >= 2 ? `<span class="ml-1 text-[10px] font-bold text-rose-500">×${lapsesCount}</span>` : '';

            return `
                <tr class="group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                    <td class="py-3 px-2.5 whitespace-nowrap">
                        <input type="checkbox" value="${safeId}" ${isChecked} onchange="toggleSelectWord('${safeId}', this.checked)" class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer">
                    </td>
                    <td class="py-3 px-2.5 font-bold text-slate-900 dark:text-white max-w-[120px] sm:max-w-[190px] [overflow-wrap:anywhere]">
                        ${escapeHtml(item.word)}
                        <div class="text-xs font-mono font-normal text-slate-400 [overflow-wrap:anywhere]">${escapeHtml(item.phonetic)}</div>
                    </td>
                    <td class="py-3 px-2.5 whitespace-nowrap">
                        <span title="${catText}" class="inline-block max-w-[84px] sm:max-w-[130px] truncate align-bottom px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">${catText}</span>
                    </td>
                    <td class="py-3 px-2.5 whitespace-nowrap" title="${escapeHtml(lvTitle)}">
                        <div class="flex flex-col items-start gap-1">
                            <div>
                                <span class="px-2 py-0.5 rounded text-xs font-semibold ${lvInfo.color} border">${lvInfo.name}</span>${leechMark}
                            </div>
                            <button type="button" onclick="cycleWordFreeLevel('${safeId}')" title="${escapeHtml(cycleFreeTooltipText)}" class="px-1.5 py-0.5 rounded text-[10px] font-semibold ${rawFreeInfo.color} border hover:opacity-80 active:scale-95 transition cursor-pointer">
                                ${escapeHtml(freeLvText)} <i class="fa-solid fa-rotate text-[9px] ml-0.5 opacity-70"></i>
                            </button>
                        </div>
                    </td>
                    <td class="py-3 px-2.5 font-medium text-slate-800 dark:text-slate-200 max-w-[140px] sm:max-w-xs [overflow-wrap:anywhere]">
                        ${escapeHtml(item.meaning)}
                    </td>
                    <td class="py-3 px-2.5 text-right whitespace-nowrap sticky right-0 bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700 shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.08)]">
                        <div class="inline-flex items-center justify-end gap-1">
                            <button type="button" onclick="editCard('${safeId}')" class="p-1.5 text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-600 rounded transition" title="${escapeHtml(editTooltipText)}">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button type="button" onclick="deleteCard('${safeId}')" class="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-600 rounded transition" title="${escapeHtml(deleteTooltipText)}">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (remainingCount > 0) {
            const loadMoreText = tr('btnLoadMoreWords', '顯示更多單字（還有 {count} 筆）', { count: remainingCount });
            rowsHtml += `
                <tr>
                    <td colspan="6" class="py-4 text-center">
                        <button type="button" onclick="loadMoreWordList()" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 transition">
                            ${loadMoreText}
                        </button>
                    </td>
                </tr>
            `;
        }

        tbody.innerHTML = rowsHtml;
    }

    updateBatchBadgeUI();
}

function toggleSelectWord(id, isChecked) {
    if (isChecked) {
        selectedWordIds.add(id);
    } else {
        selectedWordIds.delete(id);
    }
    updateBatchBadgeUI();
}

function toggleSelectAllWords(masterCheckbox) {
    const isChecked = masterCheckbox.checked;
    const filtered = getFilteredWords();

    filtered.forEach(item => {
        if (isChecked) {
            selectedWordIds.add(item.id);
        } else {
            selectedWordIds.delete(item.id);
        }
    });

    renderWordList(false);
}

function updateBatchBadgeUI() {
    const badge = document.getElementById('selectedCountBadge');
    const masterCheckbox = document.getElementById('selectAllCheckbox');
    const filtered = getFilteredWords();

    if (masterCheckbox) {
        const isAllSelected = filtered.length > 0 && filtered.every(item => selectedWordIds.has(item.id));
        masterCheckbox.checked = isAllSelected;
    }

    if (!badge) return;
    if (selectedWordIds.size > 0) {
        const unitItem = tr('unitItem', '筆');
        badge.innerText = `${selectedWordIds.size} ${unitItem}`;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

/* ==========================================================================
   ✏️ 單字新增與編輯表單控制
   ========================================================================== */

/**
 * ⚡ 動態建立與更新單字編輯視窗中的「自由練習臨時等級」選單（支援即時 i18n）
 */
function ensureFreeLevelFormField() {
    const levelSelect = document.getElementById('formLevel');
    if (!levelSelect) return;

    const wrapper = levelSelect.closest('div');
    if (!wrapper || !wrapper.parentNode) return;

    let freeWrapper = document.getElementById('formFreeLevelWrapper');
    if (!freeWrapper) {
        freeWrapper = wrapper.cloneNode(true);
        freeWrapper.id = 'formFreeLevelWrapper';
        const clonedSelect = freeWrapper.querySelector('select');
        if (clonedSelect) {
            clonedSelect.id = 'formFreeLevel';
            clonedSelect.removeAttribute('data-i18n');
        }
        wrapper.insertAdjacentElement('afterend', freeWrapper);
    }

    const labelEl = freeWrapper.querySelector('label');
    if (labelEl) {
        labelEl.removeAttribute('data-i18n');
        labelEl.setAttribute('for', 'formFreeLevel');
        labelEl.innerText = tr('labelFreeLevel', '⚡ 自由練習臨時等級 (臨時 Lv.1~5)');
    }

    const selectEl = document.getElementById('formFreeLevel');
    if (selectEl) {
        const prevVal = selectEl.value || '1';
        selectEl.innerHTML = `
            <option value="1">${tr('optFreeLv1', '臨時 Lv.1 - 高頻焦點池 (最多 6 字)')}</option>
            <option value="2">${tr('optFreeLv2', '臨時 Lv.2 - 次高頻焦點池 (最多 4 字)')}</option>
            <option value="3">${tr('optFreeLv3', '臨時 Lv.3 - 初步熟悉')}</option>
            <option value="4">${tr('optFreeLv4', '臨時 Lv.4 - 考前熟練')}</option>
            <option value="5">${tr('optFreeLv5', '臨時 Lv.5 - 完全掌握 (低頻抽考)')}</option>
        `;
        selectEl.value = prevVal;
    }
}

function editCard(id) {
    const item = wordList.find(w => w.id === id);
    if (!item) return;

    const defaultCatName = tr('defaultCategoryName', '預設字庫');
    const targetCat = item.category || defaultCatName;

    ensureFreeLevelFormField();

    document.getElementById('editCardId').value = item.id;
    if (typeof setCategorySelectorValue === 'function') {
        setCategorySelectorValue('form', targetCat);
    } else {
        document.getElementById('formCategory').value = targetCat;
    }
    document.getElementById('formWord').value = item.word || '';
    document.getElementById('formPos').value = item.pos || '';
    document.getElementById('formPhonetic').value = item.phonetic || '';
    document.getElementById('formMeaning').value = item.meaning || '';
    document.getElementById('formSentence').value = item.sentence || '';
    document.getElementById('formTranslation').value = item.translation || '';

    const levelSelect = document.getElementById('formLevel');
    if (levelSelect) levelSelect.value = item.level || 1;

    const freeLevelSelect = document.getElementById('formFreeLevel');
    if (freeLevelSelect) freeLevelSelect.value = item.freeLevel || 1;

    document.getElementById('cardModalTitle').innerText = tr('modalTitleEdit', '編輯單字');
    openModal('cardModal');
}

function deleteCard(id) {
    if (confirm(tr('confirmDeleteSingle', '確定要刪除此單字？'))) {
        wordList = wordList.filter(w => w.id !== id);
        selectedWordIds.delete(id);
        saveStorage();
        updateCategorySelects();
        updateUI();
        if (currentCard && currentCard.id === id) nextCard(true);
        showToast(tr('toastWordDeleted', '已刪除單字'), 'info');
    }
}

function handleClearAllWords() {
    if (confirm(tr('confirmClearAll', '確定要清空所有單字？'))) {
        wordList = [];
        selectedWordIds.clear();
        ratingUndoStack = [];
        saveStorage();
        updateCategorySelects();
        updateUI();
        nextCard(true);
        showToast(tr('toastDeckCleared', '單字庫已清空'), 'warning');
    }
}

function handleSaveCardForm(e) {
    e.preventDefault();

    const defaultCategoryName = tr('defaultCategoryName', '預設字庫');
    const defaultMeaningText = tr('noMeaning', '未設定釋義');

    const id = document.getElementById('editCardId').value;

    const catRes = (typeof getCategorySelectorValue === 'function')
        ? getCategorySelectorValue('form')
        : { isNew: false, value: document.getElementById('formCategory')?.value.trim() || '' };

    if (catRes.isNew && !catRes.value) {
        showToast(tr('toastEnterNewDeckName', '請輸入新字庫名稱！'), 'warning');
        document.getElementById('formCategory')?.focus();
        return;
    }
    const category = catRes.value || defaultCategoryName;

    const rawWord = document.getElementById('formWord').value.trim();
    const rawPos = document.getElementById('formPos').value.trim();
    const phonetic = document.getElementById('formPhonetic').value.trim();
    const rawMeaning = document.getElementById('formMeaning').value.trim() || defaultMeaningText;
    const sentence = document.getElementById('formSentence').value.trim();
    const translation = document.getElementById('formTranslation').value.trim();

    const levelElem = document.getElementById('formLevel');
    const level = levelElem ? (parseInt(levelElem.value, 10) || 1) : 1;

    const freeLevelElem = document.getElementById('formFreeLevel');
    const freeLevel = freeLevelElem ? (parseInt(freeLevelElem.value, 10) || 1) : 1;

    if (!rawWord) {
        showToast(tr('toastFillWordFirst', '請先輸入單字！'), 'warning');
        return;
    }

    const cleanObj = (typeof sanitizeWordAndPos === 'function')
        ? sanitizeWordAndPos(rawWord, rawPos, rawMeaning)
        : { word: rawWord, pos: rawPos, meaning: rawMeaning };

    if (id) {
        const index = wordList.findIndex(w => w.id === id);
        if (index !== -1) {
            const prevCard = wordList[index];
            const levelChanged = (prevCard.level || 1) !== level;
            const freeLevelChanged = (prevCard.freeLevel || 1) !== freeLevel;
            const updatedCard = {
                ...prevCard,
                category,
                word: cleanObj.word,
                pos: cleanObj.pos,
                phonetic,
                meaning: cleanObj.meaning,
                sentence,
                translation,
                level,
                freeLevel,
                freeStreak: freeLevelChanged ? 0 : (prevCard.freeStreak || 0),
                updatedAt: Date.now()
            };

            if (levelChanged) {
                delete updatedCard.stability;
                delete updatedCard.difficulty;
                delete updatedCard.nextReview;
                updatedCard.knowStreak = 0;
            }
            if (typeof migrateCardFSRS === 'function') {
                migrateCardFSRS(updatedCard);
            }
            wordList[index] = updatedCard;
            if ((levelChanged || freeLevelChanged) && typeof syncDuplicateWordsProgress === 'function') {
                syncDuplicateWordsProgress(updatedCard);
            }
        }
        showToast(tr('toastCardSaved', '單字已儲存！'), 'success');
    } else {
        const normWord = cleanObj.word.trim().toLowerCase();
        const sameDeckIdx = wordList.findIndex(w =>
            (w.category || defaultCategoryName).trim() === category.trim() &&
            (w.word || '').trim().toLowerCase() === normWord
        );

        if (sameDeckIdx !== -1) {
            const existing = wordList[sameDeckIdx];
            const keepHigherLevel = Math.max(existing.level || 1, level);
            const keepHigherFreeLevel = Math.max(existing.freeLevel || 1, freeLevel);
            const mergedCard = {
                ...existing,
                pos: cleanObj.pos || existing.pos,
                phonetic: phonetic || existing.phonetic,
                meaning: (cleanObj.meaning && cleanObj.meaning !== defaultMeaningText) ? cleanObj.meaning : existing.meaning,
                sentence: sentence || existing.sentence,
                translation: translation || existing.translation,
                level: keepHigherLevel,
                freeLevel: keepHigherFreeLevel,
                freeStreak: keepHigherFreeLevel !== (existing.freeLevel || 1) ? 0 : (existing.freeStreak || 0),
                updatedAt: Date.now()
            };
            if (keepHigherLevel !== (existing.level || 1)) {
                delete mergedCard.stability;
                delete mergedCard.difficulty;
                delete mergedCard.nextReview;
                mergedCard.knowStreak = 0;
            }
            if (typeof migrateCardFSRS === 'function') {
                migrateCardFSRS(mergedCard);
            }
            wordList[sameDeckIdx] = mergedCard;
            showToast(tr('toastCardMerged', '同字庫已存在相同單字，已自動合併並保留最高進度！'), 'info');
        } else {
            const newCard = {
                id: 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                category, 
                word: cleanObj.word, 
                pos: cleanObj.pos, 
                phonetic, 
                meaning: cleanObj.meaning, 
                sentence, 
                translation,
                level,
                knowStreak: 0,
                freeLevel,
                freeStreak: 0,
                updatedAt: Date.now()
            };
            if (typeof migrateCardFSRS === 'function') {
                migrateCardFSRS(newCard);
            }
            wordList.unshift(newCard);
            showToast(tr('toastCardAdded', '新增單字成功！'), 'success');
        }
    }

    saveStorage();
    updateCategorySelects();
    updateUI();
    closeModal('cardModal');
    if (!currentCard) nextCard(true);
}

async function handleAiSingleFill() {
    const word = document.getElementById('formWord').value.trim();
    if (!word) {
        showToast(tr('toastEnterEnglishFirst', '請先輸入外文單字！'), 'warning');
        return;
    }

    const btn = document.getElementById('aiGenerateBtn');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>${tr('progressAiParsing', 'AI 解析中...')}</span>`;

    if (typeof autoFillWithAI === 'function') {
        const result = await autoFillWithAI(word);
        if (result) {
            if (result.pos) document.getElementById('formPos').value = result.pos;
            if (result.phonetic) document.getElementById('formPhonetic').value = result.phonetic;
            if (result.meaning) document.getElementById('formMeaning').value = result.meaning;
            if (result.sentence) document.getElementById('formSentence').value = result.sentence;
            if (result.translation) document.getElementById('formTranslation').value = result.translation;
            showToast(tr('toastAiSingleSuccess', 'AI 自動補齊成功！'), 'success');
        }
    }

    btn.disabled = false;
    btn.innerHTML = origHtml;
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (id === 'cardModal') {
        ensureFreeLevelFormField();
        const isEditing = !!document.getElementById('editCardId')?.value;
        if (!isEditing) {
            const freeLevelSelect = document.getElementById('formFreeLevel');
            if (freeLevelSelect) freeLevelSelect.value = '1';
            const defaultCatName = tr('defaultCategoryName', '預設字庫');
            const activeCats = window.selectedCategories || ['ALL'];
            const initialCat = (activeCats.length === 1 && activeCats[0] !== 'ALL') ? activeCats[0] : defaultCatName;
            setCategorySelectorValue('form', initialCat);
        }
    }

    if (id === 'batchModal' || id === 'quickAddModal') {
        if (typeof updateBatchPlaceholders === 'function') {
            updateBatchPlaceholders();
        }
    }

    if (typeof applyLanguageUI === 'function') {
        applyLanguageUI();
    }

    if (id === 'keyModal') {
        const keyStorageName = typeof API_KEY_STORAGE_NAME !== 'undefined' ? API_KEY_STORAGE_NAME : 'flashcard_gemini_key_v1';
        const existingKey = localStorage.getItem(keyStorageName) || '';
        const keyInput = document.getElementById('geminiApiKeyInput');
        if (keyInput) keyInput.value = existingKey;

        if (existingKey) {
            showToast(tr('toastKeyLoaded', '已載入金鑰'), "info");
        }
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('flex');
    modal.classList.add('hidden');

    if (id === 'cardModal') {
        const cardForm = document.getElementById('cardForm');
        if (cardForm) cardForm.reset();
        const editIdInput = document.getElementById('editCardId');
        if (editIdInput) editIdInput.value = '';
        const freeLevelSelect = document.getElementById('formFreeLevel');
        if (freeLevelSelect) freeLevelSelect.value = '1';
        const defaultCatName = tr('defaultCategoryName', '預設字庫');
        setCategorySelectorValue('form', defaultCatName);
        const titleElem = document.getElementById('cardModalTitle');
        if (titleElem) titleElem.innerText = tr('modalTitleAdd', '新增單字');
    }
    if (id === 'batchModal' && typeof resetBatchModal === 'function') {
        resetBatchModal();
    }
}
