/**
 * LZHCard - 主程式交互控制器
 */

let selectedCategory = 'ALL';
let currentCard = null;
let parsedBatchList = [];
let selectedWordIds = new Set();

const MAX_AI_BATCH_LIMIT = 50;
const API_KEY_STORAGE_NAME = typeof STORAGE_KEY_APIKEY !== 'undefined' ? STORAGE_KEY_APIKEY : 'flashcard_gemini_key_v1';

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

window.addEventListener('DOMContentLoaded', async () => {
    if (typeof loadStorage === 'function') {
        await loadStorage();
    }
});

function updateCategorySelects() {
    const cats = getAllCategories();

    const nativeLang = localStorage.getItem('lzhcard_native_lang') || 'zh-TW';
    const catAllText = (typeof t === 'function') ? t('catAll') : "全部字庫";
    const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : "預設字庫";
    const unitText = nativeLang === 'en' ? 'words' : (nativeLang === 'ja' ? '語' : '字');
    const totalPrefix = nativeLang === 'en' ? '' : (nativeLang === 'ja' ? '計 ' : '共 ');

    const filterSelect = document.getElementById('categoryFilterSelect');
    if (filterSelect) {
        const cur = filterSelect.value;
        filterSelect.innerHTML = `<option value="ALL">${catAllText} (${totalPrefix}${wordList.length} ${unitText})</option>` + 
            cats.map(c => {
                const count = wordList.filter(w => (w.category || defaultCatName) === c).length;
                return `<option value="${c}">${c} (${count} ${unitText})</option>`;
            }).join('');
        filterSelect.value = cats.includes(cur) || cur === 'ALL' ? cur : 'ALL';
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

function handleCategoryFilterChange() {
    const filterSelect = document.getElementById('categoryFilterSelect');
    if (filterSelect) {
        selectedCategory = filterSelect.value;
    }
    selectedWordIds.clear();
    updateUI();
    nextCard();
}

function updateUI() {
    const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : "預設字庫";

    const filteredList = wordList.filter(w => {
        if (typeof selectedCategory === 'undefined' || selectedCategory === "ALL") return true;
        return (w.category || defaultCatName) === selectedCategory;
    });

    const count = filteredList.length;
    const totalWordCountElem = document.getElementById('totalWordCount');
    if (totalWordCountElem) totalWordCountElem.innerText = wordList.length;

    const cardCountDisplayElem = document.getElementById('cardCountDisplay');
    if (cardCountDisplayElem) cardCountDisplayElem.innerText = count;

    const emptyNotice = document.getElementById('emptyNotice');
    if (emptyNotice) {
        if (count === 0) {
            emptyNotice.classList.remove('hidden');
        } else {
            emptyNotice.classList.add('hidden');
        }
    }

    if (typeof updateCategorySelects === 'function') updateCategorySelects();
    renderWordList();
    if (typeof updateBatchBadgeUI === 'function') updateBatchBadgeUI();
    if (typeof applyLanguageUI === 'function') applyLanguageUI();
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
    if (streakTextElem) streakTextElem.innerText = `${streak}/3`;

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

    if (document.getElementById('cardPhonetic')) document.getElementById('cardPhonetic').innerText = currentCard.phonetic || '/---/';
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

function handleDontKnow() {
    if (!currentCard) return;
    const card = wordList.find(w => w.id === currentCard.id);
    if (card) {
        card.level = Math.max(1, (card.level || 1) - 1);
        card.knowStreak = 0;
        saveStorage();
    }
    updateUI();
    nextCard();
}

function handleKnow() {
    if (!currentCard) return;
    const card = wordList.find(w => w.id === currentCard.id);
    if (card) {
        if (!card.level) card.level = 1;
        card.knowStreak = (card.knowStreak || 0) + 1;

        if (card.knowStreak >= 3) {
            if (card.level < 5) {
                card.level += 1;
                card.knowStreak = 0;
            } else {
                card.knowStreak = 3;
            }
        }
        saveStorage();
    }
    updateUI();
    nextCard();
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
    const secHome = document.getElementById('sec-home');
    const secFlashcard = document.getElementById('sec-flashcard');
    const secQuiz = document.getElementById('sec-quiz');
    const secList = document.getElementById('sec-list');
    const secStore = document.getElementById('sec-store');
    const secSettings = document.getElementById('sec-settings');
    const secStats = document.getElementById('sec-stats'); // 🌟 新增：統計區塊

    const bnavHome = document.getElementById('bnav-home');
    const bnavList = document.getElementById('bnav-list');
    const bnavStore = document.getElementById('bnav-store');
    const bnavSettings = document.getElementById('bnav-settings');
    const bnavStats = document.getElementById('bnav-stats'); // 🌟 新增：統計導覽按鈕

    // 隱藏所有分頁區塊
    [secHome, secFlashcard, secQuiz, secList, secStore, secSettings, secStats].forEach(el => el && el.classList.add('hidden'));

    // 重設所有導覽列按鈕樣式
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
    } else if (tab === 'settings') {
        if (secSettings) secSettings.classList.remove('hidden');
        if (bnavSettings) bnavSettings.className = "flex flex-col items-center justify-center text-brand-600 dark:text-brand-400 space-y-1 font-bold";
    } else if (tab === 'stats') { // 🌟 新增：切換至統計分頁並渲染圖表
        if (secStats) secStats.classList.remove('hidden');
        if (bnavStats) bnavStats.className = "flex flex-col items-center justify-center text-brand-600 dark:text-brand-400 space-y-1 font-bold";
        renderStats();
    }
}

function startFocusMode(mode) {
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
}

function exitFocusMode() {
    switchTab('home');
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(async (user) => {
      const loggedOutBox = document.getElementById('settings-logged-out');
      const loggedInBox = document.getElementById('settings-logged-in');
      const emailSpan = document.getElementById('settings-email');
      const avatarImg = document.getElementById('settings-avatar');
      const navAvatar = document.getElementById('nav-avatar');

      if (user) {
        if (loggedOutBox) loggedOutBox.style.display = 'none';
        if (loggedInBox) loggedInBox.style.display = 'block';
        if (emailSpan) emailSpan.textContent = user.displayName || user.email;
        const avatarUrl = user.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=user';
        if (avatarImg) avatarImg.src = avatarUrl;
        if (navAvatar) navAvatar.src = avatarUrl;
      } else {
        if (loggedOutBox) loggedOutBox.style.display = 'block';
        if (loggedInBox) loggedInBox.style.display = 'none';
        if (emailSpan) emailSpan.textContent = t('guestMode');
        const avatarUrl = 'https://api.dicebear.com/7.x/bottts/svg?seed=user';
        if (avatarImg) avatarImg.src = avatarUrl;
        if (navAvatar) navAvatar.src = avatarUrl;
      }
    });
  }
});

