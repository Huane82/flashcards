/**
 * LZHCard - Gemini AI 萬能多語系解析模組 (全語言自動識別與解析版)
 */

window.cachedWorkingModel = null;

const GEMINI_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite"
];

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
                if (typeof showToast === 'function') showToast(t('toastInvalidApiKey'), "error");
                if (typeof openModal === 'function') openModal('keyModal');
                return null;
            } else if (res.status === 429) {
                if (typeof showToast === 'function') showToast(t('toastRateLimit'), "warning");
                return null;
            }
        } catch (e) {
            console.error(`[AI Engine] 嘗試模型 ${model} 失敗:`, e);
        }
    }

    if (typeof showToast === 'function') showToast(t('toastApiConnError'), "error");
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

/**
 * 🔍 判斷單字欄位是否需要 AI 自動補充（模糊比對版）
 */
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

/**
 * 🌐 取得語言設定（當選擇自訂且留空時，啟動自動辨識機制）
 */
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
        ? (customTarget || 'Auto-Detect Language (自動識別單字語種)') 
        : (langNameMap[targetLang] || 'English');

    const nativeName = nativeLang === 'custom' 
        ? (customNative || 'Auto-Detect Native Language (自動識別母語)') 
        : (langNameMap[nativeLang] || 'Traditional Chinese (繁體中文)');

    return { targetLang, nativeLang, targetName, nativeName };
}

function sanitizeWordAndPos(rawWord, rawPos, rawMeaning) {
    let word = (rawWord || '').trim();
    let pos = (rawPos || '').trim();
    let meaning = (rawMeaning || '').trim();

    // 嚴謹詞性匹配：英文字母詞性需帶句點或括號，避免將獨立羅馬拼音 "n", "v" 誤判為詞性
    const multiPosRegex = /(?:[\(\[\{]\s*(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|phr|art|名詞|代名詞|動詞|他動詞|自動詞|形容詞|形容動詞|副詞|助詞|感動詞)[\.\s\/]*[\)\]\}])|(?:(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|phr|art)\.)/gi;

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

/**
 * 🤖 AI 單一單字自動填寫 (支援自訂語言自動識別語種)
 */
async function autoFillWithAI(word) {
    const rawKey = getValidApiKey();
    if (!rawKey) {
        if (typeof showToast === 'function') showToast(t('toastNoApiKey'), "warning");
        if (typeof openModal === 'function') openModal('keyModal');
        return null;
    }

    const cleaned = sanitizeWordAndPos(word, '', '');
    const cleanWord = cleaned.word;
    const { targetName, nativeName } = getLanguageConfig();

    const prompt = `You are an expert multilingual lexicographer.
Input term: "${cleanWord}"
Target Language instruction: ${targetName}
User Native Language instruction: ${nativeName}

CRITICAL AUTO-DETECTION RULES:
1. If Target Language or User Native Language is set to "Auto-Detect" or Custom, AUTOMATICALLY IDENTIFY the source language of "${cleanWord}" (e.g. French, German, Spanish, Japanese, Korean, Italian, Russian, English, Chinese, etc.).
2. Generate phonetics/pronunciation appropriate for the identified target language.
3. Translate definitions ("meaning") and sentence translations ("translation") into the User Native Language (${nativeName}).

Return ONLY a valid raw JSON object with:
{
  "word": "Clean term formatted in its original language",
  "phonetic": "Pronunciation (IPA / Kana / Pinyin / Romaji)",
  "pos": "Parts of speech expressed in User Native Language (${nativeName})",
  "meaning": "Definition expressed in User Native Language (${nativeName})",
  "sentence": "Natural example sentence in the identified target language",
  "translation": "Sentence translation expressed in User Native Language (${nativeName})"
}`;

    const rawResponse = await callGeminiApi(rawKey, prompt);
    return safeParseJSON(rawResponse);
}

/**
 * 🤖 批次 AI 欄位補充 (支援自訂語言自動識別語種)
 */
async function runBatchAiAutoFill(targetList, progressCallback) {
    const rawKey = getValidApiKey();
    if (!rawKey) {
        if (typeof showToast === 'function') showToast(t('toastNoApiKey'), "warning");
        if (typeof openModal === 'function') openModal('keyModal');
        return;
    }

    const incompleteItems = targetList.filter(item => 
        isFieldIncomplete(item.meaning) || 
        isFieldIncomplete(item.pos) || 
        isFieldIncomplete(item.sentence) || 
        isFieldIncomplete(item.translation) ||
        isFieldIncomplete(item.phonetic)
    );

    const total = incompleteItems.length;
    if (total === 0) return;

    const { targetName, nativeName } = getLanguageConfig();
    const batchSize = 5;
    let completedCount = 0;

    for (let i = 0; i < total; i += batchSize) {
        const chunk = incompleteItems.slice(i, i + batchSize);
        const chunkWords = chunk.map(item => item.word);

        const prompt = `You are an expert multilingual lexicographer.
Analyze input terms: ${JSON.stringify(chunkWords)}.
Target Language instruction: ${targetName}
User Native Language instruction: ${nativeName}

CRITICAL AUTO-DETECTION RULES:
- If Target Language or User Native Language is Auto-Detect or Custom, AUTOMATICALLY IDENTIFY the source language of each term.
- Generate phonetics, POS, definitions, and sentence translations in User Native Language (${nativeName}).

Return ONLY a pure JSON array matching the input order:
[
  {
    "word": "original input term cleaned",
    "pos": "parts of speech expressed in ${nativeName}",
    "phonetic": "Pronunciation (IPA / Kana / Romaji / Pinyin)",
    "meaning": "Definition in User Native Language (${nativeName})",
    "sentence": "Example sentence in target language",
    "translation": "Example sentence translation in User Native Language (${nativeName})"
  }
]`;

        const rawResponse = await callGeminiApi(rawKey, prompt);
        if (rawResponse) {
            const results = safeParseJSON(rawResponse);
            if (Array.isArray(results)) {
                results.forEach(resItem => {
                    if (!resItem || !resItem.word) return;
                    const target = targetList.find(p => p.word.toLowerCase() === resItem.word.toLowerCase());
                    if (target) {
                        if (isFieldIncomplete(target.pos) && resItem.pos) target.pos = resItem.pos;
                        if (isFieldIncomplete(target.phonetic) && resItem.phonetic) target.phonetic = resItem.phonetic;
                        if (isFieldIncomplete(target.meaning) && resItem.meaning) target.meaning = resItem.meaning;
                        if (isFieldIncomplete(target.sentence) && resItem.sentence) target.sentence = resItem.sentence;
                        if (isFieldIncomplete(target.translation) && resItem.translation) target.translation = resItem.translation;
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
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}