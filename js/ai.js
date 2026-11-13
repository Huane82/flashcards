/**
 * LZHCard - Gemini AI 萬能多語系解析模組 (AI Core Engine - 即時參考同步 + 高穩定防漏字版)
 */

window.cachedWorkingModel = null;

// 🌐 Cloudflare Worker 免費共用後端中繼站網址
const SHARED_BACKEND_URL = "https://lzhcard.tomlin980415.workers.dev";

// ⚠️ 保留您指定使用的模型陣列
const GEMINI_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.8-flash"
];

// 🛡️ 個人 API 流量控制（14 RPM 順暢流控不撞牆）
const GLOBAL_AI_MAX_RPM = 14;
const GLOBAL_AI_WINDOW_MS = 60 * 1000;
window.geminiApiCallTimestamps = window.geminiApiCallTimestamps || [];

/**
 * ⏳ 個人 API Key 自動排隊機制
 */
async function waitForRateLimitSlot() {
    while (true) {
        const now = Date.now();
        window.geminiApiCallTimestamps = window.geminiApiCallTimestamps.filter(
            ts => now - ts < GLOBAL_AI_WINDOW_MS
        );

        if (window.geminiApiCallTimestamps.length < GLOBAL_AI_MAX_RPM) {
            window.geminiApiCallTimestamps.push(now);
            return;
        }

        const oldestCall = window.geminiApiCallTimestamps[0];
        const waitMs = GLOBAL_AI_WINDOW_MS - (now - oldestCall) + 100;
        
        console.log(`[AI Rate Limiter] 個人配額達 14 RPM，自動排隊 ${Math.ceil(waitMs / 1000)} 秒...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
    }
}

function getApiMode() {
    return localStorage.getItem('lzhcard_api_mode') || 'personal';
}

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

function updateApiKeyStatusUI() {
    const icon = document.getElementById('apiKeyIcon');
    if (!icon) return;

    const mode = getApiMode();
    if (mode === 'shared') {
        icon.classList.remove('text-amber-500');
        icon.classList.add('text-emerald-500');
        return;
    }

    const rawKey = localStorage.getItem('flashcard_gemini_key_v1');
    const isValid = rawKey && rawKey.trim() && rawKey.trim() !== 'undefined' && rawKey.trim() !== 'null';

    if (isValid) {
        icon.classList.remove('text-amber-500');
        icon.classList.add('text-emerald-500');
    } else {
        icon.classList.remove('text-emerald-500');
        icon.classList.add('text-amber-500');
    }
}

window.addEventListener('DOMContentLoaded', updateApiKeyStatusUI);

function getValidApiKey() {
    const rawKey = localStorage.getItem('flashcard_gemini_key_v1');
    if (!rawKey || !rawKey.trim() || rawKey.trim() === 'undefined' || rawKey.trim() === 'null') {
        localStorage.removeItem('flashcard_gemini_key_v1');
        updateApiKeyStatusUI();
        return null;
    }
    updateApiKeyStatusUI();
    return rawKey.trim();
}

/**
 * 🌐 全域底層 API 呼叫函式 (雙軌模式入口)
 */
async function callGeminiApi(promptText) {
    const mode = getApiMode();

    if (mode === 'shared') {
        return await fetchViaSharedProxy(promptText);
    } else {
        const apiKey = getValidApiKey();
        if (!apiKey) {
            if (typeof showToast === 'function') showToast(safeT('toastNoApiKey', null, '請先設定個人 Gemini API Key 或切換為免費共用模式'), "warning");
            if (typeof openModal === 'function') openModal('keyModal');
            throw new Error("未設定個人 API Key");
        }
        await waitForRateLimitSlot();
        return await fetchGeminiDirectly(apiKey, promptText);
    }
}

async function fetchGeminiDirectly(apiKey, promptText) {
    const cleanKey = apiKey.trim();

    const modelList = window.cachedWorkingModel 
        ? [window.cachedWorkingModel, ...GEMINI_MODELS.filter(m => m !== window.cachedWorkingModel)]
        : GEMINI_MODELS;

    let lastError = null;

    for (const model of modelList) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
        
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
            });

            if (res.ok) {
                const data = await res.json();
                window.cachedWorkingModel = model;
                return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }

            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('flashcard_gemini_key_v1');
                updateApiKeyStatusUI();
                if (typeof showToast === 'function') showToast(safeT('toastInvalidApiKey', null, 'Gemini API Key 無效，請重新設定'), "error");
                if (typeof openModal === 'function') openModal('keyModal');
                throw new Error("Gemini API Key 無效");
            }

            lastError = `模型 ${model} 回應異常 (${res.status})`;
        } catch (e) {
            console.error(`[AI Engine] 嘗試模型 ${model} 失敗:`, e);
            lastError = e.message;
        }
    }

    throw new Error(lastError || "無法連線至 AI 伺服器");
}

async function fetchViaSharedProxy(promptText) {
    try {
        const res = await fetch(SHARED_BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }]
            })
        });

        if (res.ok) {
            const data = await res.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else if (res.status === 429) {
            if (typeof showToast === 'function') {
                showToast("共用免費配額繁忙中，建議於設定中填入個人 API Key 解鎖完整速度！", "warning");
            }
            throw new Error("共用免費 API 限流 (429)");
        } else {
            const errData = await res.json().catch(() => ({}));
            const errorMsg = errData.error || `伺服器回應異常 (${res.status})`;
            console.error('[Shared API Proxy Error]:', errorMsg);
            throw new Error(errorMsg);
        }
    } catch (e) {
        console.error('[Shared API Proxy Exception]:', e);
        const failMessage = e.message === 'Failed to fetch' 
            ? '網路連線失敗或 Worker CORS 跨域遭阻擋' 
            : e.message;
        throw new Error(failMessage);
    }
}

function safeParseJSON(rawText) {
    if (!rawText) return null;

    let cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

    // 精準萃取最外層的 JSON 陣列 [...] 或物件 {...}（忽略 AI 額外輸出的前後說明文字）
    const firstBracket = cleaned.indexOf('[');
    const firstBrace = cleaned.indexOf('{');

    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
        const lastBracket = cleaned.lastIndexOf(']');
        cleaned = lastBracket > firstBracket
            ? cleaned.slice(firstBracket, lastBracket + 1)
            : cleaned.slice(firstBracket);
    } else if (firstBrace !== -1) {
        const lastBrace = cleaned.lastIndexOf('}');
        cleaned = lastBrace > firstBrace
            ? cleaned.slice(firstBrace, lastBrace + 1)
            : cleaned.slice(firstBrace);
    }

    try { return JSON.parse(cleaned); } catch (e1) {}

    try {
        const fixedNewlines = cleaned.replace(/(?<!\\)\n/g, "\\n");
        return JSON.parse(fixedNewlines);
    } catch (e2) {}

    // 截斷修復：移除最後一個不完整的物件並補齊 ]
    if (cleaned.startsWith('[')) {
        const lastCompleteObjEnd = cleaned.lastIndexOf('}');
        if (lastCompleteObjEnd !== -1) {
            const salvagedArray = cleaned.slice(0, lastCompleteObjEnd + 1) + ']';
            try { return JSON.parse(salvagedArray); } catch (e3) {}
        }
    }

    let repaired = cleaned;
    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) repaired += '"';

    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    if (openBraces > closeBraces) repaired += '}'.repeat(openBraces - closeBraces);

    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) repaired += ']'.repeat(openBrackets - closeBrackets);

    try { return JSON.parse(repaired); } catch (e4) {}

    const objects = [];
    const matches = cleaned.match(/\{[^{}]*\}/g) || [];
    for (const m of matches) {
        try {
            const parsed = JSON.parse(m);
            if (parsed && parsed.word) objects.push(parsed);
        } catch(e) {}
    }

    if (objects.length > 0) return objects;
    return null;
}

/**
 * 🛡️ 增強版欄位完整性與語言錯植檢查（自動偵測「釋義／翻譯／例句與目前設定語言不符」）
 */
function isFieldIncomplete(val, fieldType = '') {
    if (!val) return true;
    const str = String(val).trim();
    if (str === '' || str === '-' || str === 'N/A' || str === 'EMPTY' || str === '""' || str === 'undefined' || str === 'null') return true;

    const pendingKeywords = [
        '解析中', 'parsing', '尚未填寫', '未入力', '待補齊', 
        'no definition', 'pending', '自動解析', 'no sentence', 
        '無例句', '未設定例句', '無翻譯', '未設定', 'empty',
        '無母語釋意', '無母語釋義', '無釋意', '無釋義', '無中文釋義', '無中文釋意', '尚無釋義', '暫無釋義'
    ];

    if (pendingKeywords.some(keyword => str.toLowerCase().includes(keyword.toLowerCase()))) {
        return true;
    }

    const targetLang = localStorage.getItem('lzhcard_target_lang') || 'en';
    const nativeLang = localStorage.getItem('lzhcard_native_lang') || 'zh-TW';

    if (fieldType === 'sentence') {
        if (targetLang === 'en' && /[\u3040-\u30ff\u4e00-\u9fff]/.test(str)) {
            return true;
        }
        if (targetLang === 'ja' && !/[\u3040-\u30ff\u4e00-\u9fff]/.test(str) && /[a-zA-Z]/.test(str)) {
            return true;
        }
        if ((targetLang === 'zh-TW' || targetLang === 'zh') && !/[\u4e00-\u9fff]/.test(str) && /[a-zA-Z]/.test(str)) {
            return true;
        }
    }

    if (fieldType === 'meaning' || fieldType === 'translation') {
        if ((nativeLang === 'zh-TW' || nativeLang === 'zh') && !/[\u4e00-\u9fff]/.test(str) && /[a-zA-Z]/.test(str)) {
            return true;
        }
        if (nativeLang === 'ja' && !/[\u3040-\u30ff\u4e00-\u9fff]/.test(str) && /[a-zA-Z]/.test(str)) {
            return true;
        }
        if (nativeLang === 'en' && /[\u3040-\u30ff\u4e00-\u9fff]/.test(str)) {
            return true;
        }
    }

    return false;
}

function getLanguageConfig() {
    const targetLang = localStorage.getItem('lzhcard_target_lang') || 'en';
    const nativeLang = localStorage.getItem('lzhcard_native_lang') || 'zh-TW';
    const customTarget = (localStorage.getItem('lzhcard_custom_target') || '').trim();
    const customNative = (localStorage.getItem('lzhcard_custom_native') || '').trim();

    const langNameMap = {
        'en': 'English',
        'ja': 'Japanese (日本語)',
        'zh-TW': 'Traditional Chinese (繁體中文, 臺灣標準)',
        'custom': ''
    };

    const targetName = targetLang === 'custom' 
        ? (customTarget || 'Auto-Detect Target Language') 
        : (langNameMap[targetLang] || 'English');

    const nativeName = nativeLang === 'custom' 
        ? (customNative || 'Auto-Detect Native Language') 
        : (langNameMap[nativeLang] || 'Traditional Chinese (繁體中文)');

    return { targetLang, nativeLang, targetName, nativeName };
}

function sanitizeWordAndPos(rawWord, rawPos, rawMeaning) {
    let word = (rawWord || '').trim();
    let pos = (rawPos || '').trim();
    let meaning = (rawMeaning || '').trim();

    word = word.replace(/[\(\[（【]?\s*(?:無母語釋意|無母語釋義|無釋意|無釋義|無中文釋義|無中文釋意|解析中|自動解析中\.\.\.)\s*[\)\]）】]?/gi, '').trim();

    const posUnit = '(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|phr|名詞|代名詞|動詞|他動詞|自動詞|形容詞|形容動詞|副詞|助詞|感動詞|連體詞|接続詞)';
    const multiPosRegex = new RegExp(
        `(?:[\\(\\[\\{]\\s*${posUnit}(?:[\\s\\.\\,\\/\\\\&|]+${posUnit})*[\\.\\s]*[\\)\\]\\}])` +
        `|(?:\\b${posUnit}\\.(?:[\\s\\,\\/\\\\&|]*${posUnit}\\.)*)` +
        `|(?:\\b(?:名詞|代名詞|動詞|他動詞|自動詞|形容詞|形容動詞|副詞|助詞|感動詞|連體詞|接続詞)(?:[\\s\\,\\/\\\\&|]+(?:名詞|代名詞|動詞|他動詞|自動詞|形容詞|形容動詞|副詞|助詞|感動詞|連體詞|接続詞))*\\b)`,
        'gi'
    );

    if (word) {
        const match = word.match(multiPosRegex);
        if (match && match[0].length < word.length) {
            if (!pos) pos = match[0].replace(/[\(\[\{\)\]\}]/g, '').trim();
            word = word.replace(match[0], '').trim();
        }
    }

    if (meaning) {
        const match = meaning.match(multiPosRegex);
        if (match && match[0].length < meaning.length) {
            if (!pos) pos = match[0].replace(/[\(\[\{\)\]\}]/g, '').trim();
            meaning = meaning.replace(match[0], '').trim();
        }
    }

    return { word, pos, meaning };
}

async function autoFillWithAI(word) {
    const cleaned = sanitizeWordAndPos(word, '', '');
    const cleanWord = cleaned.word;
    const { targetLang, targetName, nativeName } = getLanguageConfig();
    const phoneticRule = targetLang === 'ja'
        ? 'Pure Hiragana reading ONLY (純平假名讀音, e.g. はじめ; NEVER use Romaji like [hajime] or IPA)'
        : 'IPA or pronunciation guide for the corrected word';

    const prompt = `You are a professional lexicographer.
Input Term: "${cleanWord}"
Target Language: ${targetName}
User Native Language: ${nativeName}

MANDATORY INSTRUCTIONS:
1. "word": Automatically fix any common spelling typos in "${cleanWord}" (e.g. "enviroment" -> "environment", "recieve" -> "receive"). If the spelling is already valid (including valid phrases, idioms, Japanese words, or proper nouns), keep it unchanged.
2. "phonetic": ${phoneticRule} (MUST NOT BE EMPTY).
3. "pos": Parts of speech translated in ${nativeName} (MUST NOT BE EMPTY).
4. "meaning": Precise definition strictly in ${nativeName} (MUST NOT BE EMPTY).
5. "sentence": A natural example sentence written strictly in ${targetName} using the corrected word (MUST NOT BE EMPTY).
6. "translation": Example sentence translation strictly written in ${nativeName} (MUST NOT BE EMPTY).

Return ONLY a valid raw JSON object:
{
  "word": "corrected spelling of ${cleanWord}",
  "phonetic": "Pronunciation",
  "pos": "POS in ${nativeName}",
  "meaning": "Definition in ${nativeName}",
  "sentence": "Example sentence in ${targetName}",
  "translation": "Translation in ${nativeName}"
}`;

    try {
        const rawResponse = await callGeminiApi(prompt);
        const parsed = safeParseJSON(rawResponse);
        if (parsed && parsed.word) {
            const wordInputElem = document.getElementById('formWord');
            if (wordInputElem && parsed.word.trim() && parsed.word.trim() !== cleanWord) {
                wordInputElem.value = parsed.word.trim();
            }
        }
        return parsed;
    } catch (e) {
        if (typeof showToast === 'function') showToast("AI 解析失敗：" + e.message, "error");
        return null;
    }
}

/**
 * 🤖 批次 AI 欄位補充核心邏輯 (即時同步 wordList 最新參考 + 防截斷 + 自動重試與 100% 補掃)
 */
async function runBatchAiAutoFill(targetList, progressCallback, forceOverwrite = false) {
    // 每次存取卡片前都依 id 從最新的 wordList 取得現行參考，防止 saveStorage 深拷貝替換陣列後寫入失效舊物件
    const resolveLiveItem = (item) => {
        if (item && item.id && typeof wordList !== 'undefined' && Array.isArray(wordList)) {
            return wordList.find(w => w.id === item.id) || item;
        }
        return item;
    };

    const initialLiveList = targetList.map(resolveLiveItem);
    const targetItems = forceOverwrite ? initialLiveList : initialLiveList.filter(item => 
        isFieldIncomplete(item.meaning, 'meaning') || 
        isFieldIncomplete(item.pos, 'pos') || 
        isFieldIncomplete(item.sentence, 'sentence') || 
        isFieldIncomplete(item.translation, 'translation') ||
        isFieldIncomplete(item.phonetic, 'phonetic')
    );

    const total = targetItems.length;
    if (total === 0) return 0;

    const { targetLang, targetName, nativeName } = getLanguageConfig();
    const phoneticRule = targetLang === 'ja'
        ? 'MUST provide Pure Hiragana reading ONLY (純平假名讀音, e.g. はじめ; NEVER use Romaji or IPA).'
        : 'MUST provide IPA pronunciation guide for the corrected word (DO NOT LEAVE EMPTY).';

    const batchSize = targetLang === 'ja' ? 20 : 20;
    let completedCount = 0;
    let successUpdatedCount = 0;
    let lastBatchError = '';
    const updatedKeys = new Set();

    const normalizeWord = str => (str || '').toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]/g, '');

    const buildBatchPrompt = (cleanInputs) => `You are an expert lexicographer.
Input Terms (JSON array with index and term): ${JSON.stringify(cleanInputs)}
Target Language: ${targetName}
User Native Language: ${nativeName}

CRITICAL RULES (STRICT COMPLIANCE REQUIRED):
1. "index": MUST keep the exact integer "index" from the input item so each result maps back 1-to-1.
2. "word": Automatically correct any common spelling typos in the input term (e.g., "enviroment" -> "environment"). If the term is already valid (including Japanese words, phrases, or idioms), keep it unchanged.
3. "phonetic": ${phoneticRule}
4. "pos": MUST provide part of speech strictly in ${nativeName}.
5. "meaning": MUST provide clear definition strictly in ${nativeName}.
6. "sentence": MUST provide a complete example sentence strictly in ${targetName} (DO NOT LEAVE EMPTY).
7. "translation": MUST provide translation of sentence strictly in ${nativeName} (DO NOT LEAVE EMPTY).

Return ONLY a valid JSON array with no markdown or extra text:
[
  {
    "index": 0,
    "word": "term",
    "pos": "POS in ${nativeName}",
    "phonetic": "hiragana or IPA",
    "meaning": "definition in ${nativeName}",
    "sentence": "example sentence in ${targetName}",
    "translation": "translation in ${nativeName}"
  }
]`;

    const applyResultsToChunk = (chunk, results) => {
        let chunkMatched = 0;
        results.forEach((resItem, resIdx) => {
            if (!resItem || typeof resItem !== 'object') return;

            let matched = null;
            const parsedIndex = (resItem.index !== undefined && resItem.index !== null && resItem.index !== '')
                ? Number(resItem.index)
                : NaN;

            if (!Number.isNaN(parsedIndex) && chunk[parsedIndex]) {
                matched = chunk[parsedIndex];
            }

            const cleanRes = normalizeWord(resItem.word || '');
            if (!matched && cleanRes) {
                matched = chunk.find(p => p && p.word && normalizeWord(p.word) === cleanRes);
            }
            if (!matched && results.length === chunk.length && chunk[resIdx]) {
                matched = chunk[resIdx];
            }

            if (matched) {
                const target = resolveLiveItem(matched);
                const sanitizedRes = sanitizeWordAndPos(resItem.word || target.word, resItem.pos || '', resItem.meaning || '');
                const correctedWord = (sanitizedRes.word || String(resItem.word || target.word)).trim();

                if (correctedWord && !isFieldIncomplete(correctedWord)) {
                    target.word = correctedWord;
                }

                if ((forceOverwrite || isFieldIncomplete(target.pos, 'pos')) && sanitizedRes.pos) target.pos = sanitizedRes.pos;
                if ((forceOverwrite || isFieldIncomplete(target.phonetic, 'phonetic')) && resItem.phonetic) target.phonetic = String(resItem.phonetic).trim();
                if ((forceOverwrite || isFieldIncomplete(target.meaning, 'meaning')) && sanitizedRes.meaning) target.meaning = sanitizedRes.meaning;
                if ((forceOverwrite || isFieldIncomplete(target.sentence, 'sentence')) && resItem.sentence) target.sentence = String(resItem.sentence).trim();
                if ((forceOverwrite || isFieldIncomplete(target.translation, 'translation')) && resItem.translation) target.translation = String(resItem.translation).trim();

                target.updatedAt = Date.now();
                const trackKey = target.id || target;
                if (!updatedKeys.has(trackKey)) {
                    updatedKeys.add(trackKey);
                    successUpdatedCount++;
                }
                chunkMatched++;
            }
        });
        return chunkMatched;
    };

    const executeChunkWithRetry = async (chunk, allowSplit = true) => {
        const cleanChunkInputs = chunk.map((item, idx) => {
            const live = resolveLiveItem(item);
            const sanitized = sanitizeWordAndPos(live.word || '', '', '');
            const cleanTerm = sanitized.word || String(live.word || '').trim();
            return { index: idx, word: cleanTerm };
        });

        const prompt = buildBatchPrompt(cleanChunkInputs);
        let parsedArray = null;
        let attempt = 0;
        const maxAttempts = 2;

        while (!parsedArray && attempt < maxAttempts) {
            attempt++;
            try {
                const rawResponse = await callGeminiApi(prompt);
                const parsed = safeParseJSON(rawResponse);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    parsedArray = parsed;
                } else {
                    lastBatchError = 'AI 回傳 JSON 格式異常或被截斷';
                    console.warn(`[AI Batch Parse Retry] 第 ${attempt} 次解析未取得有效陣列，原始前 120 字:`, String(rawResponse || '').slice(0, 120));
                }
            } catch (err) {
                lastBatchError = err.message;
                if (err.message && (err.message.includes('API Key') || err.message.includes('限流'))) {
                    throw err;
                }
            }

            if (!parsedArray && attempt < maxAttempts) {
                await new Promise(r => setTimeout(r, 1500));
            }
        }

        if (parsedArray) {
            applyResultsToChunk(chunk, parsedArray);
            if (typeof saveStorage === 'function') saveStorage();
            if (typeof renderWordList === 'function') renderWordList(false);
            return;
        }

        // 若整批解析仍失敗，自動拆成 5 字一小批再試一次
        if (allowSplit && chunk.length > 5) {
            console.warn(`[AI Batch Split] 批次解析失敗 (${lastBatchError})，自動拆分為 5 字小批重試...`);
            const mid = Math.ceil(chunk.length / 2);
            await executeChunkWithRetry(chunk.slice(0, mid), false);
            await executeChunkWithRetry(chunk.slice(mid), false);
            return;
        }

        console.error(`[AI Batch Error] 子批次處理失敗 (${lastBatchError}):`, cleanChunkInputs);
        if (successUpdatedCount === 0 && completedCount === 0) {
            throw new Error(lastBatchError || '連線至 AI 伺服器失敗');
        }
    };

    for (let i = 0; i < total; i += batchSize) {
        const chunk = targetItems.slice(i, i + batchSize);
        await executeChunkWithRetry(chunk, true);

        completedCount += chunk.length;
        if (progressCallback) {
            progressCallback(completedCount, total);
        }

        if (i + batchSize < total) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // 🔄 自動補掃機制：凡是尚未更新的卡片，或仍有缺漏/非母語欄位的卡片，一律用 5 字小批補跑一次
    const currentLiveItems = targetItems.map(resolveLiveItem);
    const missedItems = currentLiveItems.filter(item =>
        !updatedKeys.has(item.id || item) ||
        isFieldIncomplete(item.meaning, 'meaning') ||
        isFieldIncomplete(item.pos, 'pos') ||
        isFieldIncomplete(item.sentence, 'sentence') ||
        isFieldIncomplete(item.translation, 'translation') ||
        isFieldIncomplete(item.phonetic, 'phonetic')
    );

    if (missedItems.length > 0 && missedItems.length < total) {
        console.log(`[AI Batch Sweep] 偵測到 ${missedItems.length} 筆漏網單字，啟動 5 字小批自動補掃...`);
        const sweepSize = 5;
        for (let j = 0; j < missedItems.length; j += sweepSize) {
            const sweepChunk = missedItems.slice(j, j + sweepSize);
            try {
                await executeChunkWithRetry(sweepChunk, false);
                await new Promise(resolve => setTimeout(resolve, 800));
            } catch (sweepErr) {
                lastBatchError = sweepErr.message;
                console.warn('[AI Batch Sweep Warning]:', sweepErr);
            }
        }
    }

    if (successUpdatedCount === 0) {
        throw new Error(lastBatchError || "AI 未能成功解析任何單字，請稍後再試");
    }

    if (successUpdatedCount < total && lastBatchError && typeof showToast === 'function') {
        showToast(`部分單字未完成 (${successUpdatedCount}/${total})，原因：${lastBatchError}`, 'warning');
    }

    return successUpdatedCount;
}
