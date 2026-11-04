/**
 * Gemini AI 對接與智慧單字清洗解析模組
 */

const GEMINI_MODEL = "gemini-3.5-flash-lite";

/**
 * 建立並驗證絕對 API 網址
 */
function buildGeminiUrl(apiKey) {
    const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent";
    const url = new URL(baseUrl);
    url.searchParams.append("key", apiKey.trim());
    return url.toString();
}

/**
 * 【核心新增】萬能詞性標記提煉與單字淨化器
 * 自動將 "apple (n.)" / "resilient adj." / "(v.) abandon" 拆解為乾淨的單字與獨立詞性
 */
function sanitizeWordAndPos(rawWord, rawPos, rawMeaning) {
    let word = (rawWord || '').trim();
    let pos = (rawPos || '').trim();
    let meaning = (rawMeaning || '').trim();

    // 匹配常見英文詞性標記，例如 (n.), [adj.], v., vt., vi., adv., prep., conj., pron., num., phr., art.
    const posRegex = /[\(\[\{]?(n|v|vt|vi|adj|adv|prep|conj|pron|num|phr|art)\.[\)\]\}]?/i;

    // 1. 若單字欄包含了詞性標記 (例如 "apple (n.)" 或 "apple n.")
    if (word) {
        const match = word.match(posRegex);
        if (match) {
            if (!pos) pos = match[1].toLowerCase() + '.';
            word = word.replace(match[0], '').trim(); // 移除單字中的詞性
        }
    }

    // 2. 若中文釋義開頭包含了詞性標記 (例如 "(n.) 蘋果")
    if (meaning) {
        const match = meaning.match(posRegex);
        if (match) {
            if (!pos) pos = match[1].toLowerCase() + '.';
            meaning = meaning.replace(match[0], '').trim(); // 淨化中文釋義
        }
    }

    return { word, pos, meaning };
}

/**
 * 單字 AI 自動帶入 (Single Word Auto-fill)
 */
async function autoFillWithAI(word) {
    const rawKey = localStorage.getItem('flashcard_gemini_key_v1');
    if (!rawKey || !rawKey.trim()) {
        alert("尚未設定 Gemini API Key！請先點擊右上角 🔑 Key 設定彈窗填入金鑰。");
        if (typeof openModal === 'function') openModal('keyModal');
        return null;
    }

    // 帶入前先清洗單字字串
    const cleaned = sanitizeWordAndPos(word, '', '');
    const cleanWord = cleaned.word;

    const prompt = 'You are a dictionary assistant. Parse the English word "' + cleanWord + '". Return ONLY a pure JSON object without markdown tags with keys: "phonetic" (IPA/KK format), "pos" (part of speech like n., v., adj.), "meaning" (Traditional Chinese definition), "sentence" (a short example sentence), "translation" (Traditional Chinese translation of sentence).';

    try {
        const apiUrl = buildGeminiUrl(rawKey);

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            const errMsg = (errorData.error && errorData.error.message) ? errorData.error.message : ("HTTP " + res.status);
            console.error("Gemini API Error:", res.status, errorData);

            if (res.status === 401 || res.status === 403) {
                alert("⚠️ API Key 無效或授權失敗，請檢查 Key 設定！\n" + errMsg);
                if (typeof openModal === 'function') openModal('keyModal');
            } else if (res.status === 404) {
                alert("⚠️ 找不到指定模型，請確認 API 版本設定！\n詳細訊息: " + errMsg);
            } else if (res.status === 429) {
                alert("⚠️ 觸發免費 API 頻率限制，請稍後再試！");
            } else {
                alert("⚠️ 服務暫時無法回應 (HTTP " + res.status + ")：" + errMsg);
            }
            return null;
        }

        const data = await res.json();
        let rawText = data.candidates[0].content.parts[0].text.trim();
        rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
        return JSON.parse(rawText);

    } catch (err) {
        console.error(err);
        alert("⚠️ 網址建立或網路連線失敗，請確認 API Key 格式。");
        return null;
    }
}

/**
 * 貼上文字/GitHub 開源文字庫多格式智慧解析引擎
 */
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
                    m = item.meaning || item.definition || item.chinese || item.zh || '';
                    sentence = item.sentence || item.example || '';
                    translation = item.translation || item.exampleZh || '';
                }

                // 進行清洗與詞性提取
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
            if (parsedList.length > 0) return parsedList;
        } catch(e) {}
    }

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

        // 進行二次淨化提煉
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

    return parsedList;
}

/**
 * 批量單字 AI 自動補齊 (Batch AI Fill)
 */
async function runBatchAiAutoFill(parsedList, progressCallback) {
    const rawKey = localStorage.getItem('flashcard_gemini_key_v1');
    if (!rawKey || !rawKey.trim()) {
        alert("尚未設定 Gemini API Key！請先設定 Key。");
        if (typeof openModal === 'function') openModal('keyModal');
        return;
    }

    const incompleteIndices = parsedList
        .map((item, idx) => (!item.meaning || !item.pos || !item.sentence ? idx : null))
        .filter(idx => idx !== null);

    if (incompleteIndices.length === 0) {
        alert("所有單字皆已具備完整資料，無需補齊！");
        return;
    }

    const batchSize = 5;
    for (let i = 0; i < incompleteIndices.length; i += batchSize) {
        const chunkIndices = incompleteIndices.slice(i, i + batchSize);
        const chunkWords = chunkIndices.map(idx => parsedList[idx].word);

        if (progressCallback) {
            progressCallback(Math.min(i + batchSize, incompleteIndices.length), incompleteIndices.length);
        }

        const prompt = 'Return a JSON array of objects for these words: ' + JSON.stringify(chunkWords) + '. Format for each: {"word":"...","pos":"...","phonetic":"...","meaning":"Traditional Chinese definition","sentence":"English sentence","translation":"Traditional Chinese sentence translation"}. Output ONLY pure JSON.';

        try {
            const apiUrl = buildGeminiUrl(rawKey);

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const errMsg = (errorData.error && errorData.error.message) ? errorData.error.message : ("HTTP " + res.status);
                console.error("Gemini API Error:", res.status, errorData);

                if (res.status === 429) {
                    alert("⚠️ 觸發免費 API 頻率限制 (15 次/分鐘)，暫停補齊，請稍等 1 分鐘後再試！");
                } else {
                    alert("API 回應異常 (HTTP " + res.status + ")：" + errMsg);
                }
                break;
            }

            const data = await res.json();
            let rawText = data.candidates[0].content.parts[0].text.trim();
            rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

            const results = JSON.parse(rawText);
            if (Array.isArray(results)) {
                results.forEach(resItem => {
                    const foundIdx = parsedList.findIndex(p => p.word.toLowerCase() === resItem.word.toLowerCase());
                    if (foundIdx !== -1) {
                        if (!parsedList[foundIdx].pos && resItem.pos) parsedList[foundIdx].pos = resItem.pos;
                        if (!parsedList[foundIdx].phonetic && resItem.phonetic) parsedList[foundIdx].phonetic = resItem.phonetic;
                        if (!parsedList[foundIdx].meaning && resItem.meaning) parsedList[foundIdx].meaning = resItem.meaning;
                        if (!parsedList[foundIdx].sentence && resItem.sentence) parsedList[foundIdx].sentence = resItem.sentence;
                        if (!parsedList[foundIdx].translation && resItem.translation) parsedList[foundIdx].translation = resItem.translation;
                    }
                });
            }
        } catch(e) {
            console.error("Batch AI Error:", e);
        }

        if (i + batchSize < incompleteIndices.length) {
            await new Promise(resolve => setTimeout(resolve, 4500));
        }
    }
}