/**
 * LZHCard - 主程式交互控制器 (純化精簡版)
 */

function getSavedCategories() {
    try {
        const saved = localStorage.getItem('lzhcard_selected_categories');
        if (saved !== null) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch(e) {}
    return ['ALL'];
}

window.selectedCategories = getSavedCategories();
let currentCard = null;
let selectedWordIds = new Set();
let currentTab = 'home';
let cardReviewCounter = parseInt(localStorage.getItem('lzhcard_review_counter') || '0', 10);

const MAX_AI_BATCH_LIMIT = 200;

/**
 * ✨ 全域 Toast 浮態提示訊息系統
 */
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

/**
 * 🪙 即時更新頁面上的金幣顯示數字
 */
function updateUserCoinsUI() {
    const el = document.getElementById('userCoinsDisplay');
    if (el) {
        const coins = (window.userData && typeof window.userData.coins === 'number') ? window.userData.coins : 0;
        el.innerText = coins;
    }
}

/**
 * 取得所有字庫類別名稱
 */
function getAllCategories() {
    const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : '預設字庫';
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

/**
 * 🔄 更新字庫多選選單 (渲染 Checkbox UI 與按鈕文字)
 */
function updateCategorySelects() {
    const cats = getAllCategories();
    const nativeLang = localStorage.getItem('lzhcard_native_lang') || 'zh-TW';
    const catAllText = (typeof t === 'function') ? t('catAll') : "全部字庫";
    const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : "預設字庫";
    const noCatText = (typeof t === 'function') ? t('noCategorySelected') : '未選取字庫';
    const selectedPrefix = (typeof t === 'function') ? t('selectedPrefix') : '已選';
    const unitDeck = (typeof t === 'function') ? t('unitDeck') : '個字庫';
    const unitText = nativeLang === 'en' ? 'words' : (nativeLang === 'ja' ? '語' : '字');

    let activeCats = window.selectedCategories || ['ALL'];
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
            const count = wordList.filter(w => (w.category || defaultCatName) === c).length;
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
        const exportAllText = nativeLang === 'en' ? 'All Decks' : (nativeLang === 'ja' ? 'すべての単語帳' : '包含全部字庫');
        exportSelect.innerHTML = `<option value="ALL">${exportAllText}</option>` + 
            cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const splitSelect = document.getElementById('splitTargetCategorySelect');
    if (splitSelect) {
        splitSelect.innerHTML = cats.map(c => {
            const count = wordList.filter(w => (w.category || defaultCatName) === c).length;
            return `<option value="${c}">${c} (${count} ${unitText})</option>`;
        }).join('');
    }
}

/**
 * 🎯 勾選/取消字庫事件
 */
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
    updateUI();
    nextCard();
}

window.addEventListener('DOMContentLoaded', async () => {
    if (typeof loadStorage === 'function') {
        await loadStorage();
    }
    updateUserCoinsUI();

    // 🟢 登入身分驗證完成後，自動啟動 Realtime Database 在線狀態與聊天監聽
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            if (user && typeof initChatRealtimeListeners === 'function') {
                initChatRealtimeListeners();
            }
        });
    }
});

function updateUI() {
    const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : "預設字庫";
    const activeCats = window.selectedCategories || [];

    const filteredList = wordList.filter(w => {
        if (activeCats.includes("ALL")) return true;
        return activeCats.includes(w.category || defaultCatName);
    });

    const count = filteredList.length;
    const totalWordCountElem = document.getElementById('totalWordCount');
    if (totalWordCountElem) totalWordCountElem.innerText = wordList.length;

    const cardCountDisplayElem = document.getElementById('cardCountDisplay');
    if (cardCountDisplayElem) cardCountDisplayElem.innerText = count;

    updateEmptyNoticeState();
    updateUserCoinsUI();

    if (typeof updateCategorySelects === 'function') updateCategorySelects();
    renderWordList();
    if (currentTab === 'stats' && typeof renderStats === 'function') renderStats();
    if (typeof updateBatchBadgeUI === 'function') updateBatchBadgeUI();
    if (typeof applyLanguageUI === 'function') applyLanguageUI();
}