function getFilteredWords() {
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : '預設字庫';

    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const sortBy = sortSelect ? sortSelect.value : 'default';

    let filtered = wordList.filter(item => {
        const matchesSearch = !search ||
            (item.word || '').toLowerCase().includes(search) ||
            (item.meaning && item.meaning.toLowerCase().includes(search)) ||
            (item.category && item.category.toLowerCase().includes(search)) ||
            (item.pos && item.pos.toLowerCase().includes(search));
            
        const matchesCategory = (typeof selectedCategory === 'undefined' || selectedCategory === "ALL") 
            ? true 
            : (item.category || defaultCatName) === selectedCategory;
            
        return matchesSearch && matchesCategory;
    });

    filtered.sort((a, b) => {
        // 🌟 搜尋關鍵字相關度優先排序（當有搜尋輸入且選用預設排序時啟用）
        if (search && sortBy === 'default') {
            const wA = (a.word || '').toLowerCase();
            const wB = (b.word || '').toLowerCase();

            const aStarts = wA.startsWith(search);
            const bStarts = wB.startsWith(search);

            // 1. 完全比對優先（例如輸入 "pin" 時，"pin" 置頂）
            if (wA === search && wB !== search) return -1;
            if (wB === search && wA !== search) return 1;

            // 2. 開頭匹配優先（例如輸入 "p" 時，"pen"、"park" 排在 "keep up" 前面）
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            // 3. 同為開頭匹配時，較短的單詞優先排在長片語前面
            if (aStarts && bStarts) {
                if (wA.length !== wB.length) {
                    return wA.length - wB.length;
                }
            }
        }

        // 其他切換選項排序
        if (sortBy === 'alpha-asc') {
            return (a.word || '').localeCompare(b.word || '');
        } else if (sortBy === 'alpha-desc') {
            return (b.word || '').localeCompare(a.word || '');
        } else if (sortBy === 'pos') {
            return (a.pos || '').localeCompare(b.pos || '');
        } else if (sortBy === 'level-asc') {
            return (a.level || 1) - (b.level || 1);
        } else if (sortBy === 'level-desc') {
            return (b.level || 1) - (a.level || 1);
        }
        return 0;
    });

    return filtered;
}

function renderWordList() {
    const tbody = document.getElementById('wordTableBody');
    if (!tbody) return;

    const defaultCatName = t('defaultCategoryName');
    const emptySearchResultText = t('emptySearchResult');
    const editTooltipText = t('modalTitleEdit');
    const deleteTooltipText = t('btnBatchDelete');

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
        const unitItem = t('unitItem');
        badge.innerText = `${selectedWordIds.size} ${unitItem}`;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

/**
 * 🏷️ 重新命名字庫功能
 */
function handleRenameCategory() {
    let targetCat = typeof selectedCategory !== 'undefined' ? selectedCategory : 'ALL';
    const defaultCatName = t('defaultCategoryName');

    if (targetCat === 'ALL') {
        const cats = getAllCategories();
        const inputCat = prompt(t('promptSelectRenameDeck', { list: cats.join('、 ') }));
        if (!inputCat || !inputCat.trim()) return;
        targetCat = inputCat.trim();
        
        if (!cats.includes(targetCat)) {
            showToast(t('toastCategoryNotFound', { name: targetCat }), 'warning');
            return;
        }
    }

    const newName = prompt(t('promptNewDeckName', { name: targetCat }), targetCat);
    if (!newName || !newName.trim() || newName.trim() === targetCat) return;

    const cleanNewName = newName.trim();
    let updatedCount = 0;

    wordList.forEach(item => {
        const currentCat = item.category || defaultCatName;
        if (currentCat === targetCat) {
            item.category = cleanNewName;
            updatedCount++;
        }
    });

    if (selectedCategory === targetCat) {
        selectedCategory = cleanNewName;
    }

    saveStorage();
    updateCategorySelects();
    updateUI();
    showToast(t('toastRenameSuccess', { oldName: targetCat, newName: cleanNewName, count: updatedCount }), 'success');
}

function handleBatchChangeCategory() {
    if (selectedWordIds.size === 0) {
        showToast(t('toastSelectMoveWords'), 'warning');
        return;
    }

    const newCategory = prompt(t('promptMoveTarget', { count: selectedWordIds.size }), selectedCategory === 'ALL' ? t('defaultCategoryName') : selectedCategory);
    if (!newCategory || !newCategory.trim()) return;

    const catName = newCategory.trim();
    let count = 0;

    wordList.forEach(item => {
        if (selectedWordIds.has(item.id)) {
            item.category = catName;
            count++;
        }
    });

    saveStorage();
    updateCategorySelects();
    updateUI();
    showToast(t('toastMoveSuccess', { count, name: catName }), 'success');
}

function handleBatchDeleteWords() {
    if (selectedWordIds.size === 0) {
        showToast(t('toastSelectDeleteWords'), 'warning');
        return;
    }

    if (confirm(t('confirmDeleteBatch', { count: selectedWordIds.size }))) {
        wordList = wordList.filter(item => !selectedWordIds.has(item.id));
        selectedWordIds.clear();
        saveStorage();
        updateCategorySelects();
        updateUI();
        nextCard();
        showToast(t('toastDeleteBatchSuccess'), 'info');
    }
}

async function handleBatchAiFillLibraryWords() {
    const defaultCatName = t('defaultCategoryName');

    let targetWords = [];
    if (selectedWordIds.size > 0) {
        targetWords = wordList.filter(item => selectedWordIds.has(item.id));
    } else {
        targetWords = wordList.filter(item => {
            if (typeof selectedCategory === 'undefined' || selectedCategory === "ALL") return true;
            return (item.category || defaultCatName) === selectedCategory;
        });
    }

    if (targetWords.length === 0) {
        showToast(t('toastNoWordsToFill'), 'warning');
        return;
    }

    const incompleteWords = targetWords.filter(item => {
        return (typeof isFieldIncomplete === 'function') ? (
            isFieldIncomplete(item.meaning) || 
            isFieldIncomplete(item.pos) || 
            isFieldIncomplete(item.sentence) || 
            isFieldIncomplete(item.translation) ||
            isFieldIncomplete(item.phonetic)
        ) : (!item.meaning || !item.pos || !item.sentence);
    });

    if (incompleteWords.length === 0) {
        showToast(t('toastAllWordsComplete'), 'info');
        return;
    }

    if (incompleteWords.length > MAX_AI_BATCH_LIMIT) {
        showToast(t('toastBatchLimitExceeded', { count: incompleteWords.length }), 'error');
        return;
    }

    if (!confirm(t('confirmBatchAiFill', { count: incompleteWords.length }))) {
        return;
    }

    const progressContainer = document.getElementById('libAiProgressContainer');
    const progressBar = document.getElementById('libAiProgressBar');
    const progressText = document.getElementById('libAiProgressText');
    const progressPercent = document.getElementById('libAiProgressPercent');

    if (progressContainer) progressContainer.classList.remove('hidden');

    await runBatchAiAutoFill(targetWords, (current, total) => {
        const pct = Math.round((current / total) * 100);
        if (progressText) progressText.innerText = t('progressBatchAi', { current, total });
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressPercent) progressPercent.innerText = `${pct}%`;
        renderWordList();
    });

    saveStorage();
    updateUI();

    if (progressText) progressText.innerText = t('progressAiComplete');
    if (progressBar) progressBar.style.width = "100%";
    if (progressPercent) progressPercent.innerText = "100%";

    setTimeout(() => {
        if (progressContainer) progressContainer.classList.add('hidden');
    }, 2500);

    showToast(t('toastBatchFillSuccess', { count: incompleteWords.length }), 'success');
}

