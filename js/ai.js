/**
 * LZHCard - Gemini AI 萬能多語系解析模組 (Gemini 3.x 現役版)
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

function isFieldIncomplete(val) {
    if (!val) return true;
    const str = String(val).trim();
    return str === '' || str === '尚未填寫釋義' || str === 'AI 自動解析中...' || str === '-' || str === 'N/A' || str === 'EMPTY';
}

function getLanguageConfig() {
    const targetLang = localStorage.getItem('lzhcard_target_lang') || 'en';
    const nativeLang = localStorage.getItem('lzhcard_native_lang') || 'zh-TW';
    const customTarget = localStorage.getItem('lzhcard_custom_target') || 'Custom Target Language';
    const customNative = localStorage.getItem('lzhcard_custom_native') || 'Custom Native Language';

    const langNameMap = {
        'en': 'English',
        'ja': 'Japanese (日本語)',
        'zh-TW': 'Traditional Chinese (繁體中文, 臺灣標準)',
        'custom': ''
    };

    const targetName = targetLang === 'custom' ? customTarget : (langNameMap[targetLang] || 'English');
    const nativeName = nativeLang === 'custom' ? customNative : (langNameMap[nativeLang] || 'Traditional Chinese (繁體中文)');

    return { targetLang, nativeLang, targetName, nativeName };
}

function sanitizeWordAndPos(rawWord, rawPos, rawMeaning) {
    let word = (rawWord || '').trim();
    let pos = (rawPos || '').trim();
    let meaning = (rawMeaning || '').trim();

    const multiPosRegex = /[\(\[\{]?((?:n|v|vt|vi|adj|adv|prep|conj|pron|num|phr|art|名詞|動詞|他動詞|自動詞|形容詞|副詞|助詞)[\.\s\/]*)+[\)\]\}]?/gi;

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
        if (typeof showToast === 'function') showToast(t('toastNoApiKey'), "warning");
        if (typeof openModal === 'function') openModal('keyModal');
        return null;
    }

    const cleaned = sanitizeWordAndPos(word, '', '');
    const cleanWord = cleaned.word;
    const { targetName, nativeName } = getLanguageConfig();

    const prompt = `You are a professional lexicographer. 
Analyze term: "${cleanWord}"
Target Language: ${targetName}
Native Language: ${nativeName}

Return ONLY raw JSON with:
1. "phonetic": Pronunciation guide
2. "pos": Parts of speech in ${nativeName}
3. "meaning": Definition in ${nativeName}
4. "sentence": Example sentence in ${targetName}
5. "translation": Sentence translation in ${nativeName}`;

    const rawResponse = await callGeminiApi(rawKey, prompt);
    return safeParseJSON(rawResponse);
}

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

        const prompt = `Analyze terms: ${JSON.stringify(chunkWords)}.
Target Language: ${targetName}
Native Language: ${nativeName}

Return pure JSON array:
[
  {
    "word": "original term",
    "pos": "pos in ${nativeName}",
    "phonetic": "Pronunciation",
    "meaning": "Definition in ${nativeName}",
    "sentence": "Example sentence",
    "translation": "Translation in ${nativeName}"
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