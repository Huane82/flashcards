/**
 * 隨堂測驗模組 (Quiz Module)
 * - 自動過濾：僅出題「擁有英文例句 (sentence)」的單字
 * - 無例句單字自動留在「卡片輪播區」背誦，避免測驗出現空題目
 * - 出題權重與 5 級艾賓浩斯演算法完全連動
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
 * 產生下一題測驗 (僅過濾出有例句的單字進行出題)
 */
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

    // 1. 篩選當前字庫中「具備英文例句」的合格單字
    const validQuizCandidates = (typeof wordList !== 'undefined' ? wordList : []).filter(w => {
        const matchCat = (typeof selectedCategory === 'undefined' || selectedCategory === "ALL")
            ? true
            : (w.category || "預設字庫") === selectedCategory;
        const hasSentence = w.sentence && w.sentence.trim() !== '';
        return matchCat && hasSentence;
    });

    // 2. 若當前字庫沒有任何帶有例句的單字，給予友善提示
    if (validQuizCandidates.length === 0) {
        currentQuizWord = null;
        if (promptBox) {
            promptBox.innerHTML = `
                <div class="text-center py-4 space-y-2">
                    <p class="text-amber-600 font-bold text-base">⚠️ 當前字庫尚無具備英文例句的單字！</p>
                    <p class="text-xs text-slate-500 font-normal">
                        隨堂測驗已開啟過濾保護（僅考有英文例句的單字）。<br>
                        沒有例句的單字可先至「<span class="font-bold text-brand-600">卡片輪播</span>」背誦，或點擊「批量貼上」使用 AI 補齊例句。
                    </p>
                </div>
            `;
        }
        if (badgeElem) badgeElem.innerText = '等待例句補齊';
        return;
    }

    // 3. 從合格候選名單中，按 5 級記憶權重抽出下一題
    // 為確保抽到的卡片一定有例句，多抽幾次直到符合條件
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

    // 備用機制
    currentQuizWord = (picked && picked.sentence && picked.sentence.trim() !== '')
        ? picked
        : validQuizCandidates[Math.floor(Math.random() * validQuizCandidates.length)];

    const word = currentQuizWord.word.trim();
    const sentence = currentQuizWord.sentence.trim();

    // 4. 依據模式渲染測驗題目
    if (currentQuizMode === 1) {
        // 模式 1：純英文上下文聯想 (僅英文例句與首尾遮罩)
        if (badgeElem) badgeElem.innerText = '模式 1：純英文上下文聯想';
        if (promptTitleElem) promptTitleElem.innerText = '英文上下文提示 (填出挖空單字)：';

        let hintWord = '';
        if (word.length <= 2) {
            hintWord = word[0] + '_'.repeat(word.length - 1);
        } else {
            hintWord = word[0] + '_'.repeat(word.length - 2) + word[word.length - 1];
        }

        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        let maskedSentence = sentence.replace(regex, `<span class="text-brand-600 font-extrabold underline decoration-wavy px-1">${hintWord}</span>`);
        
        if (maskedSentence === sentence) {
            maskedSentence = `${sentence} <br><span class="text-xs text-slate-500 font-mono font-normal mt-2 block">[提示遮罩: ${hintWord}]</span>`;
        }

        promptBox.innerHTML = `<p class="font-serif italic text-xl leading-relaxed text-slate-800">${maskedSentence}</p>`;

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
        // 模式 3：🎯 句意對照挖空
        if (badgeElem) badgeElem.innerText = '模式 3：🎯 句意對照挖空';
        if (promptTitleElem) promptTitleElem.innerText = '中英文句意對照：';

        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const blankedSentence = sentence.replace(regex, '____');
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
 * 處理提交答案與對錯結算
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

    const scoreElem = document.getElementById('quizScore');
    if (scoreElem) {
        scoreElem.innerText = `${quizScoreCorrect}/${quizScoreTotal}`;
    }

    setTimeout(() => {
        nextQuizQuestion();
    }, 1800);
}