function editCard(id) {
    const item = wordList.find(w => w.id === id);
    if (!item) return;

    document.getElementById('editCardId').value = item.id;
    document.getElementById('formCategory').value = item.category || t('defaultCategoryName');
    document.getElementById('formWord').value = item.word || '';
    document.getElementById('formPos').value = item.pos || '';
    document.getElementById('formPhonetic').value = item.phonetic || '';
    document.getElementById('formMeaning').value = item.meaning || '';
    document.getElementById('formSentence').value = item.sentence || '';
    document.getElementById('formTranslation').value = item.translation || '';

    // 🌟 新增這兩行：編輯時自動載入單字目前的熟悉度等級 (預設 Lv.1)
    const levelSelect = document.getElementById('formLevel');
    if (levelSelect) levelSelect.value = item.level || 1;

    document.getElementById('cardModalTitle').innerText = t('modalTitleEdit');
    openModal('cardModal');
}

function deleteCard(id) {
    if (confirm(t('confirmDeleteSingle'))) {
        wordList = wordList.filter(w => w.id !== id);
        selectedWordIds.delete(id);
        saveStorage();
        updateCategorySelects();
        updateUI();
        if (currentCard && currentCard.id === id) nextCard();
        showToast(t('toastWordDeleted'), 'info');
    }
}

function handleClearAllWords() {
    if (confirm(t('confirmClearAll'))) {
        wordList = [];
        selectedWordIds.clear();
        saveStorage();
        updateCategorySelects();
        updateUI();
        nextCard();
        showToast(t('toastDeckCleared'), 'warning');
    }
}

