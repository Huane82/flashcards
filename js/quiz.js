/**
 * LZHCard - 隨堂測驗模組 (FSRS 排程雙向連動版)
 */

let currentQuizWord = null;
let currentQuizMode = 1;
let currentQuizLang = 'en'; // 預設英文測驗
let quizScoreCorrect = 0;
let quizScoreTotal = 0;
let lastQuizWordKey = null;
let isQuizAnswerLocked = false;

/**
 * 🌐 切換測驗語言 (英文 / 中文 / 日文)
 */
function setQuizLanguage(lang) {
    currentQuizLang = lang;

    ['en', 'zh', 'ja'].forEach(l => {
        const btn = document.getElementById(`qlang-${l}`);
        if (btn) {
            if (l === lang) {
                btn.className = "flex-1 py-1.5 text-xs font-bold rounded-lg transition bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-2xs";
            } else {
                btn.className = "flex-1 py-1.5 text-xs font-bold rounded-lg transition text-slate-500 dark:text-slate-400 hover:text-slate-800";
            }
        }
    });

    nextQuizQuestion();
}

/**
 * 🎯 切換測驗模式 (模式 1、2、3)
 */
function setQuizMode(mode) {
    currentQuizMode = mode;
    
    [1, 2, 3].forEach(m => {
        const btn = document.getElementById(`qmode-${m}`);
        if (btn) {
            if (m === mode) {
                btn.className = "py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 bg-brand-600 text-white shadow-xs";
            } else {
                btn.className = "py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600";
            }
        }
    });

    nextQuizQuestion();
}

/**
 * 🎯 針對具備例句的候選池執行 FSRS 三層優先級抽題
 */
function pickNextQuizCandidate(candidates) {
    if (!candidates || candidates.length === 0) return null;

    // 依單字小寫去重，避免多字庫勾選時重複單字機率加倍
    const uniqueMap = new Map();
    candidates.forEach(w => {
        if (!w || !w.word) return;
        const key = w.word.trim().toLowerCase();
        if (!uniqueMap.has(key)) {
            if (typeof migrateCardFSRS === 'function') migrateCardFSRS(w);
            uniqueMap.set(key, w);
        }
    });

    const pool = Array.from(uniqueMap.values());
    if (pool.length === 1) return pool[0];

    // 排除上一題剛考過的單字
    const nonRepeatPool = lastQuizWordKey
        ? pool.filter(w => w.word.trim().toLowerCase() !== lastQuizWordKey)
        : pool;
    const activePool = nonRepeatPool.length > 0 ? nonRepeatPool : pool;

    // 若尚未載入 FSRS 引擎則退回隨機抽題
    if (typeof calculateRetrievability !== 'function' || typeof weightedRandomPick !== 'function') {
        return activePool[Math.floor(Math.random() * activePool.length)];
    }

    const now = Date.now();

    // 🥇 Tier 1：已到期複習字與重學字（包含測驗答錯或字卡按不熟悉的單字）
    const dueCards = activePool.filter(w => w.state !== 'new' && (w.nextReview || 0) <= now);
    if (dueCards.length > 0) {
        const weighted = dueCards.map(word => {
            const r = calculateRetrievability(word, now);
            const isRelearning = word.state === 'relearning' || word.state === 'learning';
            const lapsesBoost = 1 + (word.lapses || 0) * 0.45;
            const urgency = Math.pow(Math.max(0.05, 1.15 - r), 2) * 100;
            return {
                word,
                weight: Math.max((isRelearning ? 140 : urgency) * lapsesBoost, 0.1)
            };
        });
        return weightedRandomPick(weighted);
    }

    // 🥈 Tier 2：正在學習中的單字 ＋ 定量新字焦點組（最多 6 個新字）
    const learningCards = activePool.filter(w => w.state === 'learning' || w.state === 'relearning');
    const newCards = activePool.filter(w => w.state === 'new').slice(0, 6);
    const tier2Pool = [...learningCards, ...newCards];

    if (tier2Pool.length > 0) {
        const weighted = tier2Pool.map(word => ({
            word,
            weight: word.state === 'new' ? 100 : 120
        }));
        return weightedRandomPick(weighted);
    }

    // 🥉 Tier 3：自由加練模式（依記憶脆弱度與歷史易忘次數加權）
    const weighted = activePool.map(word => {
        const r = calculateRetrievability(word, now);
        const s = Math.max(0.5, word.stability || 1);
        const lapsesBoost = 1 + (word.lapses || 0) * 0.5;
        const difficultyBoost = 0.6 + (word.difficulty || 5) / 10;
        const vulnerability = ((1.05 - r) * 80 + (15 / s)) * lapsesBoost * difficultyBoost;
        return { word, weight: Math.max(vulnerability, 0.5) };
    });

    return weightedRandomPick(weighted);
}

