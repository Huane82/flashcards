/**
 * LZHCard - 批量匯入、AI 自動補齊、拆分與 JSON 備份模組 (batch.js)
 */

window.parsedBatchList = window.parsedBatchList || [];

/**
 * 🔍 從物件中搜尋可能包含中文釋義的欄位
 */
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

/**
 * 📚 載入高中 7000 單預設字庫包 (支援 CDN 多備援)
 */
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
        if (typeof showToast === 'function') showToast(t('toastCdnFailed'), 'error');
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
        if (typeof showToast === 'function') showToast(t('toastLevelNotFound', { level: levelNum }), 'warning');
        if (btn) { btn.disabled = false; btn.innerText = origText; }
        return;
    }

    const catName = `高中 7000 單 L${levelNum}`;
    const targetCategoryInput = document.getElementById('batchTargetCategory');
    if (targetCategoryInput) targetCategoryInput.value = catName;

    window.parsedBatchList = targetWords.map(item => {
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
    if (typeof showToast === 'function') showToast(t('toastPresetSuccess', { name: catName, count: window.parsedBatchList.length }), 'success');
}

/**
 * 🌐 批量貼上文字解析器（支援多單字片語完整識別、日文假名/漢字 + 羅馬拼音發音）
 */
function parseBatchText(text) {
    if (!text || typeof text !== 'string') return [];

    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    const results = [];

    // 嚴謹詞性匹配：英文字母詞性需帶點 (n., v.) 或括號 ([n])，避免將羅馬拼音 n, v 誤判為詞性
    const strictPosRegex = /(?:\[|\()\s*(adj|adv|v|n|prep|conj|pron|vt|vi|num|art|phr|名詞|代名詞|動詞|他動詞|自動詞|形容詞|形容動詞|副詞|助詞|感動詞)\.?\s*(?:\]|\))|\b(adj|adv|v|n|prep|conj|pron|vt|vi|num|art|phr)\.|\b(名詞|代名詞|動詞|他動詞|自動詞|形容詞|形容動詞|副詞|助詞|感動詞|連體詞|接続詞)\b/i;

    // 日文字元判斷（平假名、片假名）
    const jpRegex = /[\u3040-\u309F\u30A0-\u30FF]/;

    lines.forEach(line => {
        let tempLine = line;
        let word = '';
        let pos = '';
        let phonetic = '';
        let meaning = '';

        // 1. 提取斜線內的音標 / 讀音 (例如: /rɪˈzɪl.jənt/)
        const slashPhonetic = tempLine.match(/\/([^\/]+)\//);
        if (slashPhonetic) {
            phonetic = '/' + slashPhonetic[1] + '/';
            tempLine = tempLine.replace(slashPhonetic[0], ' ');
        }

        // 2. 提取詞性 (僅比對帶點或帶括號的顯式詞性標籤)
        const posMatch = tempLine.match(strictPosRegex);
        if (posMatch) {
            pos = (posMatch[1] || posMatch[2] || posMatch[3]).trim();
            if (!pos.endsWith('.') && !/[\u4e00-\u9fa5\u3040-\u30ff]/.test(pos)) {
                pos += '.';
            }
            tempLine = tempLine.replace(posMatch[0], ' ');
        }

        // 3. 智慧拆分「單字/片語」與「母語釋義」
        const delimRegex = /\t|:|＝|=| - | -- | — | – /;

        if (delimRegex.test(tempLine)) {
            // 情況 A：有明確分隔符號 (Tab, 冒號, 等號, 破折號)
            const parts = tempLine.split(delimRegex).map(s => s.trim()).filter(Boolean);
            word = parts[0] || '';
            meaning = parts.slice(1).join(' ');
        } else {
            // 情況 B：無明確分隔符號時的智慧分析
            const spaceParts = tempLine.split(/\s+/).map(s => s.trim()).filter(Boolean);

            // 判斷是否為日文假名 + 羅馬拼音 (例如: "ン n" 或 "たべる taberu")
            if (spaceParts.length >= 2 && jpRegex.test(spaceParts[0]) && /^[a-zA-Z\s\-\.\'\`]+$/.test(spaceParts[1]) && !phonetic) {
                word = spaceParts[0];
                phonetic = spaceParts[1];
                meaning = spaceParts.slice(2).join(' ');
            } else {
                // 檢查是否含有中文母語釋義邊界 (例如: "keep up with 跟上進度")
                const zhMatch = tempLine.match(/[\u4e00-\u9fa5]/);
                if (zhMatch) {
                    const idx = tempLine.indexOf(zhMatch[0]);
                    word = tempLine.substring(0, idx).trim();
                    meaning = tempLine.substring(idx).trim();
                } else {
                    // 情況 C：全外文片語 (例如輸入 "keep up with" 或 "look forward to")
                    word = tempLine.trim();
                    meaning = '';
                }
            }
        }

        word = word.trim();
        meaning = meaning.trim();
        phonetic = phonetic.trim();

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

/**
 * 📋 觸發文字解析處理
 */
function handleParseBatchText() {
    const raw = document.getElementById('batchRawInput')?.value.trim();
    if (!raw) {
        if (typeof showToast === 'function') showToast(t('toastPasteFirst'), 'warning');
        return;
    }

    window.parsedBatchList = parseBatchText(raw);
    if (window.parsedBatchList.length === 0) {
        if (typeof showToast === 'function') showToast(t('toastParseError'), 'error');
        return;
    }

    renderBatchPreview();
    if (typeof showToast === 'function') showToast(t('toastParseSuccess', { count: window.parsedBatchList.length }), 'success');
}

/**
 * 👁️ 渲染批量匯入預覽表格
 */
function renderBatchPreview() {
    const previewBox = document.getElementById('batchPreviewBox');
    const previewBody = document.getElementById('batchPreviewBody');
    const parsedCountElem = document.getElementById('batchParsedCount');
    if (parsedCountElem) parsedCountElem.innerText = window.parsedBatchList.length;

    if (window.parsedBatchList.length === 0) {
        if (previewBox) previewBox.classList.add('hidden');
        const confirmBtn = document.getElementById('confirmBatchImportBtn');
        if (confirmBtn) confirmBtn.disabled = true;
        return;
    }

    const textComplete = typeof t === 'function' ? t('statusComplete') : '完整';
    const textPending = typeof t === 'function' ? t('statusPending') : '待補充';
    const textRemove = typeof t === 'function' ? t('btnRemove') : '移除';
    const textTitleRemove = typeof t === 'function' ? t('titleRemove') : '移除此項';

    if (previewBody) {
        previewBody.innerHTML = window.parsedBatchList.map((item, idx) => {
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

/**
 * 🗑️ 移除預覽列表中指定索引的項目
 */
function removeBatchItem(index) {
    window.parsedBatchList.splice(index, 1);
    renderBatchPreview();
}

/**
 * 🤖 執行預覽列表中項目的批次 AI 補齊
 */
async function handleRunBatchAiAutoFill() {
    const btn = document.getElementById('batchAiFillBtn');
    const progressContainer = document.getElementById('batchProgressContainer');
    const progressBar = document.getElementById('batchProgressBar');
    const progressText = document.getElementById('batchProgressText');
    const progressPercent = document.getElementById('batchProgressPercent');

    if (btn) btn.disabled = true;
    if (progressContainer) progressContainer.classList.remove('hidden');

    if (typeof runBatchAiAutoFill === 'function') {
        await runBatchAiAutoFill(window.parsedBatchList, (current, total) => {
            const pct = Math.round((current / total) * 100);
            if (progressText) progressText.innerText = t('progressBatchAi', { current, total });
            if (progressBar) progressBar.style.width = `${pct}%`;
            if (progressPercent) progressPercent.innerText = `${pct}%`;
            renderBatchPreview();
        });
    }

    renderBatchPreview();

    if (progressBar) progressBar.style.width = `100%`;
    if (progressPercent) progressPercent.innerText = `100%`;
    if (progressText) progressText.innerText = typeof t === 'function' ? t('progressAiComplete') : 'AI 自動補齊完成！';
    if (btn) btn.disabled = false;
    if (typeof showToast === 'function') showToast(t('toastAiBatchSuccess'), 'success');
}

/**
 * 🔄 重置批量匯入 Modal UI 狀態
 */
function resetBatchModal() {
    window.parsedBatchList = [];
    
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
 * ✅ 確認將預覽列表中單字匯入至單字庫
 */
function handleConfirmBatchImport() {
    if (!window.parsedBatchList || window.parsedBatchList.length === 0) return;

    const defaultCatName = typeof t === 'function' ? t('defaultCategoryName') : '預設字庫';
    const targetCatElem = document.getElementById('batchTargetCategory');
    const targetCategory = targetCatElem ? (targetCatElem.value.trim() || defaultCatName) : defaultCatName;
    let addedCount = 0;
    let replacedCount = 0;

    window.parsedBatchList.forEach(item => {
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

    if (typeof updateCategorySelects === 'function') updateCategorySelects();
    if (typeof updateUI === 'function') updateUI();
    if (!currentCard && typeof nextCard === 'function') nextCard();

    if (typeof closeModal === 'function') closeModal('batchModal');

    const netUniqueAdded = addedCount - replacedCount;
    const msg = replacedCount > 0 
        ? t('toastImportSuccessDeDup', { count: addedCount, dedup: replacedCount, actual: netUniqueAdded })
        : t('toastImportSuccess', { count: addedCount });

    if (typeof showToast === 'function') showToast(msg, 'success');
    if (typeof saveStorage === 'function') saveStorage();
}

/**
 * ⚡ 快速收錄單字（支援逗號/換行分隔輸入）
 */
async function handleQuickAddWords() {
    const inputElem = document.getElementById('quickAddInput');
    const rawText = inputElem ? inputElem.value.trim() : '';

    if (!rawText) {
        if (typeof showToast === 'function') showToast(t('toastEnterQuickWords'), 'warning');
        return;
    }

    const wordsToProcess = rawText
        .split(/[,;\n\r\t，；]+/)
        .map(w => w.trim())
        .filter(w => w.length > 0);

    if (wordsToProcess.length === 0) {
        if (typeof showToast === 'function') showToast(t('toastNoValidQuickWords'), 'warning');
        return;
    }

    const btn = document.getElementById('quickAddConfirmBtn');
    const origText = btn ? btn.innerText : '';
    if (btn) {
        btn.disabled = true;
        btn.innerText = t('btnProcessing');
    }

    const defaultCategoryName = typeof t === 'function' ? t('defaultCategoryName') : '預設字庫';
    const defaultMeaningText = typeof t === 'function' ? t('progressAiParsing') : 'AI 自動解析中...';

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

    if (typeof closeModal === 'function') closeModal('quickAddModal');
    if (inputElem) inputElem.value = '';
    if (btn) {
        btn.disabled = false;
        btn.innerText = origText;
    }

    if (addedList.length === 0) {
        if (typeof showToast === 'function') showToast(t('toastQuickWordsExist'), 'info');
        return;
    }

    if (typeof saveStorage === 'function') saveStorage();
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

    if (typeof showToast === 'function') showToast(t('toastQuickAddSuccess', { count: addedList.length }), 'success');

    if (typeof runBatchAiAutoFill === 'function') {
        try {
            await runBatchAiAutoFill(addedList, (current, total) => {
                if (typeof saveStorage === 'function') saveStorage();
                if (typeof updateUI === 'function') updateUI();
            });
            
            if (typeof saveStorage === 'function') saveStorage();
            if (typeof updateUI === 'function') updateUI();

            if (currentCard) {
                const updated = wordList.find(w => w.id === currentCard.id);
                if (updated) {
                    currentCard = updated;
                    if (typeof nextCard === 'function') nextCard();
                }
            }
            if (typeof showToast === 'function') showToast(t('toastAiCompletionDone'), 'success');
        } catch (err) {
            console.warn("AI 自動補充跳過或失敗:", err);
        }
    }
}

/**
 * ✂️ 打開字庫拆分 Modal
 */
function openSplitDeckModal() {
    if (typeof updateCategorySelects === 'function') updateCategorySelects();
    if (typeof openModal === 'function') openModal('splitModal');
}

/**
 * ✂️ 確認執行字庫自動拆分
 */
function handleConfirmSplitDeck() {
    const select = document.getElementById('splitTargetCategorySelect');
    const chunkSizeInput = document.getElementById('splitChunkSizeInput');

    const targetCat = select ? select.value : '';
    const chunkSize = parseInt(chunkSizeInput.value, 10) || 200;

    if (!targetCat) {
        if (typeof showToast === 'function') showToast(t('toastSelectSplitDeck'), 'warning');
        return;
    }

    const defaultCatName = typeof t === 'function' ? t('defaultCategoryName') : '預設字庫';
    const targetWords = wordList.filter(w => (w.category || defaultCatName) === targetCat);
    if (targetWords.length === 0 || targetWords.length <= chunkSize) {
        if (typeof showToast === 'function') showToast(t('toastSplitThreshold', { size: chunkSize }), 'info');
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

    if (typeof saveStorage === 'function') saveStorage();
    if (typeof updateCategorySelects === 'function') updateCategorySelects();
    if (typeof updateUI === 'function') updateUI();
    if (typeof closeModal === 'function') closeModal('splitModal');
    if (typeof showToast === 'function') showToast(t('toastSplitSuccess', { count: partNum - 1 }), 'success');
}

/**
 * 📁 批次切換選取單字之字庫分類
 */
function handleBatchChangeCategory() {
    if (selectedWordIds.size === 0) {
        if (typeof showToast === 'function') showToast(t('toastSelectMoveWords'), 'warning');
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

    if (typeof saveStorage === 'function') saveStorage();
    if (typeof updateCategorySelects === 'function') updateCategorySelects();
    if (typeof updateUI === 'function') updateUI();
    if (typeof showToast === 'function') showToast(t('toastMoveSuccess', { count, name: catName }), 'success');
}

/**
 * 🗑️ 批次刪除選取單字
 */
function handleBatchDeleteWords() {
    if (selectedWordIds.size === 0) {
        if (typeof showToast === 'function') showToast(t('toastSelectDeleteWords'), 'warning');
        return;
    }

    if (confirm(t('confirmDeleteBatch', { count: selectedWordIds.size }))) {
        wordList = wordList.filter(item => !selectedWordIds.has(item.id));
        selectedWordIds.clear();
        if (typeof saveStorage === 'function') saveStorage();
        if (typeof updateCategorySelects === 'function') updateCategorySelects();
        if (typeof updateUI === 'function') updateUI();
        if (typeof nextCard === 'function') nextCard();
        if (typeof showToast === 'function') showToast(t('toastDeleteBatchSuccess'), 'info');
    }
}

/**
 * 🤖 批次執行單字庫 AI 自動補充
 */
async function handleBatchAiFillLibraryWords() {
    const defaultCatName = typeof t === 'function' ? t('defaultCategoryName') : '預設字庫';

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
        if (typeof showToast === 'function') showToast(t('toastNoWordsToFill'), 'warning');
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
        if (typeof showToast === 'function') showToast(t('toastAllWordsComplete'), 'info');
        return;
    }

    const MAX_LIMIT = typeof MAX_AI_BATCH_LIMIT !== 'undefined' ? MAX_AI_BATCH_LIMIT : 50;

    if (incompleteWords.length > MAX_LIMIT) {
        if (typeof showToast === 'function') showToast(t('toastBatchLimitExceeded', { count: incompleteWords.length }), 'error');
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

    if (typeof runBatchAiAutoFill === 'function') {
        await runBatchAiAutoFill(targetWords, (current, total) => {
            const pct = Math.round((current / total) * 100);
            if (progressText) progressText.innerText = t('progressBatchAi', { current, total });
            if (progressBar) progressBar.style.width = `${pct}%`;
            if (progressPercent) progressPercent.innerText = `${pct}%`;
            if (typeof renderWordList === 'function') renderWordList();
        });
    }

    if (typeof saveStorage === 'function') saveStorage();
    if (typeof updateUI === 'function') updateUI();

    if (progressText) progressText.innerText = t('progressAiComplete');
    if (progressBar) progressBar.style.width = "100%";
    if (progressPercent) progressPercent.innerText = "100%";

    setTimeout(() => {
        if (progressContainer) progressContainer.classList.add('hidden');
    }, 2500);

    if (typeof showToast === 'function') showToast(t('toastBatchFillSuccess', { count: incompleteWords.length }), 'success');
}

/**
 * 📥 匯出 JSON 備份檔 (相容 iOS Safari 與桌機瀏覽器)
 */
function exportJSON() {
    if (!wordList || wordList.length === 0) {
        if (typeof showToast === 'function') showToast(t('toastNoDataToExport') || '尚無資料可匯出', 'warning');
        return;
    }

    const dataStr = JSON.stringify(wordList, null, 2);
    const fileName = `LZHCard_Backup_${new Date().toISOString().slice(0, 10)}.json`;

    // 判斷是否為 iOS Safari / iOS WebView
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isIOS) {
        const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    if (typeof showToast === 'function') showToast(t('toastExportSuccess') || '單字庫匯出成功！', 'success');
}

/**
 * 📤 匯入 JSON 備份檔
 */
function handleImportJSON() {
    const fileInput = document.getElementById('jsonFileInput');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        if (typeof showToast === 'function') showToast(t('toastSelectJsonFirst'), "warning");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData)) {
                if (typeof showToast === 'function') showToast(t('toastJsonFormatError'), "error");
                return;
            }

            const defaultCatName = typeof t === 'function' ? t('defaultCategoryName') : '預設字庫';
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

            if (typeof saveStorage === 'function') await saveStorage();
            if (typeof updateCategorySelects === 'function') updateCategorySelects();
            if (typeof updateUI === 'function') updateUI();
            if (!currentCard && typeof nextCard === 'function') nextCard();

            if (typeof closeModal === 'function') closeModal('backupModal');
            fileInput.value = '';

            const netUniqueAdded = addedCount - replacedCount;
            const msg = replacedCount > 0 
                ? t('toastImportSuccessDeDup', { count: addedCount, dedup: replacedCount, actual: netUniqueAdded })
                : t('toastImportSuccess', { count: addedCount });

            if (typeof showToast === 'function') showToast(msg, "success");

        } catch (err) {
            console.error("JSON 解析失敗:", err);
            if (typeof showToast === 'function') showToast(t('toastJsonParseError'), "error");
        }
    };

    reader.readAsText(file);
}