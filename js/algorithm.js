const LEVEL_NAMES = {
    1: "Lv.1 完全沒看過",
    2: "Lv.2 看過但不會",
    3: "Lv.3 當天看得懂",
    4: "Lv.4 文章看得懂",
    5: "Lv.5 完全精熟"
};

const LEVEL_COLORS = {
    1: "bg-rose-50 text-rose-700 border-rose-200",
    2: "bg-amber-50 text-amber-700 border-amber-200",
    3: "bg-blue-50 text-blue-700 border-blue-200",
    4: "bg-indigo-50 text-indigo-700 border-indigo-200",
    5: "bg-emerald-50 text-emerald-700 border-emerald-200"
};

let activeLevel1Pool = [];
let activeLevel2Pool = [];
let historyQueue = [];

function getLevelInfo(level) {
    const lv = level || 1;
    return {
        name: LEVEL_NAMES[lv] || LEVEL_NAMES[1],
        color: LEVEL_COLORS[lv] || LEVEL_COLORS[1]
    };
}

function getNextCardSpacedRepetition() {
    if (!wordList || wordList.length === 0) return null;

    const filteredList = wordList.filter(w => {
        if (typeof selectedCategory === 'undefined' || selectedCategory === "ALL") return true;
        return (w.category || "預設字庫") === selectedCategory;
    });

    if (filteredList.length === 0) return null;

    filteredList.forEach(w => {
        if (!w.level) w.level = 1;
        if (typeof w.knowStreak === 'undefined') w.knowStreak = 0;
    });

    activeLevel1Pool = activeLevel1Pool.filter(id => {
        const w = filteredList.find(item => item.id === id);
        return w && w.level === 1;
    });
    const allLevel1Words = filteredList.filter(w => w.level === 1);
    for (const w of allLevel1Words) {
        if (activeLevel1Pool.length >= 3) break;
        if (!activeLevel1Pool.includes(w.id)) {
            activeLevel1Pool.push(w.id);
        }
    }

    activeLevel2Pool = activeLevel2Pool.filter(id => {
        const w = filteredList.find(item => item.id === id);
        return w && w.level === 2;
    });
    const allLevel2Words = filteredList.filter(w => w.level === 2);
    for (const w of allLevel2Words) {
        if (activeLevel2Pool.length >= 4) break;
        if (!activeLevel2Pool.includes(w.id)) {
            activeLevel2Pool.push(w.id);
        }
    }

    const candidateWords = filteredList.filter(w => {
        if (w.level === 1) return activeLevel1Pool.includes(w.id);
        if (w.level === 2) return activeLevel2Pool.includes(w.id);
        return true;
    });

    if (candidateWords.length === 0) return filteredList[0];
    if (candidateWords.length === 1) return candidateWords[0];

    const BASE_WEIGHTS = { 1: 100, 2: 70, 3: 35, 4: 15, 5: 4 };

    const weightedCandidates = candidateWords.map(word => {
        let weight = BASE_WEIGHTS[word.level] || 50;

        const historyIndex = historyQueue.indexOf(word.id);
        if (historyIndex !== -1) {
            if (historyIndex === historyQueue.length - 1) {
                weight *= 0.05;
            } else {
                weight *= 0.25;
            }
        }
        return { word, weight: Math.max(weight, 0.1) };
    });

    const totalWeight = weightedCandidates.reduce((sum, item) => sum + item.weight, 0);
    let randomNum = Math.random() * totalWeight;

    let selectedCard = weightedCandidates[0].word;
    for (const item of weightedCandidates) {
        if (randomNum < item.weight) {
            selectedCard = item.word;
            break;
        }
        randomNum -= item.weight;
    }

    historyQueue.push(selectedCard.id);
    if (historyQueue.length > 4) historyQueue.shift();

    return selectedCard;
}

function getNextCardNoRepeat() {
    return getNextCardSpacedRepetition();
}