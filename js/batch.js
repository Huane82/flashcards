/**
 * LZHCard - 批量匯入、UI 控制、字庫管理與 JSON 備份模組 (Batch UI Controller)
 */

window.parsedBatchList = window.parsedBatchList || [];
let isAutoDeduplicating = false;

function safeT(key, params, fallbackStr) {
    if (typeof t === 'function') {
        try {
            return t(key, params);
        } catch (e) {}
    }
    if (!fallbackStr) fallbackStr = key;
    if (params && typeof params === 'object') {
        Object.keys(params).forEach(k => {
            fallbackStr = fallbackStr.replace(new RegExp(`{\\s*${k}\\s*}`, 'g'), params[k]);
        });
    }
    return fallbackStr;
}

/**
 * 🧹 單字字串標準化（去除前後空白、壓縮連續空白並轉小寫，用於精準重複比對）
 */
function normalizeWordKey(rawWord) {
    if (!rawWord || typeof rawWord !== 'string') return '';
    return rawWord.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * 🧹 判斷欄位是否為有效內容（排除空白與預設佔位文字）
 */
function isValidFieldValue(val) {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (!trimmed) return false;
    const placeholders = [
        '無釋義',
        '未設定釋義',
        'AI 自動解析中...',
        'AI 解析中...',
        'N/A',
        '/---/',
        'EMPTY',
        '-'
    ];
    return !placeholders.includes(trimmed);
}

/**
 * 🔀 合併兩筆重複單字資料（保留較高的學習進度與較完整的欄位內容）
 */
function mergeDuplicateWordRecord(baseItem, otherItem, preferOtherFields = false) {
    const baseScore = (Number(baseItem.level) || 1) * 10 + (Number(baseItem.knowStreak) || 0);
    const otherScore = (Number(otherItem.level) || 1) * 10 + (Number(otherItem.knowStreak) || 0);
    const progressSource = otherScore > baseScore ? otherItem : baseItem;

    const pickField = (field) => {
        const valA = baseItem[field];
        const valB = otherItem[field];
        const validA = isValidFieldValue(valA);
        const validB = isValidFieldValue(valB);

        if (preferOtherFields) {
            if (validB) return String(valB).trim();
            if (validA) return String(valA).trim();
        } else {
            if (validA) return String(valA).trim();
            if (validB) return String(valB).trim();
        }
        return String(valA || valB || '').trim();
    };

    return {
        ...baseItem,
        word: String(baseItem.word || otherItem.word || '').trim().replace(/\s+/g, ' '),
        pos: pickField('pos'),
        phonetic: pickField('phonetic'),
        meaning: pickField('meaning'),
        sentence: pickField('sentence'),
        translation: pickField('translation'),
        level: Number(progressSource.level) || 1,
        knowStreak: Number(progressSource.knowStreak) || 0,
        updatedAt: Math.max(Number(baseItem.updatedAt) || 0, Number(otherItem.updatedAt) || 0, Date.now())
    };
}

/**
 * 🤖 自動掃描並刪除字庫中的重複單字（保留學習進度與最完整釋義）
 */
function autoDeduplicateWordList(options = {}) {
    const { silent = false } = options;
    if (isAutoDeduplicating || typeof wordList === 'undefined' || !Array.isArray(wordList) || wordList.length <= 1) {
        return 0;
    }

    isAutoDeduplicating = true;
    let removedCount = 0;

    try {
        const defaultCatName = safeT('defaultCategoryName', null, '預設字庫');
        const seenMap = new Map(); // key: `${category}::${normalizedWord}` -> index in dedupedList
        const dedupedList = [];

        for (const item of wordList) {
            if (!item || !item.word) continue;

            const cleanWord = String(item.word).trim().replace(/\s+/g, ' ');
            if (!cleanWord) continue;

            const catName = String(item.category || defaultCatName).trim() || defaultCatName;
            const compositeKey = `${catName.toLowerCase()}::${cleanWord.toLowerCase()}`;

            if (seenMap.has(compositeKey)) {
                const existingIdx = seenMap.get(compositeKey);
                dedupedList[existingIdx] = mergeDuplicateWordRecord(dedupedList[existingIdx], {
                    ...item,
                    category: catName,
                    word: cleanWord
                }, false);
                removedCount++;
            } else {
                seenMap.set(compositeKey, dedupedList.length);
                dedupedList.push({
                    ...item,
                    category: catName,
                    word: cleanWord
                });
            }
        }

        if (removedCount > 0) {
            wordList.length = 0;
            wordList.push(...dedupedList);

            if (typeof selectedWordIds !== 'undefined' && selectedWordIds instanceof Set) {
                const validIds = new Set(wordList.map(w => w.id));
                for (const id of Array.from(selectedWordIds)) {
                    if (!validIds.has(id)) selectedWordIds.delete(id);
                }
            }

            if (typeof saveStorage === 'function') saveStorage();
            if (typeof updateCategorySelects === 'function') updateCategorySelects();
            if (typeof updateUI === 'function') updateUI();

            if (!silent && typeof showToast === 'function') {
                showToast(
                    safeT('toastAutoDeduplicated', { count: removedCount }, `🧹 已自動清理並合併 ${removedCount} 筆重複單字`),
                    'info'
                );
            }
        }
    } finally {
        isAutoDeduplicating = false;
    }

    return removedCount;
}

/**
 * 🌐 依據目前設定的目標語言與選擇字庫動態切換範例提示與預設字庫選單
 */
function updateBatchPlaceholders() {
    const targetLang = localStorage.getItem('lzhcard_target_lang') || 'en';
    const batchRawInput = document.getElementById('batchRawInput');
    const quickAddInput = document.getElementById('quickAddInput');

    let batchPlaceholder = "";
    let quickAddPlaceholder = "";

    if (targetLang === 'ja') {
        batchPlaceholder = `【日語輸入範例】（支援格式：單字 + 假名讀音 + 詞性 + 母語釋義）\n` +
                           `1. 食べる たべる (動詞) 吃\n` +
                           `2. 猫 ねこ (名詞) 貓咪\n` +
                           `3. 綺麗 きれい (adj.) 美麗的\n` +
                           `4. 勉強する : 學習\n` +
                           `5. 乾杯 /かんぱい/ 乾杯！`;

        quickAddPlaceholder = `例如: 食べる, 猫, 勉強する, 綺麗`;
    } else if (targetLang === 'zh-TW' || targetLang === 'zh') {
        batchPlaceholder = `【中文/國語輸入範例】（支援格式：詞彙 + 注音/拼音 + 詞性 + 外語釋義）\n` +
                           `1. 韌性 ㄖㄣˋ ㄒㄧㄥˋ (n.) resilience\n` +
                           `2. 努力 ㄋㄨˇ ㄌㄧˋ (v.) make effort\n` +
                           `3. 學習 : study\n` +
                           `4. 蘋果 (名詞) apple`;

        quickAddPlaceholder = `例如: 韌性, 努力, 學習, 蘋果`;
    } else {
        batchPlaceholder = `【英文輸入範例】（支援格式：單字 + 音標 + 詞性 + 中文釋義）\n` +
                           `1. resilient /rɪˈzɪl.jənt/ (adj.) 有彈性的\n` +
                           `2. apple n. 蘋果\n` +
                           `3. take off (phr.) 起飛；脫下\n` +
                           `4. candidate : 候選人`;

        quickAddPlaceholder = `例如: resilient, fragile, candidate`;
    }

    if (batchRawInput) batchRawInput.placeholder = batchPlaceholder;
    if (quickAddInput) quickAddInput.placeholder = quickAddPlaceholder;

    // 🌟 同步初始化「快速填入」與「批量匯入」的字庫下拉選單
    const defaultCatName = safeT('defaultCategoryName', null, '預設字庫');
    const activeCats = window.selectedCategories || ['ALL'];
    const currentCat = (activeCats.length === 1 && activeCats[0] !== 'ALL')
        ? activeCats[0]
        : defaultCatName;

    const existingCats = typeof getAllCategories === 'function' ? getAllCategories() : [defaultCatName];
    const savedLastCat = localStorage.getItem('lzhcard_last_quick_add_cat');
    const initialQuickCat = (savedLastCat && existingCats.includes(savedLastCat)) ? savedLastCat : currentCat;

    if (typeof setCategorySelectorValue === 'function') {
        setCategorySelectorValue('quickAdd', initialQuickCat);
        setCategorySelectorValue('batch', currentCat);
    }
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
    const confirmMsg = safeT('confirmLoadPreset', { level: levelNum }, `確定要載入高中 7000 單 L${levelNum} 嗎？`);
    if (!confirm(confirmMsg)) return;

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
        btn.innerText = safeT('btnDownloading', null, '下載中...');
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
        if (typeof showToast === 'function') showToast(safeT('toastCdnFailed', null, '無法連接至字庫伺服器'), 'error');
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
        if (typeof showToast === 'function') showToast(safeT('toastLevelNotFound', { level: levelNum }, `未找到 Level ${levelNum} 的單字`), 'warning');
        if (btn) { btn.disabled = false; btn.innerText = origText; }
        return;
    }

    const catName = `高中 7000 單 L${levelNum}`;
    if (typeof setCategorySelectorValue === 'function') {
        setCategorySelectorValue('batch', catName);
    } else {
        const targetCategoryInput = document.getElementById('batchTargetCategory');
        if (targetCategoryInput) targetCategoryInput.value = catName;
    }

    const seenSet = new Set();
    window.parsedBatchList = [];

    targetWords.forEach(item => {
        const rawW = item.word || item.term || item.english || item.w || '';
        const rawP = item.pos || item.partOfSpeech || item.type || item.p || '';
        
        let rawM = findChineseMeaningFromObject(item);
        if (!rawM) {
            rawM = item.meaning || item.definition || item.zh || item.ch || item.chinese || item.trans || item.m || '';
        }

        const cleanObj = (typeof sanitizeWordAndPos === 'function') 
            ? sanitizeWordAndPos(rawW, rawP, rawM)
            : { word: rawW, pos: rawP, meaning: rawM };

        const normKey = normalizeWordKey(cleanObj.word);
        if (!normKey || seenSet.has(normKey)) return;
        seenSet.add(normKey);

        window.parsedBatchList.push({
            word: cleanObj.word.trim().replace(/\s+/g, ' '),
            pos: cleanObj.pos,
            phonetic: item.phonetic || item.pronunciation || '',
            meaning: cleanObj.meaning,
            sentence: item.sentence || item.example || '',
            translation: item.translation || item.exampleZh || ''
        });
    });

    if (btn) {
        btn.disabled = false;
        btn.innerText = origText;
    }

    renderBatchPreview();
    if (typeof showToast === 'function') showToast(safeT('toastPresetSuccess', { name: catName, count: window.parsedBatchList.length }, `成功載入「${catName}」共 ${window.parsedBatchList.length} 個單字`), 'success');
}

