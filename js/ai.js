/**
 * Gemini AI 對接與智慧單字清洗解析模組 (完整修復終極版)
 */

const GEMINI_MODEL = "gemini-3.5-flash-lite";

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

function buildGeminiUrl(apiKey) {
    if (!apiKey) return '';
    const cleanKey = apiKey.trim();
    const model = (typeof GEMINI_MODEL !== 'undefined' && GEMINI_MODEL) ? GEMINI_MODEL : 'gemini-1.5-flash';
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
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
    return str === '' || str === '尚未填寫釋義' || str === '-' || str === 'N/A' || str === 'EMPTY';
}

function sanitizeWordAndPos(rawWord, rawPos, rawMeaning) {
    let word = (rawWord || '').trim();
    let pos = (rawPos || '').trim();
    let meaning = (rawMeaning || '').trim();

    const posRegex = /[\(\[\{]?(n|v|vt|vi|adj|adv|prep|conj|pron|num|phr|art)\.[\)\]\}]?/i;

    if (word) {
        const match = word.match(posRegex);
        if (match) {
            if (!pos) pos = match[1].toLowerCase() + '.';
            word = word.replace(match[0], '').trim();
        }
    }

    if (meaning) {
        const match = meaning.match(posRegex);
        if (match) {
            if (!pos) pos = match[1].toLowerCase() + '.';
            meaning = meaning.replace(match[0], '').trim();
        }
    }

    return { word, pos, meaning };
}

async function autoFillWithAI(word) {
    const rawKey = getValidApiKey();
    if (!rawKey) {
        if (typeof showToast === 'function') showToast("尚未設定 API Key，請先設定！", "warning");
        if (typeof openModal === 'function') openModal('keyModal');
        return null;
    }

    const cleaned = sanitizeWordAndPos(word, '', '');
    const cleanWord = cleaned.word;

    const prompt = 'You are a dictionary assistant. Parse the English word "' + cleanWord + '". Return ONLY a pure JSON object with keys: "phonetic", "pos", "meaning", "sentence", "translation".';

    try {
        const apiUrl = buildGeminiUrl(rawKey);

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('flashcard_gemini_key_v1');
                updateApiKeyStatusUI();
                if (typeof showToast === 'function') showToast("⚠️ API Key 無效，已自動清除，請重新設定！", "error");
                if (typeof openModal === 'function') openModal('keyModal');
            } else if (res.status === 429) {
                if (typeof showToast === 'function') showToast("⚠️ 觸發免費 API 頻率限制，請稍後再試！", "warning");
            } else {
                if (typeof showToast === 'function') showToast(`⚠️ API 服務異常 (HTTP ${res.status})`, "error");
            }
            return null;
        }

        const data = await res.json();
        let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return safeParseJSON(rawText);

    } catch (err) {
        console.error(err);
        if (typeof showToast === 'function') showToast("⚠️ 網路請求失敗，請檢查網路狀態！", "error");
        return null;
    }
}