/**
 * 🎲 產生下一題隨堂測驗題目
 */
function nextQuizQuestion() {
    isQuizAnswerLocked = false;

    const inputElem = document.getElementById('quizInput');
    const feedbackElem = document.getElementById('quizFeedback');
    const submitBtn = document.getElementById('quizSubmitBtn');
    const promptBox = document.getElementById('quizPromptBox');
    const badgeElem = document.getElementById('quizBadge');
    const promptTitleElem = document.getElementById('quizPromptTitle');

    if (inputElem) {
        inputElem.value = '';
        inputElem.focus();
    }
    if (feedbackElem) {
        feedbackElem.classList.add('hidden');
        feedbackElem.innerHTML = '';
    }

    if (currentQuizLang !== 'en') {
        if (inputElem) inputElem.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
        if (badgeElem) badgeElem.innerText = (typeof t === 'function') ? t('quizDevTitle') : '🚧 功能開發中';

        if (promptBox) {
            const langName = currentQuizLang === 'zh' ? '中文' : '日文';
            promptBox.innerHTML = `
                <div class="text-center py-8 space-y-3">
                    <div class="w-12 h-12 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto text-xl font-bold">
                        <i class="fa-solid fa-code"></i>
                    </div>
                    <h3 class="text-base font-bold text-slate-800 dark:text-slate-100" data-i18n="quizDevTitle">
                        ${(typeof t === 'function') ? t('quizDevTitle') : '🚧 功能開發中'}
                    </h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed" data-i18n="quizDevDesc">
                        ${(typeof t === 'function') ? t('quizDevDesc') : `${langName}隨堂測驗模式正在全力開發中，敬請期待！`}
                    </p>
                </div>
            `;
        }
        return;
    }

    if (inputElem) inputElem.disabled = false;
    if (submitBtn) submitBtn.disabled = false;

    const activeCats = window.selectedCategories || ['ALL'];
    const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : '預設字庫';

    const validQuizCandidates = (typeof wordList !== 'undefined' ? wordList : []).filter(w => {
        const matchCat = activeCats.includes("ALL") || activeCats.includes(w.category || defaultCatName);
        const hasSentence = w.sentence && w.sentence.trim() !== '';
        return matchCat && hasSentence;
    });

    if (validQuizCandidates.length === 0) {
        currentQuizWord = null;
        if (promptBox) {
            promptBox.innerHTML = `
                <div class="text-center py-4 space-y-2">
                    <p class="text-amber-600 dark:text-amber-400 font-bold text-base">${typeof t === 'function' ? t('quizNoSentenceWarning') : '⚠️ 當前選取的字庫中尚無具備英文例句的單字！'}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400 font-normal">
                        ${typeof t === 'function' ? t('quizNoSentenceDesc') : '隨堂測驗已開啟過濾保護（僅考有英文例句的單字）。<br>沒有例句的單字可先至「<span class="font-bold text-brand-600 dark:text-brand-400">卡片輪播</span>」背誦，或點擊「批量貼上」使用 AI 補齊例句。'}
                    </p>
                </div>
            `;
        }
        if (badgeElem) badgeElem.innerText = typeof t === 'function' ? t('quizBadgeWaiting') : '等待例句補齊';
        return;
    }

    currentQuizWord = pickNextQuizCandidate(validQuizCandidates);
    lastQuizWordKey = currentQuizWord.word.trim().toLowerCase();

    const word = currentQuizWord.word.trim();
    const sentence = currentQuizWord.sentence.trim();
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');

    if (currentQuizMode === 1) {
        if (badgeElem) badgeElem.innerText = typeof t === 'function' ? t('quizBadgeMode1') : '模式 1：純英文上下文聯想';
        if (promptTitleElem) promptTitleElem.innerText = typeof t === 'function' ? t('quizTitleMode1') : '英文上下文提示 (填出挖空單字)：';

        let hintWord = '';
        if (word.length <= 2) {
            hintWord = word[0] + '_'.repeat(Math.max(0, word.length - 1));
        } else {
            hintWord = word[0] + '_'.repeat(word.length - 2) + word[word.length - 1];
        }

        let maskedSentence = sentence.replace(regex, `<span class="text-brand-500 dark:text-sky-400 font-extrabold border-b-2 border-brand-500 dark:border-sky-400 px-1 py-0.5">${hintWord}</span>`);
        
        if (maskedSentence === sentence) {
            maskedSentence = `${sentence} <br><span class="text-xs text-slate-400 dark:text-slate-500 font-mono font-normal mt-2 block">${typeof t === 'function' ? t('quizHintMask', { word: hintWord }) : `[提示遮罩: ${hintWord}]`}</span>`;
        }

        promptBox.innerHTML = `<p class="font-serif italic text-xl leading-relaxed text-slate-800 dark:text-slate-100">${maskedSentence}</p>`;

    } else if (currentQuizMode === 2) {
        if (badgeElem) badgeElem.innerText = typeof t === 'function' ? t('quizBadgeMode2') : '模式 2：詞性與繁中釋義對照';
        if (promptTitleElem) promptTitleElem.innerText = typeof t === 'function' ? t('quizTitleMode2') : '中文釋義與詞性提示：';

        const posStr = currentQuizWord.pos ? `<span class="px-2 py-0.5 rounded bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 text-xs font-bold mr-2">[${currentQuizWord.pos}]</span>` : '';
        promptBox.innerHTML = `
            <div class="flex items-center">
                ${posStr}
                <span class="text-2xl font-bold text-slate-800 dark:text-slate-100">${currentQuizWord.meaning || (typeof t === 'function' ? t('quizNoMeaningFilled') : '（未填寫釋義）')}</span>
            </div>
        `;

    } else if (currentQuizMode === 3) {
        if (badgeElem) badgeElem.innerText = typeof t === 'function' ? t('quizBadgeMode3') : '模式 3：🎯 句意對照挖空';
        if (promptTitleElem) promptTitleElem.innerText = typeof t === 'function' ? t('quizTitleMode3') : '中英文句意對照：';

        const blankedSentence = sentence.replace(regex, '<span class="text-brand-500 dark:text-sky-400 font-bold border-b-2 border-brand-500 dark:border-sky-400 px-2">____</span>');
        const translation = currentQuizWord.translation || currentQuizWord.meaning || (typeof t === 'function' ? t('quizNoTranslation') : '（無翻譯對照）');

        promptBox.innerHTML = `
            <div class="space-y-2">
                <p class="font-serif italic text-lg text-slate-800 dark:text-slate-100">${blankedSentence}</p>
                <p class="text-sm font-semibold text-emerald-600 dark:text-emerald-400 border-t border-slate-200 dark:border-slate-700 pt-2">${typeof t === 'function' ? t('quizTranslationPrefix') : '中文對照: '}${translation}</p>
            </div>
        `;
    }
}