function updateEmptyNoticeState() {
    const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : "預設字庫";
    const activeCats = window.selectedCategories || [];

    const filteredList = (typeof wordList !== 'undefined' && Array.isArray(wordList)) ? wordList.filter(w => {
        if (activeCats.includes("ALL")) return true;
        return activeCats.includes(w.category || defaultCatName);
    }) : [];

    const count = filteredList.length;
    const emptyNotice = document.getElementById('emptyNotice');

    if (emptyNotice) {
        const showOnTabs = ['home', 'list', 'flashcard', 'quiz'];
        if (count === 0 && showOnTabs.includes(currentTab)) {
            emptyNotice.classList.remove('hidden');
        } else {
            emptyNotice.classList.add('hidden');
        }
    }
}

function nextCard() {
    const flashcardElem = document.getElementById('flashcard');

    if (flashcardElem) {
        flashcardElem.classList.add('no-transition');
        flashcardElem.classList.remove('rotate-y-180');
        void flashcardElem.offsetHeight;
        flashcardElem.classList.remove('no-transition');
    }

    currentCard = getNextCardSpacedRepetition();
    const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : '預設';

    if (!currentCard) {
        if (document.getElementById('cardWord')) document.getElementById('cardWord').innerText = t('noWordAvailable');
        if (document.getElementById('cardPhonetic')) document.getElementById('cardPhonetic').innerText = "/---/";
        if (document.getElementById('cardPhoneticBack')) document.getElementById('cardPhoneticBack').innerText = "";
        if (document.getElementById('cardPosFront')) document.getElementById('cardPosFront').innerText = "EMPTY";
        if (document.getElementById('cardPosBack')) document.getElementById('cardPosBack').innerText = "EMPTY";
        if (document.getElementById('cardMeaning')) document.getElementById('cardMeaning').innerText = t('selectOtherDeck');
        if (document.getElementById('cardSentence')) document.getElementById('cardSentence').innerText = `"${t('selectOtherDeck')}"`;
        if (document.getElementById('cardTranslation')) document.getElementById('cardTranslation').innerText = "";
        return;
    }

    const lvInfo = getLevelInfo(currentCard.level || 1);
    const streak = currentCard.knowStreak || 0;

    const streakTextElem = document.getElementById('knowStreakText');
    if (streakTextElem) streakTextElem.innerText = `${streak}/2`;

    const displayMode = localStorage.getItem('lzhcard_display_mode') || 'target_front';
    const wordText = currentCard.word || '';
    const meaningText = currentCard.meaning || '';

    const frontWordElem = document.getElementById('cardWord');
    const backMeaningElem = document.getElementById('cardMeaning');

    if (displayMode === 'native_front') {
        if (frontWordElem) frontWordElem.innerText = meaningText || t('noMeaning');
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

    if (document.getElementById('cardPosFront')) document.getElementById('cardPosFront').innerText = currentCard.pos || 'N/A';
    
    const levelFront = document.getElementById('cardLevelFront');
    if (levelFront) {
        levelFront.innerText = `${currentCard.category || defaultCatName} | ${lvInfo.name}`;
        levelFront.className = `px-2.5 py-1 rounded-full text-xs font-bold border ${lvInfo.color}`;
    }

    if (document.getElementById('cardPosBack')) document.getElementById('cardPosBack').innerText = currentCard.pos || 'N/A';
    const levelBack = document.getElementById('cardLevelBack');
    if (levelBack) {
        levelBack.innerText = `${currentCard.category || defaultCatName} | ${lvInfo.name}`;
        levelBack.className = `px-2.5 py-1 rounded-full text-xs font-bold border ${lvInfo.color}`;
    }

    if (document.getElementById('cardSentence')) document.getElementById('cardSentence').innerText = currentCard.sentence ? `"${currentCard.sentence}"` : `"${t('noSentence')}"`;
    if (document.getElementById('cardTranslation')) document.getElementById('cardTranslation').innerText = currentCard.translation || '';
}

// 覆蓋 handleDontKnow
function handleDontKnow() {
    if (!currentCard) return;
    const card = wordList.find(w => w.id === currentCard.id);
    if (card) {
        card.level = Math.max(1, (card.level || 1) - 1);
        card.knowStreak = 0;
        saveStorage();
    }
    trackCardReviewReward(); // 👈 累計刷卡次數
    updateUI();
    nextCard();
}

// 覆蓋 handleKnow
function handleKnow() {
    if (!currentCard) return;
    const card = wordList.find(w => w.id === currentCard.id);
    if (card) {
        if (!card.level) card.level = 1;
        card.knowStreak = (card.knowStreak || 0) + 1;

        if (card.knowStreak >= 2) {
            if (card.level < 5) {
                card.level += 1;
                card.knowStreak = 0;
            } else {
                card.knowStreak = 2;
            }
        }
        saveStorage();
    }
    trackCardReviewReward(); // 👈 累計刷卡次數
    updateUI();
    nextCard();
}

/**
 * 🪙 刷卡計數與獎勵發放函式 (每 10 張卡獲得 1 金幣)
 */
function trackCardReviewReward() {
    cardReviewCounter += 1;
    if (cardReviewCounter >= 10) {
        cardReviewCounter = 0;
        if (!window.userData) window.userData = {};
        window.userData.coins = (window.userData.coins || 0) + 1;
        
        if (typeof saveUserData === 'function') saveUserData();
        if (typeof updateUserCoinsUI === 'function') updateUserCoinsUI();
        
        const toastMsg = (typeof t === 'function') 
            ? t('toastEarnCoin10Cards') 
            : '🎉 累積刷滿 10 張字卡，獲得 1 金幣！';
        showToast(toastMsg, 'success');
    }
    localStorage.setItem('lzhcard_review_counter', cardReviewCounter.toString());
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
        utterance.lang = 'en-US';
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
        nextCard();
    } else if (mode === 'quiz') {
        const secQuiz = document.getElementById('sec-quiz');
        if (secQuiz) secQuiz.classList.remove('hidden');
        if (typeof nextQuizQuestion === 'function') nextQuizQuestion();
    }

    updateEmptyNoticeState();
}

