/**
 * LZHCard - Gemini AI 萬能多語系解析模組 (AI Core Engine)
 */

window.cachedWorkingModel = null;

const GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b"
];

// 🛡️ 安全翻譯輔助函式：防止 t() 未定義時造成 JS 執行階段崩潰
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

async function callGeminiApi(apiKey, promptText) {
    const cleanKey = apiKey.trim();

    if (window.cachedWorkingModel) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${window.cachedWorkingModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
            });

            if (res.ok) {
                const data = await res.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }
            if (res.status === 404) {
                window.cachedWorkingModel = null;
            }
        } catch (e) {
            console.error(`[AI Engine Exception]:`, e);
            window.cachedWorkingModel = null;
        }
    }

    for (const model of GEMINI_MODELS) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
        try {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
            });

            if (res.ok) {
                const data = await res.json();
                window.cachedWorkingModel = model;
                console.log(`[AI Engine] 成功連線模型：${model}`);
                return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }

            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('flashcard_gemini_key_v1');
                updateApiKeyStatusUI();
                if (typeof showToast === 'function') showToast(safeT('toastInvalidApiKey', null, 'Gemini API Key 無效，請重新設定'), "error");
                if (typeof openModal === 'function') openModal('keyModal');
                return null;
            } else if (res.status === 429) {
                if (typeof showToast === 'function') showToast(safeT('toastRateLimit', null, 'API 請求過於頻繁，請稍後再試'), "warning");
                return null;
            }
        } catch (e) {
            console.error(`[AI Engine] 嘗試模型 ${model} 失敗:`, e);
        }
    }

    if (typeof showToast === 'function') showToast(safeT('toastApiConnError', null, '無法連線至 AI 伺服器'), "error");
    return null;
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

function isFieldIncomplete(val) {
    if (!val) return true;
    const str = String(val).trim();
    if (str === '' || str === '-' || str === 'N/A' || str === 'EMPTY') return true;

    const pendingKeywords = [
        '解析中', 'parsing', '尚未填寫', '未入力', '待補齊', 
        'no definition', 'pending', '自動解析'
    ];

    return pendingKeywords.some(keyword => str.toLowerCase().includes(keyword.toLowerCase()));
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
    const rawKey = getValidApiKey();
    if (!rawKey) {
        if (typeof showToast === 'function') showToast(safeT('toastNoApiKey', null, '請設定 Gemini API Key'), "warning");
        if (typeof openModal === 'function') openModal('keyModal');
        return null;
    }

    const cleaned = sanitizeWordAndPos(word, '', '');
    const cleanWord = cleaned.word;
    const { targetName, nativeName } = getLanguageConfig();

    const prompt = `You are a professional lexicographer.
Input Term: "${cleanWord}"
Target Language: ${targetName}
User Native Language: ${nativeName}

LANGUAGE INSTRUCTIONS:
1. "word": The clean term in Target Language (${targetName}).
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

    const rawResponse = await callGeminiApi(rawKey, prompt);
    return safeParseJSON(rawResponse);
}

/**
 * 🤖 批次 AI 欄位補充與錯植語言修復核心邏輯
 */
async function runBatchAiAutoFill(targetList, progressCallback, forceOverwrite = false) {
    const rawKey = getValidApiKey();
    if (!rawKey) {
        if (typeof showToast === 'function') showToast(safeT('toastNoApiKey', null, '請設定 Gemini API Key'), "warning");
        if (typeof openModal === 'function') openModal('keyModal');
        return;
    }

    const targetItems = forceOverwrite ? targetList : targetList.filter(item => 
        isFieldIncomplete(item.meaning) || 
        isFieldIncomplete(item.pos) || 
        isFieldIncomplete(item.sentence) || 
        isFieldIncomplete(item.translation) ||
        isFieldIncomplete(item.phonetic)
    );

    const total = targetItems.length;
    if (total === 0) return;

    const { targetName, nativeName } = getLanguageConfig();
    const batchSize = 10;
    let completedCount = 0;

    for (let i = 0; i < total; i += batchSize) {
        const chunk = targetItems.slice(i, i + batchSize);
        const chunkWords = chunk.map(item => item.word);

        const prompt = `Lexicographer assistant.
Input Terms: ${JSON.stringify(chunkWords)}
Target Language: ${targetName}
User Native Language: ${nativeName}

LANGUAGE INSTRUCTIONS:
- Example "sentence" MUST be written strictly in Target Language (${targetName}).
- "pos", "meaning", and "translation" MUST be written strictly in User Native Language (${nativeName}).

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

        const rawResponse = await callGeminiApi(rawKey, prompt);
        if (rawResponse) {
            const results = safeParseJSON(rawResponse);
            if (Array.isArray(results)) {
                results.forEach(resItem => {
                    if (!resItem || !resItem.word) return;
                    const target = targetList.find(p => p.word.trim().toLowerCase() === resItem.word.trim().toLowerCase());
                    if (target) {
                        if ((forceOverwrite || isFieldIncomplete(target.pos)) && resItem.pos) target.pos = resItem.pos;
                        if ((forceOverwrite || isFieldIncomplete(target.phonetic)) && resItem.phonetic) target.phonetic = resItem.phonetic;
                        if ((forceOverwrite || isFieldIncomplete(target.meaning)) && resItem.meaning) target.meaning = resItem.meaning;
                        if ((forceOverwrite || isFieldIncomplete(target.sentence)) && resItem.sentence) target.sentence = resItem.sentence;
                        if ((forceOverwrite || isFieldIncomplete(target.translation)) && resItem.translation) target.translation = resItem.translation;
                        target.updatedAt = Date.now();
                    }
                });
            }
        }

        completedCount += chunk.length;
        if (progressCallback) {
            progressCallback(completedCount, total);
        }

        if (i + batchSize < total) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
}