/**
 * 🌐 批量貼上文字解析器 (支援 日語假名/中文注音 與 多種分隔符，並自動過濾貼上內容中的重複字)
 */
function parseBatchText(text) {
    if (!text || typeof text !== 'string') return [];

    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    const results = [];
    const seenWords = new Set();

    const posUnit = '(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|phr|名詞|代名詞|動詞|他動詞|自動詞|形容詞|形容動詞|副詞|助詞|感動詞|連體詞|接続詞)';
    const strictPosRegex = new RegExp(
        `(?:[\\(\\[\\{]\\s*${posUnit}(?:[\\s\\.\\,\\/\\\\&\\|]+${posUnit})*[\\.\\s]*[\\)\\]\\}])` +
        `|(?:\\b${posUnit}\\.(?:[\\s\\,\\/\\\\&\\|]*${posUnit}\\.)*)` +
        `|(?:\\b(?:名詞|代名詞|動詞|他動詞|自動詞|形容詞|形容動詞|副詞|助詞|感動詞|連體詞|接続詞)(?:[\\s\\,\\/\\\\&\\|]+(?:名詞|代名詞|動詞|他動詞|自動詞|形容詞|形容動詞|副詞|助詞|感動詞|連體詞|接続詞))*\\b)`,
        'i'
    );

    const jpRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    // 支援平假名、片假名、英數與注音符號
    const phoneticReadingRegex = /^[\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u02EA\u02EB\u02C5\u02C7\u02C9\u02CA\u02CBa-zA-Z\s\-\.\'\`]+$/;

    lines.forEach(line => {
        let tempLine = line;
        let word = '';
        let pos = '';
        let phonetic = '';
        let meaning = '';

        // 1. 提取斜線音標 /.../
        const slashPhonetic = tempLine.match(/\/([^\/]+)\//);
        if (slashPhonetic) {
            phonetic = '/' + slashPhonetic[1] + '/';
            tempLine = tempLine.replace(slashPhonetic[0], ' ');
        }

        // 2. 提取詞性 (n., v., 名詞, 動詞)
        const posMatch = tempLine.match(strictPosRegex);
        if (posMatch) {
            pos = posMatch[0].replace(/[\(\[\{\)\]\}]/g, '').trim();
            tempLine = tempLine.replace(posMatch[0], ' ');
        }

        const delimRegex = /\t|:|＝|=| - | -- | — | – /;

        if (delimRegex.test(tempLine)) {
            const parts = tempLine.split(delimRegex).map(s => s.trim()).filter(Boolean);
            word = parts[0] || '';
            meaning = parts.slice(1).join(' ');
        } else {
            const spaceParts = tempLine.split(/\s+/).map(s => s.trim()).filter(Boolean);

            // 判斷日語假名或中文讀音（例如：食べる たべる 吃 或 貓 ねこ 貓咪）
            if (spaceParts.length >= 2 && jpRegex.test(spaceParts[0]) && phoneticReadingRegex.test(spaceParts[1]) && !phonetic) {
                word = spaceParts[0];
                phonetic = spaceParts[1];
                meaning = spaceParts.slice(2).join(' ');
            } else {
                const zhMatch = tempLine.match(/[\u4e00-\u9fa5]/);
                if (zhMatch && !jpRegex.test(tempLine.substring(0, tempLine.indexOf(zhMatch[0])))) {
                    const idx = tempLine.indexOf(zhMatch[0]);
                    word = tempLine.substring(0, idx).trim();
                    meaning = tempLine.substring(idx).trim();
                } else {
                    word = tempLine.trim();
                    meaning = '';
                }
            }
        }

        word = word.trim().replace(/\s+/g, ' ');
        meaning = meaning.trim();
        phonetic = phonetic.trim();

        const normKey = normalizeWordKey(word);
        if (normKey && !seenWords.has(normKey)) {
            seenWords.add(normKey);
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
    const raw = document.getElementById('batchRawInput')?.value.trim();
    if (!raw) {
        if (typeof showToast === 'function') showToast(safeT('toastPasteFirst', null, '請先貼上單字內容'), 'warning');
        return;
    }

    window.parsedBatchList = parseBatchText(raw);
    if (window.parsedBatchList.length === 0) {
        if (typeof showToast === 'function') showToast(safeT('toastParseError', null, '解析文字失敗，請確認格式'), 'error');
        return;
    }

    renderBatchPreview();
    if (typeof showToast === 'function') showToast(safeT('toastParseSuccess', { count: window.parsedBatchList.length }, `成功解析 ${window.parsedBatchList.length} 個單字`), 'success');
}

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

    const textComplete = safeT('statusComplete', null, '完整');
    const textPending = safeT('statusPending', null, '待補充');
    const textRemove = safeT('btnRemove', null, '移除');
    const textTitleRemove = safeT('titleRemove', null, '移除此項');

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

function removeBatchItem(index) {
    window.parsedBatchList.splice(index, 1);
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

    if (typeof runBatchAiAutoFill === 'function') {
        await runBatchAiAutoFill(window.parsedBatchList, (current, total) => {
            const pct = Math.round((current / total) * 100);
            if (progressText) progressText.innerText = safeT('progressBatchAi', { current, total }, `AI 補齊中... (${current}/${total})`);
            if (progressBar) progressBar.style.width = `${pct}%`;
            if (progressPercent) progressPercent.innerText = `${pct}%`;
            renderBatchPreview();
        });
    }

    renderBatchPreview();

    if (progressBar) progressBar.style.width = `100%`;
    if (progressPercent) progressPercent.innerText = `100%`;
    if (progressText) progressText.innerText = safeT('progressAiComplete', null, 'AI 自動補齊完成！');
    if (btn) btn.disabled = false;
    if (typeof showToast === 'function') showToast(safeT('toastAiBatchSuccess', null, 'AI 批次補充成功！'), 'success');
}

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

function handleConfirmBatchImport() {
    if (!window.parsedBatchList || window.parsedBatchList.length === 0) return;

    const defaultCatName = safeT('defaultCategoryName', null, '預設字庫');
    const catRes = (typeof getCategorySelectorValue === 'function')
        ? getCategorySelectorValue('batch')
        : { isNew: false, value: document.getElementById('batchTargetCategory')?.value.trim() || '' };

    if (catRes.isNew && !catRes.value) {
        let enterNewMsg = '請輸入新字庫名稱！';
        if (typeof t === 'function') {
            const translated = t('toastEnterNewDeckName');
            if (translated && translated !== 'toastEnterNewDeckName') enterNewMsg = translated;
        }
        if (typeof showToast === 'function') showToast(enterNewMsg, 'warning');
        document.getElementById('batchTargetCategory')?.focus();
        return;
    }
    const targetCategory = catRes.value || defaultCatName;

    let addedCount = 0;
    let replacedCount = 0;

    window.parsedBatchList.forEach(item => {
        if (item && item.word) {
            const itemWord = String(item.word).trim().replace(/\s+/g, ' ');
            const normWord = normalizeWordKey(itemWord);
            if (!normWord) return;

            const newCardData = {
                id: 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                category: targetCategory,
                word: itemWord,
                pos: String(item.pos || '').trim(),
                phonetic: String(item.phonetic || '').trim(),
                meaning: String(item.meaning || safeT('noMeaning', null, '無釋義')).trim(),
                sentence: String(item.sentence || '').trim(),
                translation: String(item.translation || '').trim(),
                level: 1, 
                knowStreak: 0, 
                updatedAt: Date.now()
            };

            const existingIndex = wordList.findIndex(w => 
                (w.category || defaultCatName).trim().toLowerCase() === targetCategory.toLowerCase() &&
                normalizeWordKey(w.word) === normWord
            );

            if (existingIndex !== -1) {
                const existingItem = wordList[existingIndex];
                wordList.splice(existingIndex, 1);
                // 🌟 合併並保留原有學習進度 (level / knowStreak)
                wordList.unshift(mergeDuplicateWordRecord(existingItem, newCardData, true));
                replacedCount++;
            } else {
                wordList.unshift(newCardData);
            }
            addedCount++;
        }
    });

    autoDeduplicateWordList({ silent: true });

    if (typeof updateCategorySelects === 'function') updateCategorySelects();
    if (typeof updateUI === 'function') updateUI();
    if (!currentCard && typeof nextCard === 'function') nextCard();

    if (typeof closeModal === 'function') closeModal('batchModal');

    const netUniqueAdded = addedCount - replacedCount;
    const msg = replacedCount > 0 
        ? safeT('toastImportSuccessDeDup', { count: addedCount, dedup: replacedCount, actual: netUniqueAdded }, `成功匯入 ${addedCount} 個單字（自動合併 ${replacedCount} 筆重複單字）`)
        : safeT('toastImportSuccess', { count: addedCount }, `成功匯入 ${addedCount} 個單字`);

    if (typeof showToast === 'function') showToast(msg, 'success');
    if (typeof saveStorage === 'function') saveStorage();
}

async function handleQuickAddWords() {
    const inputElem = document.getElementById('quickAddInput');
    const catInputElem = document.getElementById('quickAddCategoryInput');
    const rawText = inputElem ? inputElem.value.trim() : '';

    if (!rawText) {
        if (typeof showToast === 'function') showToast(safeT('toastEnterQuickWords', null, '請輸入要快速新增的單字'), 'warning');
        return;
    }

    const wordsToProcess = rawText
        .split(/[,;\n\r\t，；]+/)
        .map(w => w.trim())
        .filter(w => w.length > 0);

    if (wordsToProcess.length === 0) {
        if (typeof showToast === 'function') showToast(safeT('toastNoValidQuickWords', null, '未檢測到有效的單字'), 'warning');
        return;
    }

    const defaultCategoryName = safeT('defaultCategoryName', null, '預設字庫');
    const defaultMeaningText = safeT('progressAiParsing', null, 'AI 自動解析中...');

    // 🌟 讀取下拉選單或新輸入的目標字庫名稱
    const catRes = (typeof getCategorySelectorValue === 'function')
        ? getCategorySelectorValue('quickAdd')
        : { isNew: false, value: catInputElem ? catInputElem.value.trim() : '' };

    if (catRes.isNew && !catRes.value) {
        let enterNewMsg = '請輸入新字庫名稱！';
        if (typeof t === 'function') {
            const translated = t('toastEnterNewDeckName');
            if (translated && translated !== 'toastEnterNewDeckName') enterNewMsg = translated;
        }
        if (typeof showToast === 'function') showToast(enterNewMsg, 'warning');
        document.getElementById('quickAddCategoryInput')?.focus();
        return;
    }
    const targetCategory = catRes.value || defaultCategoryName;

    const btn = document.getElementById('quickAddConfirmBtn');
    const origText = btn ? btn.innerText : '';
    if (btn) {
        btn.disabled = true;
        btn.innerText = safeT('btnProcessing', null, '處理中...');
    }

    // 🌟 記憶本次選擇的字庫至 localStorage
    localStorage.setItem('lzhcard_last_quick_add_cat', targetCategory);

    // 先自動清理字庫中既有的重複單字
    autoDeduplicateWordList({ silent: true });

    let addedList = [];
    let skippedDuplicateCount = 0;

    for (const rawInputWord of wordsToProcess) {
        const cleanObj = (typeof sanitizeWordAndPos === 'function')
            ? sanitizeWordAndPos(rawInputWord, '', '')
            : { word: rawInputWord, pos: '', meaning: '' };

        const cleanWord = String(cleanObj.word || rawInputWord).trim().replace(/\s+/g, ' ');
        const normWord = normalizeWordKey(cleanWord);
        if (!normWord) continue;

        // 1️⃣ 檢查目標字庫內是否已存在（含本次剛加入的單字）
        const existsInTargetCat = wordList.some(w => 
            (w.category || defaultCategoryName).trim().toLowerCase() === targetCategory.toLowerCase() && 
            normalizeWordKey(w.word) === normWord
        );

        if (existsInTargetCat) {
            skippedDuplicateCount++;
            continue;
        }

        // 2️⃣ 若其他字庫已有同名單字，繼承其學習進度與已解析資料（避免重複浪費 AI）
        const existingInOtherCat = wordList.find(w => normalizeWordKey(w.word) === normWord);

        const newCard = {
            id: 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            category: targetCategory,
            word: cleanWord,
            pos: existingInOtherCat && isValidFieldValue(existingInOtherCat.pos) ? existingInOtherCat.pos : (cleanObj.pos || ''),
            phonetic: existingInOtherCat && isValidFieldValue(existingInOtherCat.phonetic) ? existingInOtherCat.phonetic : '',
            meaning: existingInOtherCat && isValidFieldValue(existingInOtherCat.meaning) ? existingInOtherCat.meaning : defaultMeaningText,
            sentence: existingInOtherCat && isValidFieldValue(existingInOtherCat.sentence) ? existingInOtherCat.sentence : '',
            translation: existingInOtherCat && isValidFieldValue(existingInOtherCat.translation) ? existingInOtherCat.translation : '',
            level: existingInOtherCat ? (existingInOtherCat.level || 1) : 1,
            knowStreak: existingInOtherCat ? (existingInOtherCat.knowStreak || 0) : 0,
            updatedAt: Date.now()
        };
        wordList.unshift(newCard);
        addedList.push(newCard);
    }

    if (typeof closeModal === 'function') closeModal('quickAddModal');
    if (inputElem) inputElem.value = '';
    if (btn) {
        btn.disabled = false;
        btn.innerText = origText;
    }

    if (addedList.length === 0) {
        if (typeof showToast === 'function') {
            showToast(
                safeT('toastQuickWordsExist', null, `輸入的 ${skippedDuplicateCount} 個單字皆已存在，已自動略過重複項`),
                'info'
            );
        }
        return;
    }

    if (typeof saveStorage === 'function') saveStorage();
    if (typeof updateCategorySelects === 'function') updateCategorySelects();
    if (typeof updateUI === 'function') updateUI();

    const dedupNote = skippedDuplicateCount > 0 ? `（已自動略過 ${skippedDuplicateCount} 個重複字）` : '';
    if (typeof showToast === 'function') {
        showToast(
            safeT('toastQuickAddSuccess', { count: addedList.length }, `已新增 ${addedList.length} 個單字${dedupNote}，AI 正在背景解析中`),
            'success'
        );
    }

    // 僅針對尚未有完整資料的新單字執行 AI 補齊
    const cardsNeedingAi = addedList.filter(c => !isValidFieldValue(c.meaning) || !isValidFieldValue(c.sentence));

    if (cardsNeedingAi.length > 0 && typeof runBatchAiAutoFill === 'function') {
        try {
            await runBatchAiAutoFill(cardsNeedingAi, (current, total) => {
                if (typeof saveStorage === 'function') saveStorage();
                if (typeof updateUI === 'function') updateUI();
            });
            
            if (typeof saveStorage === 'function') saveStorage();
            if (typeof updateUI === 'function') updateUI();

            if (currentCard) {
                const updated = wordList.find(w => w.id === currentCard.id);
                if (updated) {
                    currentCard = updated;
                }
            }
            if (typeof showToast === 'function') showToast(safeT('toastAiCompletionDone', null, 'AI 背景解析完成！'), 'success');
        } catch (err) {
            console.warn("AI 自動補充跳過或失敗:", err);
        }
    }
}

function openSplitDeckModal() {
    if (typeof updateCategorySelects === 'function') updateCategorySelects();
    if (typeof openModal === 'function') openModal('splitModal');
}

function handleConfirmSplitDeck() {
    const select = document.getElementById('splitTargetCategorySelect');
    const chunkSizeInput = document.getElementById('splitChunkSizeInput');

    const targetCat = select ? select.value : '';
    const chunkSize = parseInt(chunkSizeInput.value, 10) || 200;

    if (!targetCat) {
        if (typeof showToast === 'function') showToast(safeT('toastSelectSplitDeck', null, '請選擇要拆分的字庫'), 'warning');
        return;
    }

    const defaultCatName = safeT('defaultCategoryName', null, '預設字庫');
    const targetWords = wordList.filter(w => (w.category || defaultCatName) === targetCat);
    if (targetWords.length === 0 || targetWords.length <= chunkSize) {
        if (typeof showToast === 'function') showToast(safeT('toastSplitThreshold', { size: chunkSize }, `單字量未超過 ${chunkSize}，無需拆分`), 'info');
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
    if (typeof showToast === 'function') showToast(safeT('toastSplitSuccess', { count: partNum - 1 }, `成功拆分為 ${partNum - 1} 個子字庫`), 'success');
}

function handleRenameCategory() {
    const activeCats = window.selectedCategories || [];
    let targetCat = activeCats[0] || 'ALL';
    const defaultCatName = safeT('defaultCategoryName', null, '預設字庫');

    if (targetCat === 'ALL' || activeCats.length > 1 || activeCats.length === 0) {
        const cats = typeof getAllCategories === 'function' ? getAllCategories() : [];
        const inputCat = prompt(safeT('promptSelectRenameDeck', { list: cats.join('、 ') }, `請輸入要重命名的字庫名稱：\n(${cats.join('、 ')})`));
        if (!inputCat || !inputCat.trim()) return;
        targetCat = inputCat.trim();
        
        if (!cats.includes(targetCat)) {
            if (typeof showToast === 'function') showToast(safeT('toastCategoryNotFound', { name: targetCat }, `未找到字庫「${targetCat}」`), 'warning');
            return;
        }
    }

    const newName = prompt(safeT('promptNewDeckName', { name: targetCat }, `請輸入「${targetCat}」的新名稱：`), targetCat);
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

    window.selectedCategories = window.selectedCategories.map(c => c === targetCat ? cleanNewName : c);
    if (typeof saveSelectedCategoriesToCloud === 'function') {
        saveSelectedCategoriesToCloud(window.selectedCategories);
    }

    // 🌟 若重命名後與既有同名資料夾合併，自動清理重複單字
    autoDeduplicateWordList({ silent: true });

    if (typeof saveStorage === 'function') saveStorage();
    if (typeof updateCategorySelects === 'function') updateCategorySelects();
    if (typeof updateUI === 'function') updateUI();
    if (typeof showToast === 'function') showToast(safeT('toastRenameSuccess', { oldName: targetCat, newName: cleanNewName, count: updatedCount }, `已將「${targetCat}」重命名為「${cleanNewName}」`), 'success');
}

/**
 * 📦 批量變更 / 移動字庫（移動後若與目標字庫有重複字會自動合併刪除）
 */
function handleBatchChangeCategory() {
    if (typeof selectedWordIds === 'undefined' || selectedWordIds.size === 0) {
        if (typeof showToast === 'function') showToast(safeT('toastSelectMoveWords', null, '請先勾選要移動的單字！'), 'warning');
        return;
    }

    const activeCats = window.selectedCategories || ['ALL'];
    const currentCatName = (activeCats.length === 1 && activeCats[0] !== 'ALL')
        ? activeCats[0]
        : safeT('defaultCategoryName', null, '預設字庫');

    const promptText = safeT('promptMoveTarget', { count: selectedWordIds.size }, `將已選取的 ${selectedWordIds.size} 筆單字移至新的字庫名稱：`);

    const newCategory = prompt(promptText, currentCatName);
    if (!newCategory || !newCategory.trim()) return;

    const catName = newCategory.trim();
    let count = 0;

    wordList.forEach(item => {
        if (selectedWordIds.has(item.id)) {
            item.category = catName;
            count++;
        }
    });

    if (typeof selectedWordIds !== 'undefined') selectedWordIds.clear();

    const dedupedCount = autoDeduplicateWordList({ silent: true });

    if (typeof saveStorage === 'function') saveStorage();
    if (typeof updateCategorySelects === 'function') updateCategorySelects();
    if (typeof updateUI === 'function') updateUI();

    const dedupHint = dedupedCount > 0 ? `（並自動合併 ${dedupedCount} 筆重複單字）` : '';
    if (typeof showToast === 'function') showToast(safeT('toastMoveSuccess', { count, name: catName }, `已成功將 ${count} 個單字移至「${catName}」${dedupHint}`), 'success');
}

function handleBatchDeleteWords() {
    if (typeof selectedWordIds === 'undefined' || selectedWordIds.size === 0) {
        if (typeof showToast === 'function') showToast(safeT('toastSelectDeleteWords', null, '請先勾選要刪除的單字！'), 'warning');
        return;
    }

    const confirmMsg = safeT('confirmDeleteBatch', { count: selectedWordIds.size }, `確定要刪除已選取的 ${selectedWordIds.size} 筆單字嗎？`);
    if (confirm(confirmMsg)) {
        wordList = wordList.filter(item => !selectedWordIds.has(item.id));
        selectedWordIds.clear();
        if (typeof saveStorage === 'function') saveStorage();
        if (typeof updateCategorySelects === 'function') updateCategorySelects();
        if (typeof updateUI === 'function') updateUI();
        if (typeof nextCard === 'function') nextCard();
        if (typeof showToast === 'function') showToast(safeT('toastDeleteBatchSuccess', null, '批量刪除完成！'), 'info');
    }
}

/**
 * 🤖 點擊畫面「✨ AI 補齊」觸發的 UI 互動與進度條控制
 */
async function handleBatchAiFillLibraryWords() {
    try {
        const defaultCatName = safeT('defaultCategoryName', null, '預設字庫');
        const activeCats = window.selectedCategories || ['ALL'];

        let targetWords = [];
        if (typeof selectedWordIds !== 'undefined' && selectedWordIds.size > 0) {
            targetWords = (wordList || []).filter(item => selectedWordIds.has(item.id));
        } else {
            targetWords = (wordList || []).filter(item => {
                if (activeCats.includes("ALL")) return true;
                return activeCats.includes(item.category || defaultCatName);
            });
        }

        if (targetWords.length === 0) {
            if (typeof showToast === 'function') showToast(safeT('toastNoWordsToFill', null, '當前選取範圍內沒有單字可供補齊！'), 'warning');
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

        let forceOverwrite = false;
        let targetBatch = [];

        if (incompleteWords.length < targetWords.length && incompleteWords.length > 0) {
            const choice = prompt(
                `選取的 ${targetWords.length} 筆單字中，有 ${incompleteWords.length} 筆缺漏欄位。\n\n` +
                `請輸入數字選擇處理方式：\n` +
                `1 ➜ 僅補齊缺漏欄位 (${incompleteWords.length} 筆)\n` +
                `2 ➜ 開啟「語言修正模式」(強制覆蓋解析全選 ${targetWords.length} 筆)\n\n` +
                `點擊【取消】將關閉並退出。`,
                "1"
            );

            if (choice === null) return;

            const trimmedChoice = choice.trim();
            if (trimmedChoice === "2") {
                forceOverwrite = true;
                targetBatch = targetWords;
            } else if (trimmedChoice === "1") {
                forceOverwrite = false;
                targetBatch = incompleteWords;
            } else {
                return;
            }
        } else if (incompleteWords.length === 0) {
            const confirmOverwrite = confirm(
                `所選取的 ${targetWords.length} 筆單字資料皆已完整！\n\n` +
                `是否要開啟「語言修正模式」（依據當前學習語系重新解析並【強制覆蓋】舊資料）？\n\n` +
                `【確定】➜ 強制覆蓋\n` +
                `【取消】➜ 放棄退出`
            );
            if (!confirmOverwrite) return;
            forceOverwrite = true;
            targetBatch = targetWords;
        } else {
            targetBatch = incompleteWords;
            const confirmMsg = safeT('confirmBatchAiFill', { count: targetBatch.length }, `確定要使用 AI 自動補齊缺漏的 ${targetBatch.length} 筆單字嗎？`);
            if (!confirm(confirmMsg)) return;
        }

        if (targetBatch.length === 0) {
            if (typeof showToast === 'function') showToast(safeT('toastAllWordsComplete', null, '單字資料皆已完整！'), 'info');
            return;
        }

        const MAX_LIMIT = typeof MAX_AI_BATCH_LIMIT !== 'undefined' ? MAX_AI_BATCH_LIMIT : 200;

        if (targetBatch.length > MAX_LIMIT) {
            if (typeof showToast === 'function') showToast(safeT('toastBatchLimitExceeded', { count: targetBatch.length }, `一次最多僅支援批次補齊 ${MAX_LIMIT} 筆單字！`), 'error');
            return;
        }

        const progressContainer = document.getElementById('libAiProgressContainer') 
                                || document.getElementById('aiProgressContainer');
        const progressBar = document.getElementById('libAiProgressBar') 
                         || document.getElementById('aiProgressBar');
        const progressText = document.getElementById('libAiProgressText') 
                         || document.getElementById('aiProgressText');
        const progressPercent = document.getElementById('libAiProgressPercent') 
                           || document.getElementById('aiProgressPercent');

        if (progressContainer) progressContainer.classList.remove('hidden');

        if (typeof runBatchAiAutoFill === 'function') {
            await runBatchAiAutoFill(targetBatch, (current, total) => {
                const pct = Math.round((current / total) * 100);
                if (progressText) progressText.innerText = safeT('progressBatchAi', { current, total }, `AI 自動補充中... (${current}/${total})`);
                if (progressBar) progressBar.style.width = `${pct}%`;
                if (progressPercent) progressPercent.innerText = `${pct}%`;
                if (typeof renderWordList === 'function') renderWordList();
            }, forceOverwrite);
        }

        if (typeof saveStorage === 'function') saveStorage();
        if (typeof updateUI === 'function') updateUI();

        if (progressText) progressText.innerText = safeT('progressAiComplete', null, 'AI 自動補充完成！');
        if (progressBar) progressBar.style.width = "100%";
        if (progressPercent) progressPercent.innerText = "100%";

        setTimeout(() => {
            if (progressContainer) progressContainer.classList.add('hidden');
        }, 2500);

        if (typeof showToast === 'function') showToast(safeT('toastBatchFillSuccess', { count: targetBatch.length }, `成功補齊 ${targetBatch.length} 筆單字！`), 'success');
    } catch (err) {
        console.error("[AI Batch Fill Exception]:", err);
        if (typeof showToast === 'function') showToast("AI 補齊過程發生錯誤: " + err.message, "error");
    }
}

function exportJSON() {
    if (!wordList || wordList.length === 0) {
        if (typeof showToast === 'function') showToast(safeT('toastNoExportWords', null, '尚無單字資料可匯出！'), 'warning');
        return;
    }

    autoDeduplicateWordList({ silent: true });

    const dataStr = JSON.stringify(wordList, null, 2);
    const fileName = `LZHCard_Backup_${new Date().toISOString().slice(0, 10)}.json`;

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

    if (typeof showToast === 'function') showToast(safeT('toastDownloadSuccess', { count: wordList.length }, `成功匯出 ${wordList.length} 筆單字備份`), 'success');
}

function handleImportJSON() {
    const fileInput = document.getElementById('jsonFileInput');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        if (typeof showToast === 'function') showToast(safeT('toastSelectJsonFirst', null, '請先選擇要匯入的 JSON 檔案！'), "warning");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData)) {
                if (typeof showToast === 'function') showToast(safeT('toastJsonFormatError', null, 'JSON 檔案格式不正確！'), "error");
                return;
            }

            const defaultCatName = safeT('defaultCategoryName', null, '預設字庫');
            let addedCount = 0;
            let replacedCount = 0;

            importedData.forEach(item => {
                if (item && item.word) {
                    const itemCat = String(item.category || defaultCatName).trim() || defaultCatName;
                    const itemWord = String(item.word).trim().replace(/\s+/g, ' ');
                    const normWord = normalizeWordKey(itemWord);
                    if (!normWord) return;

                    const importedCard = {
                        id: item.id || ('w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
                        category: itemCat,
                        word: itemWord,
                        pos: String(item.pos || '').trim(),
                        phonetic: String(item.phonetic || '').trim(),
                        meaning: String(item.meaning || safeT('noMeaning', null, '無釋義')).trim(),
                        sentence: String(item.sentence || '').trim(),
                        translation: String(item.translation || '').trim(),
                        level: item.level || 1,
                        knowStreak: item.knowStreak || 0,
                        updatedAt: Date.now()
                    };

                    const existingIndex = wordList.findIndex(w => 
                        (w.category || defaultCatName).trim().toLowerCase() === itemCat.toLowerCase() &&
                        normalizeWordKey(w.word) === normWord
                    );

                    if (existingIndex !== -1) {
                        const existingItem = wordList[existingIndex];
                        wordList.splice(existingIndex, 1);
                        wordList.unshift(mergeDuplicateWordRecord(existingItem, importedCard, true));
                        replacedCount++;
                    } else {
                        wordList.unshift(importedCard);
                    }
                    addedCount++;
                }
            });

            autoDeduplicateWordList({ silent: true });

            if (typeof saveStorage === 'function') await saveStorage();
            if (typeof updateCategorySelects === 'function') updateCategorySelects();
            if (typeof updateUI === 'function') updateUI();
            if (!currentCard && typeof nextCard === 'function') nextCard();

            if (typeof closeModal === 'function') closeModal('backupModal');
            fileInput.value = '';

            const netUniqueAdded = addedCount - replacedCount;
            const msg = replacedCount > 0 
                ? safeT('toastImportSuccessDeDup', { count: addedCount, dedup: replacedCount, actual: netUniqueAdded }, `成功匯入 ${addedCount} 個單字（自動合併 ${replacedCount} 筆重複單字）`)
                : safeT('toastImportSuccess', { count: addedCount }, `成功匯入 ${addedCount} 個單字`);

            if (typeof showToast === 'function') showToast(msg, "success");

        } catch (err) {
            console.error("JSON 解析失敗:", err);
            if (typeof showToast === 'function') showToast(safeT('toastJsonParseError', null, 'JSON 檔案解析失敗'), "error");
        }
    };

    reader.readAsText(file);
}

// 🔗 全向點擊導向別名綁定
const handleBatchMoveCategory = handleBatchChangeCategory;
const handleBatchDelete = handleBatchDeleteWords;
const handleBatchAiFill = handleBatchAiFillLibraryWords;
const handleExportJSON = exportJSON;
const handleSplitCategory = handleConfirmSplitDeck;
const handleRemoveDuplicateWords = () => autoDeduplicateWordList({ silent: false });
