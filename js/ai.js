/**
 * LZHCard - Gemini AI 萬能多語系解析模組 (AI Core Engine - 20字高效 + 自動拼寫修正版)
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
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/g, '')
        .trim();

    try { return JSON.parse(cleaned); } catch (e1) {}

    try {
        const fixedNewlines = cleaned.replace(/(?<!\\)\n/g, "\\n");
        return JSON.parse(fixedNewlines);
    } catch (e2) {}

    let repaired = cleaned;
    const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) repaired += '"';

    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    if (openBraces > closeBraces) repaired += '}'.repeat(openBraces - closeBraces);

    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) repaired += ']'.repeat(openBrackets - closeBrackets);

    try { return JSON.parse(repaired); } catch (e3) {}

    const lastCurly = cleaned.lastIndexOf('}');
    if (lastCurly !== -1) {
        let truncatedPart = cleaned.substring(0, lastCurly + 1);
        if (cleaned.trim().startsWith('[')) {
            if (!truncatedPart.trim().endsWith(']')) truncatedPart += ']';
        }
        try { return JSON.parse(truncatedPart); } catch (e4) {}
    }

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

    // 1. 檢查目標語言例句是否錯植成其他語系
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

    // 2. 檢查母語釋義與例句翻譯是否錯植（例如母語設為繁體中文，卻抓到純英文釋義）
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

    // 清除誤混入單字中的佔位標籤（如 "(無母語釋意)"、"（無釋義）"）
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
        ? 'Hiragana reading (平假名讀音, e.g. たべる; if already kana, repeat the hiragana reading)'
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
 * 🤖 批次 AI 欄位補充核心邏輯 (每批 20 字，強制覆蓋僅傳純單字 + 自動修正拼寫錯誤)
 */