function exitFocusMode() {
    switchTab('home');
}

function getFilteredWords() {
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : '預設字庫';
    const noMeaningText = (typeof t === 'function') ? t('noMeaning') : '未設定釋義';

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

        return 0;
    });

    return filtered;
}

function renderWordList() {
    const tbody = document.getElementById('wordTableBody');
    if (!tbody) return;

    const defaultCatName = typeof t === 'function' ? t('defaultCategoryName') : '預設字庫';
    const emptySearchResultText = typeof t === 'function' ? t('emptySearchResult') : '查無符合條件的單字';
    const editTooltipText = typeof t === 'function' ? t('modalTitleEdit') : '編輯單字';
    const deleteTooltipText = typeof t === 'function' ? t('btnBatchDelete') : '刪除';

    const filtered = getFilteredWords();

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
        tbody.innerHTML = filtered.map(item => {
            const lvInfo = getLevelInfo(item.level || 1);
            const isChecked = selectedWordIds.has(item.id) ? 'checked' : '';
            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                    <td class="py-3 px-3">
                        <input type="checkbox" value="${item.id}" ${isChecked} onchange="toggleSelectWord('${item.id}', this.checked)" class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer">
                    </td>
                    <td class="py-3 px-3 font-bold text-slate-900 dark:text-white">
                        ${item.word}
                        <div class="text-xs font-mono font-normal text-slate-400">${item.phonetic || ''}</div>
                    </td>
                    <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">${item.category || defaultCatName}</span>
                    </td>
                    <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded text-xs font-semibold ${lvInfo.color} border">${lvInfo.name}</span>
                    </td>
                    <td class="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                        ${item.meaning || ''}
                    </td>
                    <td class="py-3 px-3 text-right space-x-2">
                        <button type="button" onclick="editCard('${item.id}')" class="p-1.5 text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-700 rounded transition" title="${editTooltipText}">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" onclick="deleteCard('${item.id}')" class="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded transition" title="${deleteTooltipText}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
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

    renderWordList();
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
        const unitItem = typeof t === 'function' ? t('unitItem') : '個';
        badge.innerText = `${selectedWordIds.size} ${unitItem}`;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

/* ==========================================================================
   ✏️ 單字新增與編輯表單控制
   ========================================================================== */

function editCard(id) {
    const item = wordList.find(w => w.id === id);
    if (!item) return;

    document.getElementById('editCardId').value = item.id;
    document.getElementById('formCategory').value = item.category || (typeof t === 'function' ? t('defaultCategoryName') : '預設字庫');
    document.getElementById('formWord').value = item.word || '';
    document.getElementById('formPos').value = item.pos || '';
    document.getElementById('formPhonetic').value = item.phonetic || '';
    document.getElementById('formMeaning').value = item.meaning || '';
    document.getElementById('formSentence').value = item.sentence || '';
    document.getElementById('formTranslation').value = item.translation || '';

    const levelSelect = document.getElementById('formLevel');
    if (levelSelect) levelSelect.value = item.level || 1;

    document.getElementById('cardModalTitle').innerText = typeof t === 'function' ? t('modalTitleEdit') : '編輯單字';
    openModal('cardModal');
}

function deleteCard(id) {
    if (confirm(typeof t === 'function' ? t('confirmDeleteSingle') : '確定要刪除此單字？')) {
        wordList = wordList.filter(w => w.id !== id);
        selectedWordIds.delete(id);
        saveStorage();
        updateCategorySelects();
        updateUI();
        if (currentCard && currentCard.id === id) nextCard();
        showToast(typeof t === 'function' ? t('toastWordDeleted') : '已刪除單字', 'info');
    }
}

function handleClearAllWords() {
    if (confirm(typeof t === 'function' ? t('confirmClearAll') : '確定要清空所有單字？')) {
        wordList = [];
        selectedWordIds.clear();
        saveStorage();
        updateCategorySelects();
        updateUI();
        nextCard();
        showToast(typeof t === 'function' ? t('toastDeckCleared') : '單字庫已清空', 'warning');
    }
}

function handleSaveCardForm(e) {
    e.preventDefault();

    const defaultCategoryName = typeof t === 'function' ? t('defaultCategoryName') : '預設字庫';
    const defaultMeaningText = typeof t === 'function' ? t('noMeaning') : '未設定釋義';

    const id = document.getElementById('editCardId').value;
    const category = document.getElementById('formCategory').value.trim() || defaultCategoryName;
    const rawWord = document.getElementById('formWord').value.trim();
    const rawPos = document.getElementById('formPos').value.trim();
    const phonetic = document.getElementById('formPhonetic').value.trim();
    const rawMeaning = document.getElementById('formMeaning').value.trim() || defaultMeaningText;
    const sentence = document.getElementById('formSentence').value.trim();
    const translation = document.getElementById('formTranslation').value.trim();

    const levelElem = document.getElementById('formLevel');
    const level = levelElem ? (parseInt(levelElem.value, 10) || 1) : 1;

    if (!rawWord) {
        showToast(typeof t === 'function' ? t('toastFillWordFirst') : '請先輸入單字！', 'warning');
        return;
    }

    const cleanObj = (typeof sanitizeWordAndPos === 'function')
        ? sanitizeWordAndPos(rawWord, rawPos, rawMeaning)
        : { word: rawWord, pos: rawPos, meaning: rawMeaning };

    if (id) {
        const index = wordList.findIndex(w => w.id === id);
        if (index !== -1) {
            wordList[index] = { 
                ...wordList[index], 
                category, 
                word: cleanObj.word, 
                pos: cleanObj.pos, 
                phonetic, 
                meaning: cleanObj.meaning, 
                sentence, 
                translation, 
                level,
                updatedAt: Date.now() 
            };
        }
        showToast(typeof t === 'function' ? t('toastCardSaved') : '單字已儲存！', 'success');
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
            updatedAt: Date.now()
        };
        wordList.unshift(newCard);
        showToast(typeof t === 'function' ? t('toastCardAdded') : '新增單字成功！', 'success');
    }

    saveStorage();
    updateCategorySelects();
    updateUI();
    closeModal('cardModal');
    if (!currentCard) nextCard();
}

async function handleAiSingleFill() {
    const word = document.getElementById('formWord').value.trim();
    if (!word) {
        showToast(typeof t === 'function' ? t('toastEnterEnglishFirst') : '請先輸入外文單字！', 'warning');
        return;
    }

    const btn = document.getElementById('aiGenerateBtn');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>${typeof t === 'function' ? t('progressAiParsing') : 'AI 解析中...'}</span>`;

    if (typeof autoFillWithAI === 'function') {
        const result = await autoFillWithAI(word);
        if (result) {
            if (result.pos) document.getElementById('formPos').value = result.pos;
            if (result.phonetic) document.getElementById('formPhonetic').value = result.phonetic;
            if (result.meaning) document.getElementById('formMeaning').value = result.meaning;
            if (result.sentence) document.getElementById('formSentence').value = result.sentence;
            if (result.translation) document.getElementById('formTranslation').value = result.translation;
            showToast(typeof t === 'function' ? t('toastAiSingleSuccess') : 'AI 自動補齊成功！', 'success');
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
            showToast(typeof t === 'function' ? t('toastKeyLoaded') : '已載入金鑰', "info");
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
        const titleElem = document.getElementById('cardModalTitle');
        if (titleElem) titleElem.innerText = typeof t === 'function' ? t('modalTitleAdd') : '新增單字';
    }
    if (id === 'batchModal' && typeof resetBatchModal === 'function') {
        resetBatchModal();
    }
}