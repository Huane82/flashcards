let currentQuizWord = null;
let currentQuizMode = 1;
let quizScoreCorrect = 0;
let quizScoreTotal = 0;

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

function nextQuizQuestion() {
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

    const promptBox = document.getElementById('quizPromptBox');
    const badgeElem = document.getElementById('quizBadge');
    const promptTitleElem = document.getElementById('quizPromptTitle');

    const validQuizCandidates = (typeof wordList !== 'undefined' ? wordList : []).filter(w => {
        const matchCat = (typeof selectedCategory === 'undefined' || selectedCategory === "ALL")
            ? true
            : (w.category || "預設字庫") === selectedCategory;
        const hasSentence = w.sentence && w.sentence.trim() !== '';
        return matchCat && hasSentence;
    });

    if (validQuizCandidates.length === 0) {
        currentQuizWord = null;
        if (promptBox) {
            promptBox.innerHTML = `
                <div class="text-center py-4 space-y-2">
                    <p class="text-amber-600 dark:text-amber-400 font-bold text-base">⚠️ 當前字庫尚無具備英文例句的單字！</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400 font-normal">
                        隨堂測驗已開啟過濾保護（僅考有英文例句的單字）。<br>
                        沒有例句的單字可先至「<span class="font-bold text-brand-600 dark:text-brand-400">卡片輪播</span>」背誦，或點擊「批量貼上」使用 AI 補齊例句。
                    </p>
                </div>
            `;
        }
        if (badgeElem) badgeElem.innerText = '等待例句補齊';
        return;
    }

    let attempts = 0;
    let picked = null;
    while (attempts < 20) {
        if (typeof getNextCardSpacedRepetition === 'function') {
            picked = getNextCardSpacedRepetition();
        } else {
            picked = validQuizCandidates[Math.floor(Math.random() * validQuizCandidates.length)];
        }

        if (picked && picked.sentence && picked.sentence.trim() !== '') {
            break;
        }
        attempts++;
    }

    currentQuizWord = (picked && picked.sentence && picked.sentence.trim() !== '')
        ? picked
        : validQuizCandidates[Math.floor(Math.random() * validQuizCandidates.length)];

    const word = currentQuizWord.word.trim();
    const sentence = currentQuizWord.sentence.trim();

    if (currentQuizMode === 1) {
        if (badgeElem) badgeElem.innerText = '模式 1：純英文上下文聯想';
        if (promptTitleElem) promptTitleElem.innerText = '英文上下文提示 (填出挖空單字)：';

        let hintWord = '';
        if (word.length <= 2) {
            hintWord = word[0] + '_'.repeat(word.length - 1);
        } else {
            hintWord = word[0] + '_'.repeat(word.length - 2) + word[word.length - 1];
        }

        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        // 🌟 移除底線 decoration-wavy，改用明顯的高亮 tag，修復藍色波浪線與深色模式下字體偏暗問題
        let maskedSentence = sentence.replace(regex, `<span class="text-brand-500 dark:text-sky-400 font-extrabold border-b-2 border-brand-500 dark:border-sky-400 px-1 py-0.5">${hintWord}</span>`);
        
        if (maskedSentence === sentence) {
            maskedSentence = `${sentence} <br><span class="text-xs text-slate-400 dark:text-slate-500 font-mono font-normal mt-2 block">[提示遮罩: ${hintWord}]</span>`;
        }

        promptBox.innerHTML = `<p class="font-serif italic text-xl leading-relaxed text-slate-800 dark:text-slate-100">${maskedSentence}</p>`;

    } else if (currentQuizMode === 2) {
        if (badgeElem) badgeElem.innerText = '模式 2：詞性與繁中釋義對照';
        if (promptTitleElem) promptTitleElem.innerText = '中文釋義與詞性提示：';

        const posStr = currentQuizWord.pos ? `<span class="px-2 py-0.5 rounded bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 text-xs font-bold mr-2">[${currentQuizWord.pos}]</span>` : '';
        promptBox.innerHTML = `
            <div class="flex items-center">
                ${posStr}
                <span class="text-2xl font-bold text-slate-800 dark:text-slate-100">${currentQuizWord.meaning || '（未填寫釋義）'}</span>
            </div>
        `;

    } else if (currentQuizMode === 3) {
        if (badgeElem) badgeElem.innerText = '模式 3：🎯 句意對照挖空';
        if (promptTitleElem) promptTitleElem.innerText = '中英文句意對照：';

        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const blankedSentence = sentence.replace(regex, '<span class="text-brand-500 dark:text-sky-400 font-bold border-b-2 border-brand-500 dark:border-sky-400 px-2">____</span>');
        const translation = currentQuizWord.translation || currentQuizWord.meaning || '（無翻譯對照）';

        promptBox.innerHTML = `
            <div class="space-y-2">
                <p class="font-serif italic text-lg text-slate-800 dark:text-slate-100">${blankedSentence}</p>
                <p class="text-sm font-semibold text-emerald-600 dark:text-emerald-400 border-t border-slate-200 dark:border-slate-700 pt-2">中文對照: ${translation}</p>
            </div>
        `;
    }
}

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

        feedbackElem.className = "p-4 rounded-xl text-sm font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 block";
        feedbackElem.innerHTML = `
            <div class="flex items-center space-x-2">
                <i class="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400 text-lg"></i>
                <span>恭喜答對！ <strong>${currentQuizWord.word}</strong> (${currentQuizWord.meaning || ''})</span>
            </div>
        `;
    } else {
        const card = wordList.find(w => w.id === currentQuizWord.id);
        if (card) {
            card.level = Math.max(1, (card.level || 1) - 1);
            card.knowStreak = 0;
            if (typeof saveStorage === 'function') saveStorage();
        }

        feedbackElem.className = "p-4 rounded-xl text-sm font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 block";
        feedbackElem.innerHTML = `
            <div class="space-y-1">
                <div class="flex items-center space-x-2">
                    <i class="fa-solid fa-circle-xmark text-rose-600 dark:text-rose-400 text-lg"></i>
                    <span>答錯了！正確答案是：<strong class="text-rose-900 dark:text-rose-300 underline">${currentQuizWord.word}</strong></span>
                </div>
                <p class="text-xs text-rose-700 dark:text-rose-400 pl-6">釋義：${currentQuizWord.meaning || ''} ${currentQuizWord.phonetic ? `(${currentQuizWord.phonetic})` : ''}</p>
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