async function runBatchAiAutoFill(targetList, progressCallback, forceOverwrite = false) {
    const targetItems = forceOverwrite ? targetList : targetList.filter(item => 
        isFieldIncomplete(item.meaning, 'meaning') || 
        isFieldIncomplete(item.pos, 'pos') || 
        isFieldIncomplete(item.sentence, 'sentence') || 
        isFieldIncomplete(item.translation, 'translation') ||
        isFieldIncomplete(item.phonetic, 'phonetic')
    );

    const total = targetItems.length;
    if (total === 0) return;

    const { targetLang, targetName, nativeName } = getLanguageConfig();
    const phoneticRule = targetLang === 'ja'
        ? 'MUST provide Hiragana reading (平假名讀音, e.g. たべる) for the Japanese term (DO NOT LEAVE EMPTY).'
        : 'MUST provide IPA pronunciation guide for the corrected word (DO NOT LEAVE EMPTY).';

    const batchSize = 20; // 🌟 設定為每批 20 字
    let completedCount = 0;
    let successUpdatedCount = 0;

    const normalizeWord = str => (str || '').toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]/g, '');

    for (let i = 0; i < total; i += batchSize) {
        const chunk = targetItems.slice(i, i + batchSize);

        // 🌟 無論是否強制覆蓋，一律只萃取「序號 + 清理後的純單字」傳給 AI，完全不帶舊釋義以避免卡死
        const cleanChunkInputs = chunk.map((item, idx) => {
            const sanitized = sanitizeWordAndPos(item.word || '', '', '');
            const cleanTerm = sanitized.word || String(item.word || '').trim();
            return { index: idx, word: cleanTerm };
        });

        const prompt = `You are an expert lexicographer.
Input Terms (JSON array with index and term): ${JSON.stringify(cleanChunkInputs)}
Target Language: ${targetName}
User Native Language: ${nativeName}

CRITICAL RULES (STRICT COMPLIANCE REQUIRED):
1. "index": MUST keep the exact integer "index" from the input item so each result maps back 1-to-1.
2. "word": Automatically correct any common spelling typos in the input term (e.g., "enviroment" -> "environment", "recieve" -> "receive", "seperate" -> "separate"). If the term is already spelled correctly (including valid phrases, idioms, Japanese words, or proper nouns), keep it as-is.
3. "phonetic": ${phoneticRule}
4. "pos": MUST provide part of speech strictly in ${nativeName}.
5. "meaning": MUST provide clear definition strictly in ${nativeName}.
6. "sentence": MUST provide a complete example sentence strictly in ${targetName} (DO NOT LEAVE EMPTY).
7. "translation": MUST provide translation of sentence strictly in ${nativeName} (DO NOT LEAVE EMPTY).

Return ONLY a pure JSON array matching input order:
[
  {
    "index": 0,
    "word": "corrected spelling of term",
    "pos": "POS in ${nativeName}",
    "phonetic": "pronunciation or hiragana reading",
    "meaning": "definition in ${nativeName}",
    "sentence": "example sentence in ${targetName}",
    "translation": "translation in ${nativeName}"
  }
]`;

        let rawResponse = null;
        let attempt = 0;
        const maxAttempts = 3;
        let lastErrorMsg = '';

        while (!rawResponse && attempt < maxAttempts) {
            attempt++;
            try {
                rawResponse = await callGeminiApi(prompt);
            } catch (err) {
                lastErrorMsg = err.message;
            }

            if (!rawResponse && attempt < maxAttempts) {
                console.warn(`[AI Batch Retry] 批次解析暫時中斷 (${lastErrorMsg})，等待 1.5 秒後進行重試...`);
                await new Promise(r => setTimeout(r, 1500)); // 🌟 固定 1500 ms
            }
        }

        if (rawResponse) {
            const results = safeParseJSON(rawResponse);
            if (Array.isArray(results)) {
                results.forEach((resItem, resIdx) => {
                    if (!resItem || !resItem.word) return;

                    // 1️⃣ 優先透過 index 精準對應原卡片（即使拼寫被 AI 修正也能 100% 命中）
                    let target = null;
                    if (typeof resItem.index === 'number' && chunk[resItem.index]) {
                        target = chunk[resItem.index];
                    }

                    // 2️⃣ 備援：依字串正規化比對
                    const cleanRes = normalizeWord(resItem.word);
                    if (!target && cleanRes) {
                        target = chunk.find(p => p && p.word && normalizeWord(p.word) === cleanRes);
                    }
                    if (!target && cleanRes) {
                        target = targetList.find(p => p && p.word && normalizeWord(p.word) === cleanRes);
                    }
                    if (!target && results.length === chunk.length && chunk[resIdx]) {
                        target = chunk[resIdx];
                    }

                    if (target) {
                        const sanitizedRes = sanitizeWordAndPos(resItem.word, resItem.pos || '', resItem.meaning || '');
                        const correctedWord = (sanitizedRes.word || String(resItem.word)).trim();

                        // 🌟 自動更新修正後的正確拼寫
                        if (correctedWord && !isFieldIncomplete(correctedWord)) {
                            target.word = correctedWord;
                        }

                        if ((forceOverwrite || isFieldIncomplete(target.pos, 'pos')) && sanitizedRes.pos) target.pos = sanitizedRes.pos;
                        if ((forceOverwrite || isFieldIncomplete(target.phonetic, 'phonetic')) && resItem.phonetic) target.phonetic = resItem.phonetic;
                        if ((forceOverwrite || isFieldIncomplete(target.meaning, 'meaning')) && sanitizedRes.meaning) target.meaning = sanitizedRes.meaning;
                        if ((forceOverwrite || isFieldIncomplete(target.sentence, 'sentence')) && resItem.sentence) target.sentence = resItem.sentence;
                        if ((forceOverwrite || isFieldIncomplete(target.translation, 'translation')) && resItem.translation) target.translation = resItem.translation;
                        target.updatedAt = Date.now();
                        successUpdatedCount++;
                    }
                });

                // 💾 每完成一批（20字），立刻寫入 LocalStorage 存檔並即時更新 UI
                if (typeof saveStorage === 'function') {
                    saveStorage();
                }
                if (typeof renderWordList === 'function') {
                    renderWordList();
                }
            }
        } else {
            console.error(`[AI Batch Error] 該批次重試 ${maxAttempts} 次仍無法連線：`, cleanChunkInputs);
            throw new Error(lastErrorMsg || "連線至 AI 伺服器失敗，請檢查網路連線或 Cloudflare Worker CORS 設定");
        }

        completedCount += chunk.length;
        if (progressCallback) {
            progressCallback(completedCount, total);
        }

        if (i + batchSize < total) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    // 🔄 二次自動補掃機制 (Auto Sweep Pass - 僅在非強制覆蓋或仍有缺漏欄位時執行)
    const leftoverItems = targetItems.filter(item => 
        isFieldIncomplete(item.meaning, 'meaning') || 
        isFieldIncomplete(item.pos, 'pos') || 
        isFieldIncomplete(item.sentence, 'sentence') || 
        isFieldIncomplete(item.translation, 'translation') ||
        isFieldIncomplete(item.phonetic, 'phonetic')
    );

    if (leftoverItems.length > 0 && leftoverItems.length < total) {
        console.log(`[AI Batch Sweep] 發現 ${leftoverItems.length} 個漏網單字，啟動二次自動補掃...`);
        
        for (let j = 0; j < leftoverItems.length; j += batchSize) {
            const sweepChunk = leftoverItems.slice(j, j + batchSize);
            const sweepInputs = sweepChunk.map((item, idx) => {
                const sanitized = sanitizeWordAndPos(item.word || '', '', '');
                return { index: idx, word: sanitized.word || String(item.word || '').trim() };
            });
            
            const sweepPrompt = `You are an expert lexicographer.
Input Terms: ${JSON.stringify(sweepInputs)}
Target Language: ${targetName}
User Native Language: ${nativeName}

CRITICAL RULES:
1. "index": MUST keep exact integer index.
2. "word": Automatically fix common spelling typos if any; otherwise keep unchanged.
3. "phonetic": ${phoneticRule}
4. "pos": MUST provide POS strictly in ${nativeName}.
5. "meaning": MUST provide definition strictly in ${nativeName}.
6. "sentence": MUST provide example sentence strictly in ${targetName}.
7. "translation": MUST provide translation strictly in ${nativeName}.

Return ONLY a pure JSON array:
[
  {
    "index": 0,
    "word": "corrected spelling of term",
    "pos": "POS in ${nativeName}",
    "phonetic": "pronunciation or hiragana reading",
    "meaning": "definition in ${nativeName}",
    "sentence": "example sentence in ${targetName}",
    "translation": "translation in ${nativeName}"
  }
]`;

            try {
                const rawSweep = await callGeminiApi(sweepPrompt);
                if (rawSweep) {
                    const sweepResults = safeParseJSON(rawSweep);
                    if (Array.isArray(sweepResults)) {
                        sweepResults.forEach((resItem, resIdx) => {
                            if (!resItem || !resItem.word) return;
                            let target = (typeof resItem.index === 'number' && sweepChunk[resItem.index])
                                ? sweepChunk[resItem.index]
                                : sweepChunk.find(p => p && p.word && normalizeWord(p.word) === normalizeWord(resItem.word));
                            if (!target && sweepResults.length === sweepChunk.length) target = sweepChunk[resIdx];

                            if (target) {
                                const sanitizedRes = sanitizeWordAndPos(resItem.word, resItem.pos || '', resItem.meaning || '');
                                if (sanitizedRes.word && !isFieldIncomplete(sanitizedRes.word)) {
                                    target.word = sanitizedRes.word;
                                }
                                if (isFieldIncomplete(target.pos, 'pos') && sanitizedRes.pos) target.pos = sanitizedRes.pos;
                                if (isFieldIncomplete(target.phonetic, 'phonetic') && resItem.phonetic) target.phonetic = resItem.phonetic;
                                if (isFieldIncomplete(target.meaning, 'meaning') && sanitizedRes.meaning) target.meaning = sanitizedRes.meaning;
                                if (isFieldIncomplete(target.sentence, 'sentence') && resItem.sentence) target.sentence = resItem.sentence;
                                if (isFieldIncomplete(target.translation, 'translation') && resItem.translation) target.translation = resItem.translation;
                                target.updatedAt = Date.now();
                                successUpdatedCount++;
                            }
                        });

                        // 💾 補掃完成後立刻存檔
                        if (typeof saveStorage === 'function') {
                            saveStorage();
                        }
                        if (typeof renderWordList === 'function') {
                            renderWordList();
                        }
                    }
                }
            } catch (sweepErr) {
                console.warn('[AI Batch Sweep Warning]: 二次補掃嘗試失敗:', sweepErr);
            }
        }
    }

    if (successUpdatedCount === 0) {
        throw new Error("AI 未能成功解析任何單字，請稍後再試");
    }
}