/**
 * 🕒 格式化距離下次複習的時間描述
 */
function formatNextReviewLabel(nextReviewTs) {
    if (!nextReviewTs || nextReviewTs <= Date.now()) return '10 分鐘後';
    const diffMin = Math.round((nextReviewTs - Date.now()) / 60000);
    if (diffMin < 60) return `${Math.max(1, diffMin)} 分鐘後`;
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours} 小時後`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} 天後`;
}

/**
 * 📝 提交答案與對錯判定（同步寫入 FSRS 記憶排程）
 */
function handleQuizSubmit(e) {
    if (e) e.preventDefault();
    if (!currentQuizWord || currentQuizLang !== 'en' || isQuizAnswerLocked) return;

    isQuizAnswerLocked = true;

    const inputElem = document.getElementById('quizInput');
    const feedbackElem = document.getElementById('quizFeedback');
    const userAns = inputElem ? inputElem.value.trim().toLowerCase() : '';
    const targetAns = currentQuizWord.word.trim().toLowerCase();

    quizScoreTotal += 1;
    const isCorrect = userAns === targetAns;

    // 🧠 寫入 FSRS 記憶排程（答對 = rating 3 記憶鞏固；答錯 = rating 1 重學急救）
    if (typeof recordCardReview === 'function') {
        recordCardReview(currentQuizWord, isCorrect ? 3 : 1);
    } else {
        wordList.forEach(w => {
            if ((w.word || '').trim().toLowerCase() === targetAns) {
                if (isCorrect) {
                    w.knowStreak = (w.knowStreak || 0) + 1;
                    if (w.knowStreak >= 2 && (w.level || 1) < 5) {
                        w.level = (w.level || 1) + 1;
                        w.knowStreak = 0;
                    }
                } else {
                    w.level = Math.max(1, (w.level || 1) - 1);
                    w.knowStreak = 0;
                }
                w.updatedAt = Date.now();
            }
        });
    }

    if (typeof saveStorage === 'function') saveStorage();
    if (typeof updateUI === 'function') updateUI();

    const lvInfo = (typeof getLevelInfo === 'function')
        ? getLevelInfo(currentQuizWord.level || 1)
        : { name: `Lv.${currentQuizWord.level || 1}` };
    const nextDueText = formatNextReviewLabel(currentQuizWord.nextReview);

    if (isCorrect) {
        quizScoreCorrect += 1;

        feedbackElem.className = "p-4 rounded-xl text-sm font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 block";
        feedbackElem.innerHTML = `
            <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center space-x-2">
                    <i class="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400 text-lg"></i>
                    <span>${typeof t === 'function' ? t('quizCorrectMsg') : '恭喜答對！'} <strong>${currentQuizWord.word}</strong> (${currentQuizWord.meaning || ''})</span>
                </div>
                <span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 font-bold">
                    ${lvInfo.name} · 下次複習：${nextDueText}
                </span>
            </div>
        `;
    } else {
        feedbackElem.className = "p-4 rounded-xl text-sm font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 block";
        feedbackElem.innerHTML = `
            <div class="space-y-1.5">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                    <div class="flex items-center space-x-2">
                        <i class="fa-solid fa-circle-xmark text-rose-600 dark:text-rose-400 text-lg"></i>
                        <span>${typeof t === 'function' ? t('quizWrongMsg') : '答錯了！正確答案是：'}<strong class="text-rose-900 dark:text-rose-300 underline">${currentQuizWord.word}</strong></span>
                    </div>
                    <span class="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/70 text-rose-700 dark:text-rose-300 font-bold">
                        已排入重點重學 · 10 分鐘後再測
                    </span>
                </div>
                <p class="text-xs text-rose-700 dark:text-rose-400 pl-6">${typeof t === 'function' ? t('quizMeaningLabel') : '釋義：'}${currentQuizWord.meaning || ''} ${currentQuizWord.phonetic ? `(${currentQuizWord.phonetic})` : ''}</p>
            </div>
        `;
    }

    const scoreElem = document.getElementById('quizScore');
    if (scoreElem) {
        scoreElem.innerText = `${quizScoreCorrect}/${quizScoreTotal}`;
    }

    setTimeout(() => {
        nextQuizQuestion();
    }, 1800);
}