function handleSaveCardForm(e) {
    e.preventDefault();

    const defaultCategoryName = t('defaultCategoryName');
    const defaultMeaningText = t('noMeaning');

    const id = document.getElementById('editCardId').value;
    const category = document.getElementById('formCategory').value.trim() || defaultCategoryName;
    const rawWord = document.getElementById('formWord').value.trim();
    const rawPos = document.getElementById('formPos').value.trim();
    const phonetic = document.getElementById('formPhonetic').value.trim();
    const rawMeaning = document.getElementById('formMeaning').value.trim() || defaultMeaningText;
    const sentence = document.getElementById('formSentence').value.trim();
    const translation = document.getElementById('formTranslation').value.trim();

    // 🌟 讀取 HTML 表單中選擇的熟悉度等級 (Lv.1 ~ Lv.5)
    const levelElem = document.getElementById('formLevel');
    const level = levelElem ? (parseInt(levelElem.value, 10) || 1) : 1;

    if (!rawWord) {
        showToast(t('toastFillWordFirst'), 'warning');
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
                level, // 🌟 編輯儲存時更新為新選擇的等級
                updatedAt: Date.now() 
            };
        }
        showToast(t('toastCardSaved'), 'success');
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
            level, // 🌟 新增卡片時寫入選擇的等級
            knowStreak: 0, 
            updatedAt: Date.now()
        };
        wordList.unshift(newCard);
        showToast(t('toastCardAdded'), 'success');
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
        showToast(t('toastEnterEnglishFirst'), 'warning');
        return;
    }

    const btn = document.getElementById('aiGenerateBtn');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>${t('progressAiParsing')}</span>`;

    const result = await autoFillWithAI(word);
    if (result) {
        if (result.pos) document.getElementById('formPos').value = result.pos;
        if (result.phonetic) document.getElementById('formPhonetic').value = result.phonetic;
        if (result.meaning) document.getElementById('formMeaning').value = result.meaning;
        if (result.sentence) document.getElementById('formSentence').value = result.sentence;
        if (result.translation) document.getElementById('formTranslation').value = result.translation;
        showToast(t('toastAiSingleSuccess'), 'success');
    }

    btn.disabled = false;
    btn.innerHTML = origHtml;
}

function findChineseMeaningFromObject(item) {
    if (!item || typeof item !== 'object') return '';
    const preferredKeys = ['meaning', 'definition', 'zh', 'ch', 'chinese', 'ch_meaning', 'trans', 'translation', 'm', 'd', 'explanation', 'note'];
    for (const key of preferredKeys) {
        if (item[key] && typeof item[key] === 'string' && /[\u4e00-\u9fa5]/.test(item[key])) {
            return item[key];
        }
    }
    for (const key in item) {
        if (typeof item[key] === 'string' && /[\u4e00-\u9fa5]/.test(item[key])) {
            return item[key];
        }
    }
    return '';
}

async function handleLoadPreset(levelNum) {
    if (!confirm(t('confirmLoadPreset', { level: levelNum }))) return;

    const CDN_SOURCES = [
        "https://cdn.jsdelivr.net/gh/EngTW/English-for-Programmers@master/lists/Taiwan-high-school-6K-108-edition/words_full.json",
        "https://raw.githubusercontent.com/EngTW/English-for-Programmers/master/lists/Taiwan-high-school-6K-108-edition/words_full.json",
        "https://cdn.jsdelivr.net/gh/zenkarsha/words7000@main/words.json",
        "https://raw.githubusercontent.com/zenkarsha/words7000/main/words.json"
    ];

    const btn = event ? (event.currentTarget || event.target) : null;
    const origText = btn ? btn.innerText : "";
    if (btn) {
        btn.disabled = true;
        btn.innerText = t('btnDownloading');
    }

    let allWords = null;

    for (const url of CDN_SOURCES) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    allWords = data;
                    break;
                }
            }
        } catch (e) {
            console.warn(`[CDN] 連線至 ${url} 失敗，嘗試備援...`);
        }
    }

    if (!allWords) {
        showToast(t('toastCdnFailed'), 'error');
        if (btn) { btn.disabled = false; btn.innerText = origText; }
        return;
    }

    const targetWords = allWords.filter(item => {
        const itemLv = Number(item.level || item.lv || item.L || 0);
        if (itemLv > 0) return itemLv === levelNum;
        const idx = allWords.indexOf(item);
        return Math.floor(idx / 1000) + 1 === levelNum;
    });

    if (!targetWords || targetWords.length === 0) {
        showToast(t('toastLevelNotFound', { level: levelNum }), 'warning');
        if (btn) { btn.disabled = false; btn.innerText = origText; }
        return;
    }

    const catName = `高中 7000 單 L${levelNum}`;
    const targetCategoryInput = document.getElementById('batchTargetCategory');
    if (targetCategoryInput) targetCategoryInput.value = catName;

    parsedBatchList = targetWords.map(item => {
        const rawW = item.word || item.term || item.english || item.w || '';
        const rawP = item.pos || item.partOfSpeech || item.type || item.p || '';
        
        let rawM = findChineseMeaningFromObject(item);
        if (!rawM) {
            rawM = item.meaning || item.definition || item.zh || item.ch || item.chinese || item.trans || item.m || '';
        }

        const cleanObj = (typeof sanitizeWordAndPos === 'function') 
            ? sanitizeWordAndPos(rawW, rawP, rawM)
            : { word: rawW, pos: rawP, meaning: rawM };

        return {
            word: cleanObj.word,
            pos: cleanObj.pos,
            phonetic: item.phonetic || item.pronunciation || '',
            meaning: cleanObj.meaning,
            sentence: item.sentence || item.example || '',
            translation: item.translation || item.exampleZh || ''
        };
    });

    if (btn) {
        btn.disabled = false;
        btn.innerText = origText;
    }

    renderBatchPreview();
    showToast(t('toastPresetSuccess', { name: catName, count: parsedBatchList.length }), 'success');
}

/**
 * 批量貼上文字解析器
 */
function parseBatchText(text) {
    if (!text || typeof text !== 'string') return [];

    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    const results = [];

    lines.forEach(line => {
        let tempLine = line;
        let word = '';
        let pos = '';
        let phonetic = '';
        let meaning = '';

        const slashPhonetic = tempLine.match(/\/([^\/]+)\//);
        if (slashPhonetic) {
            phonetic = '/' + slashPhonetic[1] + '/';
            tempLine = tempLine.replace(slashPhonetic[0], ' ');
        }

        const posMatch = tempLine.match(/(?:\[)?\b(adj|adv|v|n|prep|conj|pron|vt|vi|num|art)\.?(?:\])?/i);
        if (posMatch) {
            pos = posMatch[1].toLowerCase() + '.';
            tempLine = tempLine.replace(posMatch[0], ' ');
        }

        const chineseMatch = tempLine.match(/[\u4e00-\u9fa5].*/);
        if (chineseMatch) {
            meaning = chineseMatch[0].trim();
            word = tempLine.substring(0, tempLine.indexOf(meaning)).replace(/[-:=]/g, '').trim();
        } else {
            const parts = tempLine.trim().split(/\s+/);
            word = parts[0] || '';
            meaning = parts.slice(1).join(' ').trim();
        }

        word = word.trim();

        if (word) {
            results.push({
                word: word,
                pos: pos,
                phonetic: phonetic,
                meaning: meaning,
                sentence: '',
                translation: ''
            });
        }
    });

    return results;
}

function handleParseBatchText() {
    const raw = document.getElementById('batchRawInput').value.trim();
    if (!raw) {
        showToast(t('toastPasteFirst'), 'warning');
        return;
    }

    parsedBatchList = parseBatchText(raw);
    if (parsedBatchList.length === 0) {
        showToast(t('toastParseError'), 'error');
        return;
    }

    renderBatchPreview();
    showToast(t('toastParseSuccess', { count: parsedBatchList.length }), 'success');
}

function renderBatchPreview() {
    const previewBox = document.getElementById('batchPreviewBox');
    const previewBody = document.getElementById('batchPreviewBody');
    const parsedCountElem = document.getElementById('batchParsedCount');
    if (parsedCountElem) parsedCountElem.innerText = parsedBatchList.length;

    if (parsedBatchList.length === 0) {
        if (previewBox) previewBox.classList.add('hidden');
        const confirmBtn = document.getElementById('confirmBatchImportBtn');
        if (confirmBtn) confirmBtn.disabled = true;
        return;
    }

    const textComplete = t('statusComplete');
    const textPending = t('statusPending');
    const textRemove = t('btnRemove');
    const textTitleRemove = t('titleRemove');

    if (previewBody) {
        previewBody.innerHTML = parsedBatchList.map((item, idx) => {
            const isComplete = item.word && item.meaning && item.pos;
            const statusBadge = isComplete ? 
                `<span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">${textComplete}</span>` :
                `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">${textPending}</span>`;

            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td class="p-2 border-b dark:border-slate-700 font-bold">${item.word}</td>
                    <td class="p-2 border-b dark:border-slate-700">${item.pos || '-'}</td>
                    <td class="p-2 border-b dark:border-slate-700">${item.meaning || '-'}</td>
                    <td class="p-2 border-b dark:border-slate-700">${statusBadge}</td>
                    <td class="p-2 border-b dark:border-slate-700 text-right">
                        <button type="button" onclick="removeBatchItem(${idx})" class="text-rose-600 hover:text-rose-800 font-bold px-2 py-0.5 rounded hover:bg-rose-50 transition" title="${textTitleRemove}">
                            <i class="fa-solid fa-trash"></i> ${textRemove}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    if (previewBox) previewBox.classList.remove('hidden');
    const confirmBtn = document.getElementById('confirmBatchImportBtn');
    if (confirmBtn) confirmBtn.disabled = false;
}