function parseBatchText(raw) {
    let parsedList = [];

    if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
        try {
            const parsedJson = JSON.parse(raw);
            const arr = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
            arr.forEach(item => {
                let w = '', p = '', m = '', phonetic = '', sentence = '', translation = '';
                if (typeof item === 'string') {
                    w = item.trim();
                } else if (typeof item === 'object') {
                    w = item.word || item.term || item.english || '';
                    p = item.pos || item.partOfSpeech || item.type || '';
                    phonetic = item.phonetic || item.pronunciation || '';
                    m = item.meaning || item.definition || item.zh || item.ch || item.chinese || item.ch_meaning || item.trans || item.translation || '';
                    sentence = item.sentence || item.example || '';
                    translation = item.translation || item.exampleZh || '';
                }

                const cleanObj = sanitizeWordAndPos(w, p, m);
                if (cleanObj.word) {
                    parsedList.push({
                        word: cleanObj.word,
                        pos: cleanObj.pos,
                        phonetic: phonetic,
                        meaning: cleanObj.meaning,
                        sentence: sentence,
                        translation: translation
                    });
                }
            });
        } catch(e) {}
    }

    if (parsedList.length === 0) {
        const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        lines.forEach(line => {
            let word = "", pos = "", phonetic = "", meaning = "";

            const phoneticMatch = line.match(/(\/[^\/]+\/|\[[^\]]+\])/);
            if (phoneticMatch) {
                phonetic = phoneticMatch[1];
                line = line.replace(phoneticMatch[1], ' ');
            }

            const posMatch = line.match(/\b(n|v|vt|vi|adj|adv|prep|conj|pron|num|phr|art)\./i);
            if (posMatch) {
                pos = posMatch[0];
                line = line.replace(posMatch[0], ' ');
            }

            if (line.includes(' - ')) {
                const parts = line.split(' - ');
                word = parts[0].trim();
                meaning = parts.slice(1).join(' - ').trim();
            } else if (line.includes(':')) {
                const parts = line.split(':');
                word = parts[0].trim();
                meaning = parts.slice(1).join(':').trim();
            } else if (line.includes('\t')) {
                const parts = line.split('\t');
                word = parts[0].trim();
                meaning = parts.slice(1).join(' ').trim();
            } else {
                const zhMatch = line.match(/[\u4e00-\u9fa5].*$/);
                if (zhMatch) {
                    meaning = zhMatch[0].trim();
                    word = line.substring(0, zhMatch.index).trim();
                } else {
                    word = line.trim();
                }
            }

            word = word.replace(/^[0-9]+\.\s*/, '').trim();

            const cleanObj = sanitizeWordAndPos(word, pos, meaning);
            if (cleanObj.word) {
                parsedList.push({
                    word: cleanObj.word,
                    pos: cleanObj.pos,
                    phonetic: phonetic,
                    meaning: cleanObj.meaning,
                    sentence: '',
                    translation: ''
                });
            }
        });
    }

    const uniqueList = [];
    const seenWords = new Set();
    parsedList.forEach(item => {
        const lowerKey = item.word.toLowerCase().trim();
        if (!seenWords.has(lowerKey)) {
            seenWords.add(lowerKey);
            uniqueList.push(item);
        }
    });

    return uniqueList;
}

async function runBatchAiAutoFill(targetList, progressCallback) {
    const rawKey = getValidApiKey();
    if (!rawKey) {
        if (typeof showToast === 'function') showToast("尚未設定 Gemini API Key！請先設定 Key。", "warning");
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
    if (total === 0) {
        if (typeof showToast === 'function') showToast("所選單字皆已具備完整資料，無需補齊！", "info");
        return;
    }

    const batchSize = 5;
    let completedCount = 0;

    for (let i = 0; i < total; i += batchSize) {
        const chunk = incompleteItems.slice(i, i + batchSize);
        const chunkWords = chunk.map(item => item.word);

        const prompt = 'Return a JSON array of objects for these words: ' + JSON.stringify(chunkWords) + '. Format each: {"word":"...","pos":"...","phonetic":"...","meaning":"Traditional Chinese definition","sentence":"Short English sentence","translation":"Traditional Chinese sentence translation"}. Output ONLY pure JSON.';

        try {
            const apiUrl = buildGeminiUrl(rawKey);

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    localStorage.removeItem('flashcard_gemini_key_v1');
                    if (typeof updateApiKeyStatusUI === 'function') updateApiKeyStatusUI();
                    if (typeof showToast === 'function') showToast("⚠️ API Key 無效，已自動清除！", "error");
                    if (typeof openModal === 'function') openModal('keyModal');
                } else if (res.status === 429) {
                    if (typeof showToast === 'function') showToast("⚠️ 觸發 API 頻率限制 (15次/分)，請稍等 1 分鐘！", "warning");
                }
                break;
            }

            const data = await res.json();
            let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            const results = safeParseJSON(rawText);
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
        } catch(e) {
            console.warn("[Batch AI Exception Handled]:", e);
        }

        completedCount += chunk.length;
        if (progressCallback) {
            progressCallback(completedCount, total);
        }

        if (i + batchSize < total) {
            await new Promise(resolve => setTimeout(resolve, 4500));
        }
    }
}