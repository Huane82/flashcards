/**
 * LZHCard - Gemini AI 萬能多語系解析模組 (AI Core Engine)
 */

window.cachedWorkingModel = null;

// 🌐 Cloudflare Worker 免費共用後端中繼站網址
const SHARED_BACKEND_URL = "https://lzhcard.tomlin980415.workers.dev";

// ⚠️ 保留原本設定的模型名稱
const GEMINI_MODELS = [
    "gemini-3.5-flash-lite",
    "Gemini 3.6 Flash",
    "Gemini 3.8 Flash"
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
        // 🔹 模式 1：使用系統共用 Key（呼叫 Cloudflare Worker 後端代理）
        return await fetchViaSharedProxy(promptText);
    } else {
        // 🔹 模式 2：使用個人 API Key（直連 Google，前端流控保護）
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

/**
 * 🔹 個人 Key：前端直接呼叫 Google API (支援自動切換模型與重試)
 */
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

/**
 * 🔹 共用 Key：透過 Cloudflare Worker 後端代理伺服器轉發 (含精準 CORS / 網路報錯)
 */
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
 * 🛡️ 增強版欄位完整性與語言錯植檢查
 */
function isFieldIncomplete(val, fieldType = '') {
    if (!val) return true;
    const str = String(val).trim();
    if (str === '' || str === '-' || str === 'N/A' || str === 'EMPTY' || str === '""' || str === 'undefined' || str === 'null') return true;

    const pendingKeywords = [
        '解析中', 'parsing', '尚未填寫', '未入力', '待補齊', 
        'no definition', 'pending', '自動解析', 'no sentence', 
        '無例句', '未設定例句', '無翻譯', '未設定', 'empty'
    ];

    if (pendingKeywords.some(keyword => str.toLowerCase().includes(keyword.toLowerCase()))) {
        return true;
    }

    const targetLang = localStorage.getItem('lzhcard_target_lang') || 'en';
    if (targetLang === 'en' && (fieldType === 'sentence' || fieldType === 'translation')) {
        if (/[\u3040-\u30ff]/.test(str)) {
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
    const { targetName, nativeName } = getLanguageConfig();

    const prompt = `You are a professional lexicographer.
Input Term: "${cleanWord}"
Target Language: ${targetName}
User Native Language: ${nativeName}

LANGUAGE INSTRUCTIONS:
1. "word": Keep EXACTLY as "${cleanWord}". Do NOT append readings, brackets, or translation.
2. "phonetic": Pronunciation guide (IPA / Kana / Pinyin / Romaji).
3. "pos": Parts of speech translated in User Native Language (${nativeName}).
4. "meaning": Precise definition translated in User Native Language (${nativeName}).
5. "sentence": A natural example sentence strictly written in Target Language (${targetName}).
6. "translation": Sentence translation strictly written in User Native Language (${nativeName}).

Return ONLY a valid raw JSON object:
{
  "word": "${cleanWord}",
  "phonetic": "Pronunciation",
  "pos": "POS in ${nativeName}",
  "meaning": "Definition in ${nativeName}",
  "sentence": "Example sentence in ${targetName}",
  "translation": "Translation in ${nativeName}"
}`;

    try {
        const rawResponse = await callGeminiApi(prompt);
        return safeParseJSON(rawResponse);
    } catch (e) {
        if (typeof showToast === 'function') showToast("AI 解析失敗：" + e.message, "error");
        return null;
    }
}

/**
 * 🤖 批次 AI 欄位補充核心邏輯 (含失敗重試、真報錯與不漏字保障)
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

    const { targetName, nativeName } = getLanguageConfig();
    const batchSize = 30; // 🌟 設定每批 30 字，平衡穩定度與速度
    let completedCount = 0;
    let successUpdatedCount = 0;

    const normalizeWord = str => (str || '').toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]/g, '');

    for (let i = 0; i < total; i += batchSize) {
        const chunk = targetItems.slice(i, i + batchSize);
        const chunkWords = chunk.map(item => item.word);

        const prompt = `Lexicographer assistant.
Input Terms: ${JSON.stringify(chunkWords)}
Target Language: ${targetName}
User Native Language: ${nativeName}

CRITICAL RULES:
- "word": MUST match the exact string from the input array without adding brackets or furigana.
- "sentence": MUST be a natural example sentence written strictly in Target Language (${targetName}).
- "pos", "meaning", and "translation": MUST be written strictly in User Native Language (${nativeName}).

Return ONLY a pure JSON array matching the input order:
[
  {
    "word": "original term",
    "pos": "POS in ${nativeName}",
    "phonetic": "phonetic",
    "meaning": "definition in ${nativeName}",
    "sentence": "example sentence in ${targetName}",
    "translation": "translation in ${nativeName}"
  }
]`;

        let rawResponse = null;
        let attempt = 0;
        const maxAttempts = 5;
        let lastErrorMsg = '';

        while (!rawResponse && attempt < maxAttempts) {
            attempt++;
            try {
                rawResponse = await callGeminiApi(prompt);
            } catch (err) {
                lastErrorMsg = err.message;
            }

            if (!rawResponse) {
                if (attempt < maxAttempts) {
                    console.warn(`[AI Batch Retry] 批次解析暫時中斷 (${lastErrorMsg})，等待 ${attempt * 2} 秒後進行第 ${attempt} 次重試...`);
                    await new Promise(r => setTimeout(r, attempt * 2000)); // 遞增冷卻時間 (2s, 4s, 6s...)
                }
            }
        }

        if (rawResponse) {
            const results = safeParseJSON(rawResponse);
            if (Array.isArray(results)) {
                results.forEach(resItem => {
                    if (!resItem || !resItem.word) return;

                    const target = targetList.find(p => {
                        if (!p || !p.word) return false;
                        const cleanP = normalizeWord(p.word);
                        const cleanRes = normalizeWord(resItem.word);
                        return cleanP === cleanRes || cleanRes.startsWith(cleanP) || cleanP.startsWith(cleanRes);
                    });

                    if (target) {
                        if ((forceOverwrite || isFieldIncomplete(target.pos, 'pos')) && resItem.pos) target.pos = resItem.pos;
                        if ((forceOverwrite || isFieldIncomplete(target.phonetic, 'phonetic')) && resItem.phonetic) target.phonetic = resItem.phonetic;
                        if ((forceOverwrite || isFieldIncomplete(target.meaning, 'meaning')) && resItem.meaning) target.meaning = resItem.meaning;
                        if ((forceOverwrite || isFieldIncomplete(target.sentence, 'sentence')) && resItem.sentence) target.sentence = resItem.sentence;
                        if ((forceOverwrite || isFieldIncomplete(target.translation, 'translation')) && resItem.translation) target.translation = resItem.translation;
                        target.updatedAt = Date.now();
                        successUpdatedCount++;
                    }
                });
            }
        } else {
            console.error(`[AI Batch Error] 該批次重試 ${maxAttempts} 次仍無法連線：`, chunkWords);
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

    if (successUpdatedCount === 0) {
        throw new Error("AI 未能成功解析任何單字，請稍後再試");
    }
}