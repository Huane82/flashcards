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
    if (!wordList || !Array.isArray(wordList)) return ['預設字庫'];
    const categories = new Set();
    wordList.forEach(w => {
        if (w.category && w.category.trim() !== '') {
            categories.add(w.category.trim());
        }
    });
    if (categories.size === 0) categories.add('預設字庫');
    return Array.from(categories);
}

window.addEventListener('DOMContentLoaded', async () => {
    if (typeof loadStorage === 'function') {
        await loadStorage();
    }
});

function updateCategorySelects() {
    const cats = getAllCategories();

    const filterSelect = document.getElementById('categoryFilterSelect');
    if (filterSelect) {
        const cur = filterSelect.value;
        filterSelect.innerHTML = `<option value="ALL">全部字庫 (共 ${wordList.length} 字)</option>` + 
            cats.map(c => {
                const count = wordList.filter(w => (w.category || "預設字庫") === c).length;
                return `<option value="${c}">${c} (${count} 字)</option>`;
            }).join('');
        filterSelect.value = cats.includes(cur) || cur === 'ALL' ? cur : 'ALL';
    }

    const exportSelect = document.getElementById('exportCategorySelect');
    if (exportSelect) {
        exportSelect.innerHTML = `<option value="ALL">包含全部字庫</option>` + 
            cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    const splitSelect = document.getElementById('splitTargetCategorySelect');
    if (splitSelect) {
        splitSelect.innerHTML = cats.map(c => {
            const count = wordList.filter(w => (w.category || "預設字庫") === c).length;
            return `<option value="${c}">${c} (${count} 字)</option>`;
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
    const filteredList = wordList.filter(w => {
        if (typeof selectedCategory === 'undefined' || selectedCategory === "ALL") return true;
        return (w.category || "預設字庫") === selectedCategory;
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

    renderWordList();
    updateBatchBadgeUI();
}

function nextCard() {
    const flashcardElem = document.getElementById('flashcard');

    // 🌟 關鍵修復：切換下一張卡片時，先「無視覺動畫」瞬間切回正面，徹底防止背面文字被閃爍看見[cite: 2]
    if (flashcardElem) {
        flashcardElem.classList.add('no-transition');
        flashcardElem.classList.remove('rotate-y-180');
        // 強制瀏覽器即時重繪 (Reflow)，確保在寫入新單字文字前，卡片早已回到正面
        void flashcardElem.offsetHeight;
        flashcardElem.classList.remove('no-transition');
    }

    currentCard = getNextCardSpacedRepetition();

    if (!currentCard) {
        if (document.getElementById('cardWord')) document.getElementById('cardWord').innerText = "無可用單字";
        if (document.getElementById('cardPhonetic')) document.getElementById('cardPhonetic').innerText = "/---/";
        if (document.getElementById('cardPosFront')) document.getElementById('cardPosFront').innerText = "EMPTY";
        if (document.getElementById('cardPosBack')) document.getElementById('cardPosBack').innerText = "EMPTY";
        if (document.getElementById('cardMeaning')) document.getElementById('cardMeaning').innerText = "請選擇其他字庫或匯入單字";
        if (document.getElementById('cardSentence')) document.getElementById('cardSentence').innerText = "當前選取字庫無庫存。";
        if (document.getElementById('cardTranslation')) document.getElementById('cardTranslation').innerText = "請選取字庫。";
        return;
    }

    const lvInfo = getLevelInfo(currentCard.level || 1);
    const streak = currentCard.knowStreak || 0;

    const streakTextElem = document.getElementById('knowStreakText');
    if (streakTextElem) streakTextElem.innerText = `${streak}/3`;

    // 🌐 讀取卡片正反面顯示模式設定 (外文在正面 / 中文在正面 / 雙語對照)
    const displayMode = localStorage.getItem('lzhcard_display_mode') || 'target_front';
    const wordText = currentCard.word || '';
    const meaningText = currentCard.meaning || '';

    const frontWordElem = document.getElementById('cardWord');
    const backMeaningElem = document.getElementById('cardMeaning');

    if (displayMode === 'native_front') {
        // 🇹🇼 中文在正面，外文在背面
        if (frontWordElem) frontWordElem.innerText = meaningText || '（無中文釋義）';
        if (backMeaningElem) backMeaningElem.innerText = wordText;
    } else if (displayMode === 'both_front') {
        // ✨ 正面同時顯示 (雙語對照)
        if (frontWordElem) frontWordElem.innerHTML = `${wordText}<div class="text-xl sm:text-2xl font-medium text-amber-500 dark:text-amber-400 mt-2">${meaningText}</div>`;
        if (backMeaningElem) backMeaningElem.innerText = `${wordText} - ${meaningText}`;
    } else {
        // 🔤 外文在正面，中文在背面 (預設)
        if (frontWordElem) frontWordElem.innerText = wordText;
        if (backMeaningElem) backMeaningElem.innerText = meaningText;
    }

    if (document.getElementById('cardPhonetic')) document.getElementById('cardPhonetic').innerText = currentCard.phonetic || '/---/';
    if (document.getElementById('cardPosFront')) document.getElementById('cardPosFront').innerText = currentCard.pos || 'N/A';
    
    const levelFront = document.getElementById('cardLevelFront');
    if (levelFront) {
        levelFront.innerText = `${currentCard.category || '預設'} | ${lvInfo.name}`;
        levelFront.className = `px-2.5 py-1 rounded-full text-xs font-bold border ${lvInfo.color}`;
    }

    if (document.getElementById('cardPosBack')) document.getElementById('cardPosBack').innerText = currentCard.pos || 'N/A';
    const levelBack = document.getElementById('cardLevelBack');
    if (levelBack) {
        levelBack.innerText = `${currentCard.category || '預設'} | ${lvInfo.name}`;
        levelBack.className = `px-2.5 py-1 rounded-full text-xs font-bold border ${lvInfo.color}`;
    }

    if (document.getElementById('cardSentence')) document.getElementById('cardSentence').innerText = currentCard.sentence ? `"${currentCard.sentence}"` : '"無例句資訊"';
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

/**
 * 切換頁面 (Home, List, Store, Settings)
 */
function switchTab(tab) {
    const secHome = document.getElementById('sec-home');
    const secFlashcard = document.getElementById('sec-flashcard');
    const secQuiz = document.getElementById('sec-quiz');
    const secList = document.getElementById('sec-list');
    const secStore = document.getElementById('sec-store');
    const secSettings = document.getElementById('sec-settings');

    const bnavHome = document.getElementById('bnav-home');
    const bnavList = document.getElementById('bnav-list');
    const bnavStore = document.getElementById('bnav-store');
    const bnavSettings = document.getElementById('bnav-settings');

    [secHome, secFlashcard, secQuiz, secList, secStore, secSettings].forEach(el => el && el.classList.add('hidden'));

    [bnavHome, bnavList, bnavStore, bnavSettings].forEach(el => {
        if (el) el.className = "flex flex-col items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 space-y-1";
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
    }
}

/**
 * 進入專注全螢幕模式 (輪播 / 測驗)
 */
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
        if (emailSpan) emailSpan.textContent = '訪客模式';
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
    
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const sortBy = sortSelect ? sortSelect.value : 'default';

    let filtered = wordList.filter(item => {
        const matchesSearch = (item.word || '').toLowerCase().includes(search) ||
            (item.meaning && item.meaning.toLowerCase().includes(search)) ||
            (item.category && item.category.toLowerCase().includes(search)) ||
            (item.pos && item.pos.toLowerCase().includes(search));
            
        const matchesCategory = (typeof selectedCategory === 'undefined' || selectedCategory === "ALL") 
            ? true 
            : (item.category || "預設字庫") === selectedCategory;
            
        return matchesSearch && matchesCategory;
    });

    filtered.sort((a, b) => {
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

    const filtered = getFilteredWords();

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-folder-open text-2xl mb-2 block"></i>
                    查無相關單字資料
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
                        <span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">${item.category || '預設字庫'}</span>
                    </td>
                    <td class="py-3 px-3">
                        <span class="px-2 py-0.5 rounded text-xs font-semibold ${lvInfo.color} border">${lvInfo.name}</span>
                    </td>
                    <td class="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                        ${item.meaning || ''}
                    </td>
                    <td class="py-3 px-3 text-right space-x-2">
                        <button type="button" onclick="editCard('${item.id}')" class="p-1.5 text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-700 rounded transition" title="編輯">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" onclick="deleteCard('${item.id}')" class="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded transition" title="刪除">
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
        badge.innerText = `${selectedWordIds.size} 筆`;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function handleBatchChangeCategory() {
    if (selectedWordIds.size === 0) {
        showToast("請先勾選要變更字庫的單字！", 'warning');
        return;
    }

    const newCategory = prompt(`將已選取的 ${selectedWordIds.size} 筆單字移至新的字庫名稱：`, selectedCategory === 'ALL' ? '新字庫' : selectedCategory);
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
    showToast(`成功將 ${count} 筆單字移至【${catName}】！`, 'success');
}

function handleBatchDeleteWords() {
    if (selectedWordIds.size === 0) {
        showToast("請先勾選要刪除的單字！", 'warning');
        return;
    }

    if (confirm(`確定要批量刪除已勾選的 ${selectedWordIds.size} 筆單字嗎？此操作無法復原！`)) {
        wordList = wordList.filter(item => !selectedWordIds.has(item.id));
        selectedWordIds.clear();
        saveStorage();
        updateCategorySelects();
        updateUI();
        nextCard();
        showToast("批量刪除成功！", 'info');
    }
}

async function handleBatchAiFillLibraryWords() {
    let targetWords = [];
    if (selectedWordIds.size > 0) {
        targetWords = wordList.filter(item => selectedWordIds.has(item.id));
    } else {
        targetWords = wordList.filter(item => {
            if (typeof selectedCategory === 'undefined' || selectedCategory === "ALL") return true;
            return (item.category || "預設字庫") === selectedCategory;
        });
    }

    if (targetWords.length === 0) {
        showToast("目前列表中無可補充的單字！", 'warning');
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
        showToast("所選單字皆已具備完整資料！", 'info');
        return;
    }

    if (incompleteWords.length > MAX_AI_BATCH_LIMIT) {
        showToast(`待補齊單字共 ${incompleteWords.length} 筆，超過單次 50 筆限制！`, 'error');
        return;
    }

    if (!confirm(`找到 ${incompleteWords.length} 筆缺漏欄位的單字，確定要讓 AI 自動補充嗎？`)) {
        return;
    }

    const progressContainer = document.getElementById('libAiProgressContainer');
    const progressBar = document.getElementById('libAiProgressBar');
    const progressText = document.getElementById('libAiProgressText');
    const progressPercent = document.getElementById('libAiProgressPercent');

    if (progressContainer) progressContainer.classList.remove('hidden');

    await runBatchAiAutoFill(targetWords, (current, total) => {
        const pct = Math.round((current / total) * 100);
        if (progressText) progressText.innerText = `AI 補充進度 (${current} / ${total})...`;
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressPercent) progressPercent.innerText = `${pct}%`;
        renderWordList();
    });

    saveStorage();
    updateUI();

    if (progressText) progressText.innerText = "✨ 批量補充完成！";
    if (progressBar) progressBar.style.width = "100%";
    if (progressPercent) progressPercent.innerText = "100%";

    setTimeout(() => {
        if (progressContainer) progressContainer.classList.add('hidden');
    }, 2500);

    showToast(`🎉 成功自動補齊 ${incompleteWords.length} 筆單字！`, 'success');
}

function editCard(id) {
    const item = wordList.find(w => w.id === id);
    if (!item) return;

    document.getElementById('editCardId').value = item.id;
    document.getElementById('formCategory').value = item.category || '預設字庫';
    document.getElementById('formWord').value = item.word || '';
    document.getElementById('formPos').value = item.pos || '';
    document.getElementById('formPhonetic').value = item.phonetic || '';
    document.getElementById('formMeaning').value = item.meaning || '';
    document.getElementById('formSentence').value = item.sentence || '';
    document.getElementById('formTranslation').value = item.translation || '';

    document.getElementById('cardModalTitle').innerText = "編輯單字卡";
    openModal('cardModal');
}

function deleteCard(id) {
    if (confirm("確定要刪除這張單字卡嗎？")) {
        wordList = wordList.filter(w => w.id !== id);
        selectedWordIds.delete(id);
        saveStorage();
        updateCategorySelects();
        updateUI();
        if (currentCard && currentCard.id === id) nextCard();
        showToast("單字已刪除", 'info');
    }
}

function handleClearAllWords() {
    if (confirm("警告：此操作將清空全部單字庫，無法復原！確定要清空嗎？")) {
        wordList = [];
        selectedWordIds.clear();
        saveStorage();
        updateCategorySelects();
        updateUI();
        nextCard();
        showToast("字庫已清空", 'warning');
    }
}

function handleSaveCardForm(e) {
    e.preventDefault();
    const id = document.getElementById('editCardId').value;
    const category = document.getElementById('formCategory').value.trim() || '預設字庫';
    const rawWord = document.getElementById('formWord').value.trim();
    const rawPos = document.getElementById('formPos').value.trim();
    const phonetic = document.getElementById('formPhonetic').value.trim();
    const rawMeaning = document.getElementById('formMeaning').value.trim() || '尚未填寫釋義';
    const sentence = document.getElementById('formSentence').value.trim();
    const translation = document.getElementById('formTranslation').value.trim();

    if (!rawWord) {
        showToast("請填寫單字！", 'warning');
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
                updatedAt: Date.now() 
            };
        }
        showToast("單字卡已儲存", 'success');
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
            level: 1, knowStreak: 0, updatedAt: Date.now()
        };
        wordList.unshift(newCard);
        showToast("成功新增單字卡", 'success');
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
        showToast("請先輸入英文單字！", 'warning');
        return;
    }

    const btn = document.getElementById('aiGenerateBtn');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>AI 解析中...</span>`;

    const result = await autoFillWithAI(word);
    if (result) {
        if (result.pos) document.getElementById('formPos').value = result.pos;
        if (result.phonetic) document.getElementById('formPhonetic').value = result.phonetic;
        if (result.meaning) document.getElementById('formMeaning').value = result.meaning;
        if (result.sentence) document.getElementById('formSentence').value = result.sentence;
        if (result.translation) document.getElementById('formTranslation').value = result.translation;
        showToast("AI 自動帶入完成", 'success');
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
    if (!confirm(`確定要載入【Level ${levelNum}】高中單字嗎？`)) return;

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
        btn.innerText = "下載中...";
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
        showToast("⚠️ 無法連線至字庫伺服器", 'error');
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
        showToast(`找不到 Level ${levelNum} 的單字資料。`, 'warning');
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
    showToast(`解析【${catName}】共 ${parsedBatchList.length} 筆單字成功！`, 'success');
}

function handleParseBatchText() {
    const raw = document.getElementById('batchRawInput').value.trim();
    if (!raw) {
        showToast("請先貼入單字資料！", 'warning');
        return;
    }

    parsedBatchList = parseBatchText(raw);
    if (parsedBatchList.length === 0) {
        showToast("無法解析輸入內容，請確認格式。", 'error');
        return;
    }

    renderBatchPreview();
    showToast(`成功解析 ${parsedBatchList.length} 筆單字`, 'success');
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

    if (previewBody) {
        previewBody.innerHTML = parsedBatchList.map((item, idx) => {
            const isComplete = item.word && item.meaning && item.pos;
            const statusBadge = isComplete ? 
                `<span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">完整</span>` :
                `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">待補齊</span>`;

            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td class="p-2 border-b dark:border-slate-700 font-bold">${item.word}</td>
                    <td class="p-2 border-b dark:border-slate-700">${item.pos || '-'}</td>
                    <td class="p-2 border-b dark:border-slate-700">${item.meaning || '-'}</td>
                    <td class="p-2 border-b dark:border-slate-700">${statusBadge}</td>
                    <td class="p-2 border-b dark:border-slate-700 text-right">
                        <button type="button" onclick="removeBatchItem(${idx})" class="text-rose-600 hover:text-rose-800 font-bold px-2 py-0.5 rounded hover:bg-rose-50 transition" title="剔除此單字">
                            <i class="fa-solid fa-trash"></i> 移除
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
        if (progressText) progressText.innerText = `AI 正在補齊單字 (${current} / ${total})...`;
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressPercent) progressPercent.innerText = `${pct}%`;
        renderBatchPreview();
    });

    renderBatchPreview();

    if (progressBar) progressBar.style.width = `100%`;
    if (progressPercent) progressPercent.innerText = `100%`;
    if (progressText) progressText.innerText = "補齊完成！";
    if (btn) btn.disabled = false;
    showToast("AI 批量補充完成", 'success');
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

    const targetCatElem = document.getElementById('batchTargetCategory');
    const targetCategory = targetCatElem ? (targetCatElem.value.trim() || '預設字庫') : '預設字庫';
    let addedCount = 0;
    let replacedCount = 0;

    parsedBatchList.forEach(item => {
        if (item && item.word) {
            const itemWord = String(item.word).trim();

            const existingIndex = wordList.findIndex(w => 
                (w.category || '預設字庫').toLowerCase() === targetCategory.toLowerCase() &&
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
                meaning: String(item.meaning || '尚未填寫釋義').trim(),
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
        ? `🎉 成功處理 ${addedCount} 筆資料！(自動去重 ${replacedCount} 筆重複字，實際新增 ${netUniqueAdded} 個獨立單字)`
        : `🎉 成功匯入 ${addedCount} 個單字至【${targetCategory}】字庫！`;

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
        showToast("請選擇要拆分的字庫！", 'warning');
        return;
    }

    const targetWords = wordList.filter(w => (w.category || "預設字庫") === targetCat);
    if (targetWords.length === 0 || targetWords.length <= chunkSize) {
        showToast(`字庫單字量小於拆分門檻 (${chunkSize} 字)`, 'info');
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
    showToast(`成功拆分為 ${partNum - 1} 個小字庫！`, 'success');
}

function handleSaveApiKey() {
    const keyInput = document.getElementById('geminiApiKeyInput');
    const key = keyInput ? keyInput.value.trim() : '';
    if (!key) {
        showToast("請輸入有效的 Gemini API Key！", 'warning');
        return;
    }
    localStorage.setItem(API_KEY_STORAGE_NAME, key);
    
    if (typeof updateApiKeyStatusUI === 'function') {
        updateApiKeyStatusUI();
    }

    // 🌟 關鍵：同步保存至 Firebase 雲端
    if (typeof saveStorage === 'function') {
        saveStorage();
    }

    closeModal('keyModal');
    showToast("🔑 Gemini API Key 已成功儲存並同步至雲端！", 'success');
}

/**
 * 彈窗打開 / 關閉控管
 */
function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (id === 'keyModal') {
        const existingKey = localStorage.getItem(API_KEY_STORAGE_NAME) || '';
        const keyInput = document.getElementById('geminiApiKeyInput');
        if (keyInput) keyInput.value = existingKey;

        if (existingKey) {
            showToast("🔑 已載入已儲存的 API Key", "info");
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
        if (titleElem) titleElem.innerText = "新增/編輯單字卡";
    }
    if (id === 'batchModal') {
        resetBatchModal();
    }
}

function exportJSON() {
    const select = document.getElementById('exportCategorySelect');
    const cat = select ? select.value : 'ALL';

    let exportData = wordList;
    if (cat !== 'ALL') {
        exportData = wordList.filter(w => (w.category || '預設字庫') === cat);
    }

    if (exportData.length === 0) {
        showToast("當前選擇的字庫沒有單字可供匯出！", "warning");
        return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `flashcards_backup_${cat}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast(`成功下載 ${exportData.length} 筆單字 JSON 備份！`, "success");
}

function handleImportJSON() {
    const fileInput = document.getElementById('jsonFileInput');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast("請先選擇要還原的 .json 檔案！", "warning");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData)) {
                showToast("檔案格式錯誤：必須是單字陣列 JSON！", "error");
                return;
            }

            let addedCount = 0;
            let replacedCount = 0;

            importedData.forEach(item => {
                if (item && item.word) {
                    const itemCat = String(item.category || '預設字庫').trim();
                    const itemWord = String(item.word).trim();

                    const existingIndex = wordList.findIndex(w => 
                        (w.category || '預設字庫').toLowerCase() === itemCat.toLowerCase() &&
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
                        meaning: String(item.meaning || '尚未填寫釋義').trim(),
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
                ? `🎉 成功處理 ${addedCount} 筆備份資料！(自動去重 ${replacedCount} 筆重複字，實際更新 ${netUniqueAdded} 個單字)`
                : `🎉 成功還原 ${addedCount} 筆單字！`;

            showToast(msg, "success");

        } catch (err) {
            console.error("JSON 解析失敗:", err);
            showToast("備份檔讀取失敗，請確認檔案內容格式！", "error");
        }
    };

    reader.readAsText(file);
}

/**
 * 🎨 主題/夜間模式控制器
 */
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

/**
 * ⚡ 快速收錄生字並自動觸發 AI 補充 (已修復卡片與測驗即時刷新)
 */
/**
 * ⚡ 快速收錄生字並自動觸發 AI 補充 (徹底修復卡片、測驗與字庫選單同步)
 */
async function handleQuickAddWords() {
    const inputElem = document.getElementById('quickAddInput');
    const rawText = inputElem ? inputElem.value.trim() : '';

    if (!rawText) {
        showToast("請先輸入單字！", 'warning');
        return;
    }

    // 支援換行、逗號、分號與空白分隔多個單字
    const wordsToProcess = rawText
        .split(/[,;\n\r\t，；]+/)
        .map(w => w.trim())
        .filter(w => w.length > 0);

    if (wordsToProcess.length === 0) {
        showToast("未檢測到有效的單字內容！", 'warning');
        return;
    }

    const btn = document.getElementById('quickAddConfirmBtn');
    const origText = btn ? btn.innerText : '';
    if (btn) {
        btn.disabled = true;
        btn.innerText = "處理中...";
    }

    // 判斷歸屬字庫
    const targetCategory = (typeof selectedCategory !== 'undefined' && selectedCategory !== 'ALL') 
        ? selectedCategory 
        : '預設字庫';

    let addedList = [];

    for (const rawWord of wordsToProcess) {
        // 檢查該字庫中是否已有重複單字
        const exists = wordList.some(w => 
            (w.category || '預設字庫').toLowerCase() === targetCategory.toLowerCase() && 
            w.word.toLowerCase() === rawWord.toLowerCase()
        );

        if (!exists) {
            const newCard = {
                id: 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                category: targetCategory,
                word: rawWord,
                pos: '',
                phonetic: '',
                meaning: 'AI 自動解析中...',
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

    // 關閉 Modal 並清空輸入框
    closeModal('quickAddModal');
    if (inputElem) inputElem.value = '';
    if (btn) {
        btn.disabled = false;
        btn.innerText = origText;
    }

    if (addedList.length === 0) {
        showToast("輸入的單字已存在於字庫中！", 'info');
        return;
    }

    // 1. 儲存至本機與雲端，並刷新 DOM 選單與統計數字
    saveStorage();
    if (typeof updateCategorySelects === 'function') updateCategorySelects();
    if (typeof updateUI === 'function') updateUI();

    // 2. 🌟 強制刷新卡片 (卡片輪播模式)
    if (typeof nextCard === 'function') {
        nextCard();
    }
    // 若演算法未即時抓到卡片，強制將最新單字印上卡片 DOM
    if (!currentCard || currentCard.word === "無可用單字") {
        currentCard = addedList[0];
        const wordElem = document.getElementById('cardWord');
        const meaningElem = document.getElementById('cardMeaning');
        if (wordElem) wordElem.innerText = currentCard.word;
        if (meaningElem) meaningElem.innerText = currentCard.meaning || 'AI 自動解析中...';
    }

    // 3. 🌟 強制刷新測驗題庫 (隨堂測驗模式)
    if (typeof initQuiz === 'function') {
        initQuiz();
    } else if (typeof startQuiz === 'function') {
        startQuiz();
    } else if (typeof nextQuizQuestion === 'function') {
        nextQuizQuestion();
    }

    showToast(`⚡ 已成功新增 ${addedList.length} 個單字！`, 'success');

    // 4. 🌟 背景 AI 補齊 (防範 API 未設定或請求失敗導致崩潰)
    if (typeof runBatchAiAutoFill === 'function') {
        try {
            await runBatchAiAutoFill(addedList, (current, total) => {
                saveStorage();
                if (typeof updateUI === 'function') updateUI();
            });
            
            saveStorage();
            if (typeof updateUI === 'function') updateUI();

            // AI 完成後更新當前顯示的卡片內容
            if (currentCard) {
                const updated = wordList.find(w => w.id === currentCard.id);
                if (updated) {
                    currentCard = updated;
                    if (typeof nextCard === 'function') nextCard();
                }
            }
            showToast(`✨ AI 已完成單字音標與例句補充！`, 'success');
        } catch (err) {
            console.warn("AI 自動補充跳過或失敗:", err);
        }
    }
}

/**
 * 🌐 全全域設定 UI 同步與多語系控制器
 */
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

    showToast('母語設定已更新！', 'info');
    if (typeof saveStorage === 'function') saveStorage();
}

function handleTargetLangChange(lang) {
    localStorage.setItem('lzhcard_target_lang', lang);
    syncSettingsUI();
    showToast('學習目標語言已更新！', 'info');
    if (typeof saveStorage === 'function') saveStorage(); // 🌟 同步保存至雲端
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
    showToast('卡片顯示模式已更新！', 'success');
    if (typeof saveStorage === 'function') saveStorage();
}

function handleThemeChange(mode) {
    localStorage.setItem('theme_preference', mode);
    applyTheme(mode);
    if (typeof saveStorage === 'function') saveStorage(); // 🌟 同步主題設定至雲端
}

// 帳號登入狀態變更時，同時觸發 UI 語系刷新
document.addEventListener('DOMContentLoaded', () => {
    initLanguageSettings();

    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(() => {
            if (typeof applyLanguageUI === 'function') applyLanguageUI();
        });
    }
});