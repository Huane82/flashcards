/**
 * 主程式交互控制器、字庫分類與拆分邏輯 (含自動洗牌提煉詞性與單字淨化)
 */

let currentCard = null;
let parsedBatchList = [];

const API_KEY_STORAGE_NAME = typeof STORAGE_KEY_APIKEY !== 'undefined' ? STORAGE_KEY_APIKEY : 'flashcard_gemini_key_v1';

window.addEventListener('DOMContentLoaded', () => {
    loadStorage();
    updateCategorySelects();
    updateUI();
    nextCard();
});

/**
 * 更新所有字庫下拉選單選項 (頂部篩選器、備份選單、拆分選單)
 */
function updateCategorySelects() {
    const cats = getAllCategories();

    // 1. 頂部學習篩選器
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

    // 2. 備份匯出選單
    const exportSelect = document.getElementById('exportCategorySelect');
    if (exportSelect) {
        exportSelect.innerHTML = `<option value="ALL">包含全部字庫</option>` + 
            cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    // 3. 拆分字庫目標選單
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
    updateUI();
    nextCard();
}

function updateUI() {
    const filteredList = wordList.filter(w => {
        if (typeof selectedCategory === 'undefined' || selectedCategory === "ALL") return true;
        return (w.category || "預設字庫") === selectedCategory;
    });

    const count = filteredList.length;
    document.getElementById('totalWordCount').innerText = wordList.length;
    document.getElementById('cardCountDisplay').innerText = count;

    const emptyNotice = document.getElementById('emptyNotice');
    if (count === 0) {
        emptyNotice.classList.remove('hidden');
    } else {
        emptyNotice.classList.add('hidden');
    }

    renderWordList();
}

/**
 * 刷卡輪播與卡片渲染
 */
function nextCard() {
    const flashcardElem = document.getElementById('flashcard');
    flashcardElem.classList.remove('rotate-y-180');

    currentCard = getNextCardSpacedRepetition();

    if (!currentCard) {
        document.getElementById('cardWord').innerText = "無可用單字";
        document.getElementById('cardPhonetic').innerText = "/---/";
        document.getElementById('cardPosFront').innerText = "EMPTY";
        document.getElementById('cardPosBack').innerText = "EMPTY";
        document.getElementById('cardMeaning').innerText = "請選擇其他字庫或匯入單字";
        document.getElementById('cardSentence').innerText = "當前選取字庫無庫存。";
        document.getElementById('cardTranslation').innerText = "請選取字庫。";
        return;
    }

    const lvInfo = getLevelInfo(currentCard.level || 1);
    const streak = currentCard.knowStreak || 0;

    const streakTextElem = document.getElementById('knowStreakText');
    if (streakTextElem) streakTextElem.innerText = `${streak}/3`;

    document.getElementById('cardWord').innerText = currentCard.word || '';
    document.getElementById('cardPhonetic').innerText = currentCard.phonetic || '/---/';
    document.getElementById('cardPosFront').innerText = currentCard.pos || 'N/A';
    
    const levelFront = document.getElementById('cardLevelFront');
    if (levelFront) {
        levelFront.innerText = `${currentCard.category || '預設'} | ${lvInfo.name}`;
        levelFront.className = `px-2.5 py-1 rounded-full text-xs font-bold border ${lvInfo.color}`;
    }

    document.getElementById('cardPosBack').innerText = currentCard.pos || 'N/A';
    const levelBack = document.getElementById('cardLevelBack');
    if (levelBack) {
        levelBack.innerText = `${currentCard.category || '預設'} | ${lvInfo.name}`;
        levelBack.className = `px-2.5 py-1 rounded-full text-xs font-bold border ${lvInfo.color}`;
    }

    document.getElementById('cardMeaning').innerText = currentCard.meaning || '';
    document.getElementById('cardSentence').innerText = currentCard.sentence ? `"${currentCard.sentence}"` : '"無例句資訊"';
    document.getElementById('cardTranslation').innerText = currentCard.translation || '';
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
    flashcardElem.classList.toggle('rotate-y-180');
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
    const secFlashcard = document.getElementById('sec-flashcard');
    const secQuiz = document.getElementById('sec-quiz');
    const secList = document.getElementById('sec-list');

    const tabFlashcard = document.getElementById('tab-flashcard');
    const tabQuiz = document.getElementById('tab-quiz');
    const tabList = document.getElementById('tab-list');

    secFlashcard.classList.add('hidden');
    secQuiz.classList.add('hidden');
    secList.classList.add('hidden');

    tabFlashcard.className = "py-2.5 px-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center space-x-2 transition";
    tabQuiz.className = "py-2.5 px-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center space-x-2 transition";
    tabList.className = "py-2.5 px-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center space-x-2 transition";

    if (tab === 'flashcard') {
        secFlashcard.classList.remove('hidden');
        tabFlashcard.className = "py-2.5 px-3 text-sm font-semibold border-b-2 border-brand-600 text-brand-600 flex items-center space-x-2 transition";
    } else if (tab === 'quiz') {
        secQuiz.classList.remove('hidden');
        tabQuiz.className = "py-2.5 px-3 text-sm font-semibold border-b-2 border-brand-600 text-brand-600 flex items-center space-x-2 transition";
        if (typeof nextQuizQuestion === 'function') nextQuizQuestion();
    } else if (tab === 'list') {
        secList.classList.remove('hidden');
        tabList.className = "py-2.5 px-3 text-sm font-semibold border-b-2 border-brand-600 text-brand-600 flex items-center space-x-2 transition";
        renderWordList();
    }
}

/**
 * 渲染單字列表
 */
function renderWordList() {
    const tbody = document.getElementById('wordTableBody');
    if (!tbody) return;
    const search = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase().trim() : '';

    const filtered = wordList.filter(item => {
        const matchesSearch = item.word.toLowerCase().includes(search) ||
            (item.meaning && item.meaning.toLowerCase().includes(search)) ||
            (item.category && item.category.toLowerCase().includes(search)) ||
            (item.pos && item.pos.toLowerCase().includes(search));
        
        const matchesCategory = (typeof selectedCategory === 'undefined' || selectedCategory === "ALL") ? true : (item.category || "預設字庫") === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-folder-open text-2xl mb-2 block"></i>
                    查無相關單字資料
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        const lvInfo = getLevelInfo(item.level || 1);
        return `
            <tr class="hover:bg-slate-50 transition">
                <td class="py-3 px-4 font-bold text-slate-900">
                    ${item.word}
                    <div class="text-xs font-mono font-normal text-slate-400">${item.phonetic || ''}</div>
                </td>
                <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">${item.category || '預設字庫'}</span>
                </td>
                <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded text-xs font-semibold ${lvInfo.color} border">${lvInfo.name}</span>
                </td>
                <td class="py-3 px-4 font-medium text-slate-800">
                    ${item.meaning || ''}
                </td>
                <td class="py-3 px-4 text-right space-x-2">
                    <button type="button" onclick="editCard('${item.id}')" class="p-1.5 text-brand-600 hover:bg-brand-50 rounded transition" title="編輯">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button type="button" onclick="deleteCard('${item.id}')" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition" title="刪除">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
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
        saveStorage();
        updateCategorySelects();
        updateUI();
        if (currentCard && currentCard.id === id) nextCard();
    }
}

function handleClearAllWords() {
    if (confirm("警告：此操作將清空全部單字庫，無法復原！確定要清空嗎？")) {
        wordList = [];
        saveStorage();
        updateCategorySelects();
        updateUI();
        nextCard();
    }
}

function handleSaveCardForm(e) {
    e.preventDefault();
    const id = document.getElementById('editCardId').value;
    const category = document.getElementById('formCategory').value.trim() || '預設字庫';
    const rawWord = document.getElementById('formWord').value.trim();
    const rawPos = document.getElementById('formPos').value.trim();
    const phonetic = document.getElementById('formPhonetic').value.trim();
    const rawMeaning = document.getElementById('formMeaning').value.trim();
    const sentence = document.getElementById('formSentence').value.trim();
    const translation = document.getElementById('formTranslation').value.trim();

    // 手動儲存時一併進行淨化
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
        alert("請先輸入英文單字！");
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
    }

    btn.disabled = false;
    btn.innerHTML = origHtml;
}

/**
 * 一鍵載入 GitHub 開源高中 7000 單字庫 (含自動洗牌提煉詞性與單字淨化)
 */
async function handleLoadPreset(levelNum) {
    if (!confirm(`確定要載入【Level ${levelNum}】高中單字嗎？`)) return;

    const CDN_URL = "https://raw.githubusercontent.com/zenkarsha/words7000/main/words.json";

    try {
        const btn = event.currentTarget;
        const origText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "下載中...";

        const response = await fetch(CDN_URL);
        if (!response.ok) throw new Error("下載預設字庫失敗");

        const allWords = await response.json();

        const targetWords = allWords.filter(item => {
            if (item.level) return Number(item.level) === levelNum;
            const idx = allWords.indexOf(item);
            return Math.floor(idx / 1000) + 1 === levelNum;
        });

        if (!targetWords || targetWords.length === 0) {
            alert(`找不到 Level ${levelNum} 的單字資料。`);
            btn.disabled = false;
            btn.innerText = origText;
            return;
        }

        const catName = `高中 7000 單 L${levelNum}`;
        document.getElementById('batchTargetCategory').value = catName;

        // 載入時自動執行 sanitizeWordAndPos 提煉詞性與淨化單字
        parsedBatchList = targetWords.map(item => {
            const rawW = item.word || item.term || '';
            const rawP = item.pos || item.partOfSpeech || '';
            const rawM = item.meaning || item.definition || item.zh || '';

            const cleanObj = (typeof sanitizeWordAndPos === 'function') 
                ? sanitizeWordAndPos(rawW, rawP, rawM)
                : { word: rawW, pos: rawP, meaning: rawM };

            return {
                word: cleanObj.word,
                pos: cleanObj.pos,
                phonetic: item.phonetic || '',
                meaning: cleanObj.meaning,
                sentence: item.sentence || '',
                translation: item.translation || ''
            };
        });

        btn.disabled = false;
        btn.innerText = origText;

        renderBatchPreview();
        alert(`成功抓取【${catName}】共 ${parsedBatchList.length} 筆單字！已自動淨化單字並分離詞性，點選「確認匯入至字庫」即可完成匯入。`);

    } catch (err) {
        console.error(err);
        alert("⚠️ 無法連線至 GitHub 抓取字庫，請確認網路連線。");
    }
}

/**
 * 批量貼上解析與 AI 處理
 */
function handleParseBatchText() {
    const raw = document.getElementById('batchRawInput').value.trim();
    if (!raw) {
        alert("請先貼入單字資料！");
        return;
    }

    parsedBatchList = parseBatchText(raw);
    if (parsedBatchList.length === 0) {
        alert("無法解析輸入內容，請確認格式。");
        return;
    }

    renderBatchPreview();
}

/**
 * 渲染批量預覽表格 (含剔除單字按鈕)
 */
function renderBatchPreview() {
    const previewBox = document.getElementById('batchPreviewBox');
    const previewBody = document.getElementById('batchPreviewBody');
    document.getElementById('batchParsedCount').innerText = parsedBatchList.length;

    if (parsedBatchList.length === 0) {
        previewBox.classList.add('hidden');
        document.getElementById('confirmBatchImportBtn').disabled = true;
        return;
    }

    previewBody.innerHTML = parsedBatchList.map((item, idx) => {
        const isComplete = item.word && item.meaning && item.pos;
        const statusBadge = isComplete ? 
            `<span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">完整</span>` :
            `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">待補齊</span>`;

        return `
            <tr class="hover:bg-slate-50">
                <td class="p-2 border-b font-bold text-slate-800">${item.word}</td>
                <td class="p-2 border-b text-slate-600">${item.pos || '-'}</td>
                <td class="p-2 border-b text-slate-700">${item.meaning || '-'}</td>
                <td class="p-2 border-b">${statusBadge}</td>
                <td class="p-2 border-b text-right">
                    <button type="button" onclick="removeBatchItem(${idx})" class="text-rose-600 hover:text-rose-800 font-bold px-2 py-0.5 rounded hover:bg-rose-50 transition" title="剔除此單字">
                        <i class="fa-solid fa-trash"></i> 移除
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    previewBox.classList.remove('hidden');
    document.getElementById('confirmBatchImportBtn').disabled = false;
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

    btn.disabled = true;
    progressContainer.classList.remove('hidden');

    await runBatchAiAutoFill(parsedBatchList, (current, total) => {
        const pct = Math.round((current / total) * 100);
        progressText.innerText = `AI 正在補齊單字 (${current} / ${total})...`;
        progressBar.style.width = `${pct}%`;
        progressPercent.innerText = `${pct}%`;
        renderBatchPreview();
    });

    progressBar.style.width = `100%`;
    progressPercent.innerText = `100%`;
    progressText.innerText = "補齊完成！";
    btn.disabled = false;
}

/**
 * 重置彈窗狀態、文字區域與預覽列表
 */
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

/**
 * 確認將單字寫入庫存，並自動清空重置彈窗
 */
function handleConfirmBatchImport() {
    if (parsedBatchList.length === 0) return;

    const targetCategory = document.getElementById('batchTargetCategory').value.trim() || '預設字庫';
    let addedCount = 0;

    parsedBatchList.forEach(item => {
        if (item.word) {
            wordList.unshift({
                id: 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                category: targetCategory,
                word: item.word,
                pos: item.pos || '',
                phonetic: item.phonetic || '',
                meaning: item.meaning || '尚未填寫釋義',
                sentence: item.sentence || '',
                translation: item.translation || '',
                level: 1, knowStreak: 0, updatedAt: Date.now()
            });
            addedCount++;
        }
    });

    saveStorage();
    updateCategorySelects();
    updateUI();
    
    resetBatchModal();
    closeModal('batchModal');
    
    alert(`成功匯入 ${addedCount} 筆單字至【${targetCategory}】字庫！`);
    if (!currentCard) nextCard();
}

/**
 * 批量拆分大字庫對話框與邏輯
 */
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
        alert("請選擇要拆分的字庫！");
        return;
    }

    const targetWords = wordList.filter(w => (w.category || "預設字庫") === targetCat);
    if (targetWords.length === 0) {
        alert("該字庫內無任何單字可供拆分！");
        return;
    }

    if (targetWords.length <= chunkSize) {
        alert(`該字庫只有 ${targetWords.length} 個單字，小於或等於拆分上限 ${chunkSize}，不需要拆分！`);
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
    alert(`成功將【${targetCat}】(${targetWords.length} 字) 拆分為 ${partNum - 1} 個小字庫（每庫最多 ${chunkSize} 字）！`);
}

function handleSaveApiKey() {
    const key = document.getElementById('geminiApiKeyInput').value.trim();
    if (!key) {
        alert("請輸入有效的 Gemini API Key！");
        return;
    }
    localStorage.setItem(API_KEY_STORAGE_NAME, key);
    closeModal('keyModal');
    alert("API Key 已成功儲存於本地 LocalStorage！");
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');

    if (id === 'keyModal') {
        const existingKey = localStorage.getItem(API_KEY_STORAGE_NAME) || '';
        const keyInput = document.getElementById('geminiApiKeyInput');
        if (keyInput) keyInput.value = existingKey;
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('hidden');
    if (id === 'cardModal') {
        document.getElementById('cardForm').reset();
        document.getElementById('editCardId').value = '';
        document.getElementById('cardModalTitle').innerText = "新增/編輯單字卡";
    }
    if (id === 'batchModal') {
        resetBatchModal();
    }
}