/**
 * 隨堂測驗模組 (Quiz Module)
 * - 出題演算法統一調用 algorithm.js 的 getNextCardSpacedRepetition()
 * - 模式 1：純英文上下文聯想 (僅提供英文例句/首尾字母提示，完全不提供中文)
 * - 模式 2：詞性與繁中釋義填空
 * - 模式 3：句意對照中英挖空填空
 */

let currentQuizWord = null;
let currentQuizMode = 1;
let quizScoreCorrect = 0;
let quizScoreTotal = 0;

/**
 * 切換測驗模式
 */
function setQuizMode(mode) {
    currentQuizMode = mode;
    
    // 更新模式按鈕 UI 狀態
    [1, 2, 3].forEach(m => {
        const btn = document.getElementById(`qmode-${m}`);
        if (btn) {
            if (m === mode) {
                btn.className = "py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 bg-brand-600 text-white shadow-xs";
            } else {
                btn.className = "py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200";
            }
        }
    });

    nextQuizQuestion();
}

/**
 * 產生下一題測驗 (出題機率與字卡輪播演算法完全一致)
 */
function nextQuizQuestion() {
    // 清空輸入框與反饋訊息
    const inputElem = document.getElementById('quizInput');
    const feedbackElem = document.getElementById('quizFeedback');
    if (inputElem) {
        inputElem.value = '';
        inputElem.focus();
    }
    if (feedbackElem) {
        feedbackElem.classList.add('hidden');
        feedbackElem.innerHTML = '';
    }

    // 【核心點 1】出題機率與字卡輪播完全一致：調用 5 級艾賓浩斯演算法選卡
    if (typeof getNextCardSpacedRepetition === 'function') {
        currentQuizWord = getNextCardSpacedRepetition();
    } else if (typeof getNextCardNoRepeat === 'function') {
        currentQuizWord = getNextCardNoRepeat();
    } else {
        currentQuizWord = (typeof wordList !== 'undefined' && wordList.length > 0) 
            ? wordList[Math.floor(Math.random() * wordList.length)] 
            : null;
    }

    const promptBox = document.getElementById('quizPromptBox');
    const badgeElem = document.getElementById('quizBadge');
    const promptTitleElem = document.getElementById('quizPromptTitle');

    if (!currentQuizWord || typeof wordList === 'undefined' || wordList.length === 0) {
        if (promptBox) promptBox.innerHTML = '<span class="text-slate-400">字庫為空，請先新增單字！</span>';
        if (badgeElem) badgeElem.innerText = '請先新增單字';
        return;
    }

    const word = currentQuizWord.word.trim();
    const sentence = currentQuizWord.sentence ? currentQuizWord.sentence.trim() : '';

    // 依據選擇的模式渲染題目
    if (currentQuizMode === 1) {
        // 【核心點 2】模式 1：純英文聯想能力 (僅給英文句子/首尾字母提示，不給中文)
        if (badgeElem) badgeElem.innerText = '模式 1：純英文上下文聯想 (無中文提示)';
        if (promptTitleElem) promptTitleElem.innerText = '英文上下文提示 (填出挖空單字)：';

        // 產生首尾字母提示遮罩，例如 resilient -> r_______t
        let hintWord = '';
        if (word.length <= 2) {
            hintWord = word[0] + '_'.repeat(word.length - 1);
        } else {
            hintWord = word[0] + '_'.repeat(word.length - 2) + word[word.length - 1];
        }

        if (sentence) {
            // 將例句中的目標單字替換為首尾提示 (忽略大小寫)
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            let maskedSentence = sentence.replace(regex, `<span class="text-brand-600 font-extrabold underline decoration-wavy px-1">${hintWord}</span>`);
            
            // 若例句中未找到完全匹配的字，則顯示原文加上提示
            if (maskedSentence === sentence) {
                maskedSentence = `${sentence} <br><span class="text-xs text-slate-500 font-mono font-normal mt-2 block">[提示遮罩: ${hintWord}]</span>`;
            }

            promptBox.innerHTML = `<p class="font-serif italic text-xl leading-relaxed text-slate-800">${maskedSentence}</p>`;
        } else {
            // 無例句時顯示純英文字母遮罩與長度提示
            promptBox.innerHTML = `
                <div class="text-center py-2">
                    <span class="font-mono text-3xl font-extrabold tracking-widest text-brand-600">${hintWord}</span>
                    <span class="block text-xs font-normal text-slate-400 mt-2">（此單字包含 ${word.length} 個字母）</span>
                </div>
            `;
        }

    } else if (currentQuizMode === 2) {
        // 模式 2：詞性與繁中釋義填空
        if (badgeElem) badgeElem.innerText = '模式 2：詞性與繁中釋義對照';
        if (promptTitleElem) promptTitleElem.innerText = '中文釋義與詞性提示：';

        const posStr = currentQuizWord.pos ? `<span class="px-2 py-0.5 rounded bg-brand-100 text-brand-700 text-xs font-bold mr-2">[${currentQuizWord.pos}]</span>` : '';
        promptBox.innerHTML = `
            <div class="flex items-center">
                ${posStr}
                <span class="text-2xl font-bold text-slate-800">${currentQuizWord.meaning || '（未填寫釋義）'}</span>
            </div>
        `;

    } else if (currentQuizMode === 3) {
        // 模式 3：🎯 句意對照中英挖空填空
        if (badgeElem) badgeElem.innerText = '模式 3：🎯 句意對照挖空';
        if (promptTitleElem) promptTitleElem.innerText = '中英文句意對照：';

        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const blankedSentence = sentence ? sentence.replace(regex, '____') : '____';
        const translation = currentQuizWord.translation || currentQuizWord.meaning || '（無翻譯對照）';

        promptBox.innerHTML = `
            <div class="space-y-2">
                <p class="font-serif italic text-lg text-slate-800">${blankedSentence}</p>
                <p class="text-sm font-semibold text-emerald-700 border-t border-slate-200 pt-2">中文對照: ${translation}</p>
            </div>
        `;
    }
}