function removeBatchItem(index) {
    parsedBatchList.splice(index, 1);
    renderBatchPreview();
}

async function handleRunBatchAiAutoFill() {
    const btn = document.getElementById('batchAiFillBtn');
    const progressContainer = document.getElementById('batchProgressContainer');
    const progressBar = document.getElementById('batchProgressBar');
    const progressText = document.getElementById('batchProgressText');
    const progressPercent = document.getElementById('batchProgressPercent');

    if (btn) btn.disabled = true;
    if (progressContainer) progressContainer.classList.remove('hidden');

    await runBatchAiAutoFill(parsedBatchList, (current, total) => {
        const pct = Math.round((current / total) * 100);
        if (progressText) progressText.innerText = t('progressBatchAi', { current, total });
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressPercent) progressPercent.innerText = `${pct}%`;
        renderBatchPreview();
    });

    renderBatchPreview();

    if (progressBar) progressBar.style.width = `100%`;
    if (progressPercent) progressPercent.innerText = `100%`;
    if (progressText) progressText.innerText = t('progressAiComplete');
    if (btn) btn.disabled = false;
    showToast(t('toastAiBatchSuccess'), 'success');
}

function resetBatchModal() {
    parsedBatchList = [];
    
    const rawInput = document.getElementById('batchRawInput');
    if (rawInput) rawInput.value = '';

    const previewBox = document.getElementById('batchPreviewBox');
    if (previewBox) previewBox.classList.add('hidden');

    const previewBody = document.getElementById('batchPreviewBody');
    if (previewBody) previewBody.innerHTML = '';

    const confirmBtn = document.getElementById('confirmBatchImportBtn');
    if (confirmBtn) confirmBtn.disabled = true;

    const progressContainer = document.getElementById('batchProgressContainer');
    if (progressContainer) progressContainer.classList.add('hidden');

    const progressBar = document.getElementById('batchProgressBar');
    if (progressBar) progressBar.style.width = '0%';
}

function handleConfirmBatchImport() {
    if (!parsedBatchList || parsedBatchList.length === 0) return;

    const defaultCatName = t('defaultCategoryName');
    const targetCatElem = document.getElementById('batchTargetCategory');
    const targetCategory = targetCatElem ? (targetCatElem.value.trim() || defaultCatName) : defaultCatName;
    let addedCount = 0;
    let replacedCount = 0;

    parsedBatchList.forEach(item => {
        if (item && item.word) {
            const itemWord = String(item.word).trim();

            const existingIndex = wordList.findIndex(w => 
                (w.category || defaultCatName).toLowerCase() === targetCategory.toLowerCase() &&
                w.word.trim().toLowerCase() === itemWord.toLowerCase()
            );

            if (existingIndex !== -1) {
                wordList.splice(existingIndex, 1);
                replacedCount++;
            }

            wordList.unshift({
                id: 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                category: targetCategory,
                word: itemWord,
                pos: String(item.pos || '').trim(),
                phonetic: String(item.phonetic || '').trim(),
                meaning: String(item.meaning || t('noMeaning')).trim(),
                sentence: String(item.sentence || '').trim(),
                translation: String(item.translation || '').trim(),
                level: 1, 
                knowStreak: 0, 
                updatedAt: Date.now()
            });
            addedCount++;
        }
    });

    updateCategorySelects();
    updateUI();
    if (!currentCard) nextCard();

    closeModal('batchModal');

    const netUniqueAdded = addedCount - replacedCount;
    const msg = replacedCount > 0 
        ? t('toastImportSuccessDeDup', { count: addedCount, dedup: replacedCount, actual: netUniqueAdded })
        : t('toastImportSuccess', { count: addedCount });

    showToast(msg, 'success');
    saveStorage();
}

function openSplitDeckModal() {
    updateCategorySelects();
    openModal('splitModal');
}

function handleConfirmSplitDeck() {
    const select = document.getElementById('splitTargetCategorySelect');
    const chunkSizeInput = document.getElementById('splitChunkSizeInput');

    const targetCat = select ? select.value : '';
    const chunkSize = parseInt(chunkSizeInput.value, 10) || 200;

    if (!targetCat) {
        showToast(t('toastSelectSplitDeck'), 'warning');
        return;
    }

    const defaultCatName = t('defaultCategoryName');
    const targetWords = wordList.filter(w => (w.category || defaultCatName) === targetCat);
    if (targetWords.length === 0 || targetWords.length <= chunkSize) {
        showToast(t('toastSplitThreshold', { size: chunkSize }), 'info');
        return;
    }

    let partNum = 1;
    for (let i = 0; i < targetWords.length; i += chunkSize) {
        const chunk = targetWords.slice(i, i + chunkSize);
        const newCatName = `${targetCat} - ${partNum}`;
        chunk.forEach(w => {
            w.category = newCatName;
        });
        partNum++;
    }

    saveStorage();
    updateCategorySelects();
    updateUI();
    closeModal('splitModal');
    showToast(t('toastSplitSuccess', { count: partNum - 1 }), 'success');
}

function handleSaveApiKey() {
    const keyInput = document.getElementById('geminiApiKeyInput');
    const key = keyInput ? keyInput.value.trim() : '';
    if (!key) {
        showToast(t('toastEnterApiKey'), 'warning');
        return;
    }
    localStorage.setItem(API_KEY_STORAGE_NAME, key);
    
    if (typeof updateApiKeyStatusUI === 'function') {
        updateApiKeyStatusUI();
    }

    if (typeof saveStorage === 'function') {
        saveStorage();
    }

    closeModal('keyModal');
    showToast(t('toastKeySaved'), 'success');
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (typeof applyLanguageUI === 'function') {
        applyLanguageUI();
    }

    if (id === 'keyModal') {
        const existingKey = localStorage.getItem(API_KEY_STORAGE_NAME) || '';
        const keyInput = document.getElementById('geminiApiKeyInput');
        if (keyInput) keyInput.value = existingKey;

        if (existingKey) {
            showToast(t('toastKeyLoaded'), "info");
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
        if (titleElem) titleElem.innerText = t('modalTitleAdd');
    }
    if (id === 'batchModal') {
        resetBatchModal();
    }
}

function exportJSON() {
    const select = document.getElementById('exportCategorySelect');
    const cat = select ? select.value : 'ALL';
    const defaultCatName = t('defaultCategoryName');

    let exportData = wordList;
    if (cat !== 'ALL') {
        exportData = wordList.filter(w => (w.category || defaultCatName) === cat);
    }

    if (exportData.length === 0) {
        showToast(t('toastNoExportWords'), "warning");
        return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `flashcards_backup_${cat}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast(t('toastDownloadSuccess', { count: exportData.length }), "success");
}

function handleImportJSON() {
    const fileInput = document.getElementById('jsonFileInput');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast(t('toastSelectJsonFirst'), "warning");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData)) {
                showToast(t('toastJsonFormatError'), "error");
                return;
            }

            const defaultCatName = t('defaultCategoryName');
            let addedCount = 0;
            let replacedCount = 0;

            importedData.forEach(item => {
                if (item && item.word) {
                    const itemCat = String(item.category || defaultCatName).trim();
                    const itemWord = String(item.word).trim();

                    const existingIndex = wordList.findIndex(w => 
                        (w.category || defaultCatName).toLowerCase() === itemCat.toLowerCase() &&
                        w.word.trim().toLowerCase() === itemWord.toLowerCase()
                    );

                    if (existingIndex !== -1) {
                        wordList.splice(existingIndex, 1);
                        replacedCount++;
                    }

                    wordList.unshift({
                        id: item.id || ('w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
                        category: itemCat,
                        word: itemWord,
                        pos: String(item.pos || '').trim(),
                        phonetic: String(item.phonetic || '').trim(),
                        meaning: String(item.meaning || t('noMeaning')).trim(),
                        sentence: String(item.sentence || '').trim(),
                        translation: String(item.translation || '').trim(),
                        level: item.level || 1,
                        knowStreak: item.knowStreak || 0,
                        updatedAt: Date.now()
                    });
                    addedCount++;
                }
            });

            await saveStorage();
            updateCategorySelects();
            updateUI();
            if (!currentCard) nextCard();

            closeModal('backupModal');
            fileInput.value = '';

            const netUniqueAdded = addedCount - replacedCount;
            const msg = replacedCount > 0 
                ? t('toastImportSuccessDeDup', { count: addedCount, dedup: replacedCount, actual: netUniqueAdded })
                : t('toastImportSuccess', { count: addedCount });

            showToast(msg, "success");

        } catch (err) {
            console.error("JSON 解析失敗:", err);
            showToast(t('toastJsonParseError'), "error");
        }
    };

    reader.readAsText(file);
}

function handleThemeChange(mode) {
    localStorage.setItem('theme_preference', mode);
    applyTheme(mode);
}

function applyTheme(mode) {
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (mode === 'dark' || (mode === 'system' && isSystemDark)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const preference = localStorage.getItem('theme_preference') || 'system';
    if (preference === 'system') {
        applyTheme('system');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const preference = localStorage.getItem('theme_preference') || 'system';
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = preference;
    applyTheme(preference);
});

async function handleQuickAddWords() {
    const inputElem = document.getElementById('quickAddInput');
    const rawText = inputElem ? inputElem.value.trim() : '';

    if (!rawText) {
        showToast(t('toastEnterQuickWords'), 'warning');
        return;
    }

    const wordsToProcess = rawText
        .split(/[,;\n\r\t，；]+/)
        .map(w => w.trim())
        .filter(w => w.length > 0);

    if (wordsToProcess.length === 0) {
        showToast(t('toastNoValidQuickWords'), 'warning');
        return;
    }

    const btn = document.getElementById('quickAddConfirmBtn');
    const origText = btn ? btn.innerText : '';
    if (btn) {
        btn.disabled = true;
        btn.innerText = t('btnProcessing');
    }

    const defaultCategoryName = t('defaultCategoryName');
    const defaultMeaningText = t('progressAiParsing');

    const targetCategory = (typeof selectedCategory !== 'undefined' && selectedCategory !== 'ALL') 
        ? selectedCategory 
        : defaultCategoryName;

    let addedList = [];

    for (const rawWord of wordsToProcess) {
        const exists = wordList.some(w => 
            (w.category || defaultCategoryName).toLowerCase() === targetCategory.toLowerCase() && 
            w.word.toLowerCase() === rawWord.toLowerCase()
        );

        if (!exists) {
            const newCard = {
                id: 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                category: targetCategory,
                word: rawWord,
                pos: '',
                phonetic: '',
                meaning: defaultMeaningText,
                sentence: '',
                translation: '',
                level: 1,
                knowStreak: 0,
                updatedAt: Date.now()
            };
            wordList.unshift(newCard);
            addedList.push(newCard);
        }
    }

    closeModal('quickAddModal');
    if (inputElem) inputElem.value = '';
    if (btn) {
        btn.disabled = false;
        btn.innerText = origText;
    }

    if (addedList.length === 0) {
        showToast(t('toastQuickWordsExist'), 'info');
        return;
    }

    saveStorage();
    if (typeof updateCategorySelects === 'function') updateCategorySelects();
    if (typeof updateUI === 'function') updateUI();

    if (typeof nextCard === 'function') {
        nextCard();
    }
    if (!currentCard || currentCard.word === t('noWordAvailable')) {
        currentCard = addedList[0];
        const wordElem = document.getElementById('cardWord');
        const meaningElem = document.getElementById('cardMeaning');
        if (wordElem) wordElem.innerText = currentCard.word;
        if (meaningElem) meaningElem.innerText = currentCard.meaning || defaultMeaningText;
    }

    if (typeof initQuiz === 'function') {
        initQuiz();
    } else if (typeof startQuiz === 'function') {
        startQuiz();
    } else if (typeof nextQuizQuestion === 'function') {
        nextQuizQuestion();
    }

    showToast(t('toastQuickAddSuccess', { count: addedList.length }), 'success');

    if (typeof runBatchAiAutoFill === 'function') {
        try {
            await runBatchAiAutoFill(addedList, (current, total) => {
                saveStorage();
                if (typeof updateUI === 'function') updateUI();
            });
            
            saveStorage();
            if (typeof updateUI === 'function') updateUI();

            if (currentCard) {
                const updated = wordList.find(w => w.id === currentCard.id);
                if (updated) {
                    currentCard = updated;
                    if (typeof nextCard === 'function') nextCard();
                }
            }
            showToast(t('toastAiCompletionDone'), 'success');
        } catch (err) {
            console.warn("AI 自動補充跳過或失敗:", err);
        }
    }
}

function syncSettingsUI() {
    const savedNative = localStorage.getItem('lzhcard_native_lang') || 'zh-TW';
    const savedTarget = localStorage.getItem('lzhcard_target_lang') || 'en';
    const customNative = localStorage.getItem('lzhcard_custom_native') || '';
    const customTarget = localStorage.getItem('lzhcard_custom_target') || '';
    const savedDisplayMode = localStorage.getItem('lzhcard_display_mode') || 'target_front';
    const savedTheme = localStorage.getItem('theme_preference') || 'system';

    const nativeSelect = document.getElementById('nativeLangSelect');
    if (nativeSelect) nativeSelect.value = savedNative;

    const targetSelect = document.getElementById('targetLangSelect');
    if (targetSelect) targetSelect.value = savedTarget;

    const displaySelect = document.getElementById('cardDisplayModeSelect');
    if (displaySelect) displaySelect.value = savedDisplayMode;

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = savedTheme;

    const customNativeInput = document.getElementById('customNativeInput');
    if (customNativeInput) {
        customNativeInput.value = customNative;
        customNativeInput.classList.toggle('hidden', savedNative !== 'custom');
    }

    const customTargetInput = document.getElementById('customTargetInput');
    if (customTargetInput) {
        customTargetInput.value = customTarget;
        customTargetInput.classList.toggle('hidden', savedTarget !== 'custom');
    }
}

function initLanguageSettings() {
    if (!localStorage.getItem('lzhcard_native_lang')) {
        const navLang = (navigator.language || '').toLowerCase();
        if (navLang.startsWith('zh')) {
            localStorage.setItem('lzhcard_native_lang', 'zh-TW');
        } else if (navLang.startsWith('ja')) {
            localStorage.setItem('lzhcard_native_lang', 'ja');
        } else {
            localStorage.setItem('lzhcard_native_lang', 'en');
        }
    }

    if (!localStorage.getItem('lzhcard_target_lang')) {
        localStorage.setItem('lzhcard_target_lang', 'en');
    }

    syncSettingsUI();

    if (typeof applyLanguageUI === 'function') {
        applyLanguageUI();
    }
}

function handleNativeLangChange(lang) {
    localStorage.setItem('lzhcard_native_lang', lang);
    syncSettingsUI();

    if (typeof applyLanguageUI === 'function') {
        applyLanguageUI();
    }

    showToast(t('toastNativeLangUpdated'), 'info');
    if (typeof saveStorage === 'function') saveStorage();
}

function handleTargetLangChange(lang) {
    localStorage.setItem('lzhcard_target_lang', lang);
    syncSettingsUI();
    showToast(t('toastTargetLangUpdated'), 'info');
    if (typeof saveStorage === 'function') saveStorage();
}

function handleCustomLangChange(type, value) {
    const cleanValue = value.trim();
    if (type === 'native') {
        localStorage.setItem('lzhcard_custom_native', cleanValue);
        if (cleanValue && typeof translateUiWithAI === 'function') {
            translateUiWithAI(cleanValue);
        }
    } else if (type === 'target') {
        localStorage.setItem('lzhcard_custom_target', cleanValue);
    }
    if (typeof saveStorage === 'function') saveStorage();
}

function handleCardDisplayModeChange(mode) {
    localStorage.setItem('lzhcard_display_mode', mode);
    updateUI();
    nextCard();
    showToast(t('toastDisplayModeUpdated'), 'success');
    if (typeof saveStorage === 'function') saveStorage();
}

function handleThemeChange(mode) {
    localStorage.setItem('theme_preference', mode);
    applyTheme(mode);
    if (typeof saveStorage === 'function') saveStorage();
}

document.addEventListener('DOMContentLoaded', () => {
    initLanguageSettings();

    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(() => {
            if (typeof applyLanguageUI === 'function') applyLanguageUI();
        });
    }
});

/**
 * 📊 渲染統計成果面板 (根據使用者勾選項目動態產生卡片)
 */
function renderStats() {
    const container = document.getElementById('statsContainer');
    if (!container) return;

    const showTotal = document.getElementById('chkShowTotal')?.checked ?? true;
    const showLevel = document.getElementById('chkShowLevel')?.checked ?? true;
    const showCategory = document.getElementById('chkShowCategory')?.checked ?? true;
    const showCatLevel = document.getElementById('chkShowCatLevel')?.checked ?? true;

    const defaultCatName = typeof t === 'function' ? t('defaultCategoryName') : '預設字庫';
    const totalWords = wordList.length;

    // 1. 統計總體記憶等級分佈 (Lv.1~5)
    const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    // 2. 統計各字庫細節 (含字庫總數與等級分佈)
    const catStats = {};

    wordList.forEach(w => {
        const lv = Math.min(5, Math.max(1, w.level || 1));
        const cat = w.category || defaultCatName;

        levelCounts[lv]++;

        if (!catStats[cat]) {
            catStats[cat] = { total: 0, levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
        }
        catStats[cat].total++;
        catStats[cat].levels[lv]++;
    });

    const masteredCount = levelCounts[4] + levelCounts[5];
    const masterRate = totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0;

    let html = '';

    // -------------------------------------------------------------
    // 卡片 A: 總單字量與掌握率
    // -------------------------------------------------------------
    if (showTotal) {
        html += `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4">
                    <div class="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center text-brand-600 dark:text-brand-400 text-2xl font-bold">
                        <i class="fa-solid fa-book-bookmark"></i>
                    </div>
                    <div>
                        <span class="text-xs font-semibold text-slate-400 block">${t('statsTotalWords')}</span>
                        <span class="text-2xl font-black text-slate-900 dark:text-white">${totalWords} <span class="text-xs font-normal text-slate-400">${t('unitItem')}</span></span>
                    </div>
                </div>

                <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-2xl font-bold">
                        <i class="fa-solid fa-award"></i>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-center">
                            <span class="text-xs font-semibold text-slate-400 block">${t('statsMasteredRate')}</span>
                            <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">${masterRate}%</span>
                        </div>
                        <span class="text-2xl font-black text-slate-900 dark:text-white">${masteredCount} <span class="text-xs font-normal text-slate-400">${t('unitItem')}</span></span>
                        <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                            <div class="h-full bg-emerald-500 rounded-full transition-all duration-500" style="width: ${masterRate}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // -------------------------------------------------------------
    // 卡片 B: 全局艾賓浩斯等級熟悉度分佈 (Lv.1~5)
    // -------------------------------------------------------------
    if (showLevel) {
        const lvColors = {
            1: { bg: 'bg-rose-500', badge: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
            2: { bg: 'bg-amber-500', badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
            3: { bg: 'bg-blue-500', badge: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
            4: { bg: 'bg-indigo-500', badge: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
            5: { bg: 'bg-emerald-500', badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' }
        };

        html += `
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>${t('statsLevelDetail')}</span>
                </h3>
                <div class="space-y-3">
        `;

        for (let lv = 1; lv <= 5; lv++) {
            const count = levelCounts[lv];
            const pct = totalWords > 0 ? Math.round((count / totalWords) * 100) : 0;
            const lvInfo = (typeof getLevelInfo === 'function') ? getLevelInfo(lv) : { name: `Lv.${lv}` };

            html += `
                <div class="space-y-1">
                    <div class="flex justify-between items-center text-xs">
                        <span class="px-2 py-0.5 rounded text-[11px] font-bold border ${lvColors[lv].badge}">
                            Lv.${lv} - ${lvInfo.name}
                        </span>
                        <span class="font-bold text-slate-700 dark:text-slate-300">${count} ${t('unitItem')} <span class="text-slate-400 font-normal">(${pct}%)</span></span>
                    </div>
                    <div class="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div class="h-full ${lvColors[lv].bg} rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        }

        html += `</div></div>`;
    }

    // -------------------------------------------------------------
    // 卡片 C & D: 各字庫/語言分佈與等級細節
    // -------------------------------------------------------------
    if (showCategory || showCatLevel) {
        const catKeys = Object.keys(catStats);

        html += `
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">${t('statsCatBreakdown')}</h3>
                <div class="divide-y divide-slate-100 dark:divide-slate-700">
        `;

        catKeys.forEach(cat => {
            const data = catStats[cat];
            const catPct = totalWords > 0 ? Math.round((data.total / totalWords) * 100) : 0;
            const catMastered = data.levels[4] + data.levels[5];
            const catMasterRate = data.total > 0 ? Math.round((catMastered / data.total) * 100) : 0;

            html += `
                <div class="py-4 first:pt-0 last:pb-0 space-y-2">
                    <div class="flex justify-between items-center">
                        <div>
                            <span class="font-bold text-slate-800 dark:text-slate-200 text-sm">${cat}</span>
                            <span class="text-xs text-slate-400 ml-2">(${data.total} ${t('unitItem')} / ${catPct}%)</span>
                        </div>
                        <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            ${t('accuracyRate')} ${catMasterRate}%
                        </span>
                    </div>
            `;

            // 顯示各字庫等級分佈調（若勾選 ShowCatLevel）
            if (showCatLevel) {
                html += `<div class="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full flex overflow-hidden">`;
                const colorMap = { 1: 'bg-rose-500', 2: 'bg-amber-500', 3: 'bg-blue-500', 4: 'bg-indigo-500', 5: 'bg-emerald-500' };
                for (let lv = 1; lv <= 5; lv++) {
                    const c = data.levels[lv];
                    if (c > 0) {
                        const p = ((c / data.total) * 100).toFixed(1);
                        html += `<div class="h-full ${colorMap[lv]}" style="width: ${p}%" title="Lv.${lv}: ${c}字 (${p}%)"></div>`;
                    }
                }
                html += `</div>`;
            }

            html += `</div>`;
        });

        html += `</div></div>`;
    }

    container.innerHTML = html || `<div class="text-center text-slate-400 text-xs py-10">請最少勾選一個顯示指標</div>`;
}