/**
 * 處理提交答案與對錯結算 (同時連動記憶等級升降級)
 */
function handleQuizSubmit(e) {
    if (e) e.preventDefault();
    if (!currentQuizWord) return;

    const inputElem = document.getElementById('quizInput');
    const feedbackElem = document.getElementById('quizFeedback');
    const userAns = inputElem ? inputElem.value.trim().toLowerCase() : '';
    const targetAns = currentQuizWord.word.trim().toLowerCase();

    quizScoreTotal += 1;

    if (userAns === targetAns) {
        quizScoreCorrect += 1;

        // 答對獎勵：連動升級計數
        const card = wordList.find(w => w.id === currentQuizWord.id);
        if (card) {
            if (!card.level) card.level = 1;
            if (typeof card.knowStreak === 'undefined') card.knowStreak = 0;
            card.knowStreak += 1;
            if (card.knowStreak >= 3) {
                if (card.level < 5) {
                    card.level += 1;
                    card.knowStreak = 0;
                } else {
                    card.knowStreak = 3;
                }
            }
            if (typeof saveStorage === 'function') saveStorage();
        }

        feedbackElem.className = "p-4 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 block";
        feedbackElem.innerHTML = `
            <div class="flex items-center space-x-2">
                <i class="fa-solid fa-circle-check text-emerald-600 text-lg"></i>
                <span>恭喜答對！ <strong>${currentQuizWord.word}</strong> (${currentQuizWord.meaning || ''})</span>
            </div>
        `;
    } else {
        // 答錯懲罰：直接降一級
        const card = wordList.find(w => w.id === currentQuizWord.id);
        if (card) {
            card.level = Math.max(1, (card.level || 1) - 1);
            card.knowStreak = 0;
            if (typeof saveStorage === 'function') saveStorage();
        }

        feedbackElem.className = "p-4 rounded-xl text-sm font-semibold bg-rose-50 text-rose-800 border border-rose-200 block";
        feedbackElem.innerHTML = `
            <div class="space-y-1">
                <div class="flex items-center space-x-2">
                    <i class="fa-solid fa-circle-xmark text-rose-600 text-lg"></i>
                    <span>答錯了！正確答案是：<strong class="text-rose-900 underline">${currentQuizWord.word}</strong></span>
                </div>
                <p class="text-xs text-rose-700 pl-6">釋義：${currentQuizWord.meaning || ''} ${currentQuizWord.phonetic ? `(${currentQuizWord.phonetic})` : ''}</p>
            </div>
        `;
    }

    // 更新得分統計 UI
    const scoreElem = document.getElementById('quizScore');
    if (scoreElem) {
        scoreElem.innerText = `${quizScoreCorrect}/${quizScoreTotal}`;
    }

    // 1.8 秒後自動進入下一題
    setTimeout(() => {
        nextQuizQuestion();
    }, 1800);
}
