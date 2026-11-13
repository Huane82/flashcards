/**
 * LZHCard - 學習數據與成果統計模組 (FSRS 排程分析版 - stats.js)
 */

/**
 * 🔍 取得當前勾選字庫的原始單字清單（含跨字庫未去重，用於單字庫個別統計）
 */
function getStatsRawFilteredWords() {
    const activeCats = window.selectedCategories || ['ALL'];
    const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : '預設字庫';
    if (!wordList || !Array.isArray(wordList)) return [];

    const filtered = activeCats.includes("ALL")
        ? wordList
        : wordList.filter(w => activeCats.includes(w.category || defaultCatName));

    if (typeof migrateCardFSRS === 'function') {
        filtered.forEach(w => migrateCardFSRS(w));
    }

    return filtered;
}

/**
 * 🔍 取得跨字庫去重後的單字清單（重複字只算一次，以進度最高者為主）
 */
function getStatsFilteredWords() {
    const raw = getStatsRawFilteredWords();
    if (typeof deduplicateWordsByHighestProgress === 'function') {
        return deduplicateWordsByHighestProgress(raw);
    }
    return raw;
}

/**
 * 🎯 從統計頁一鍵針對頑固難字啟動強訓
 */
function practiceLeechWord(wordId) {
    if (!Array.isArray(wordList)) return;
    const target = wordList.find(w => w.id === wordId);
    if (!target) return;

    const normalized = (target.word || '').trim().toLowerCase();
    const now = Date.now();

    // 將該單字設為「已到期重學」狀態，讓 FSRS Tier 1 立即優先抽出
    wordList.forEach(w => {
        if ((w.word || '').trim().toLowerCase() === normalized) {
            if (typeof migrateCardFSRS === 'function') migrateCardFSRS(w);
            if (w.state === 'new') w.state = 'learning';
            w.nextReview = now - 60000;
        }
    });

    if (typeof startFocusMode === 'function') {
        startFocusMode('flashcard');
    }
}

/**
 * 📊 渲染統計成果面板 (根據使用者勾選項目動態產生卡片)
 */
function renderStats() {
    const container = document.getElementById('statsContainer');
    if (!container) return;

    const showTotal = document.getElementById('chkShowTotal')?.checked ?? true;
    const showLevel = document.getElementById('chkShowLevel')?.checked ?? true;
    const showCategory = document.getElementById('chkShowCategory')?.checked ?? true;
    const showCatLevel = document.getElementById('chkShowCatLevel')?.checked ?? true;

    const defaultCatName = typeof t === 'function' ? t('defaultCategoryName') : '預設字庫';
    const unitItemLabel = typeof t === 'function' ? t('unitItem') : '個';

    const escapeHtml = (str) => String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    // 全局去重後的單字清單（重複字只計算一次，以進度高者為主）
    const currentWordList = getStatsFilteredWords();
    // 各字庫個別清單（用於計算每個字庫內部的單字數與進度）
    const rawWordList = getStatsRawFilteredWords();

    const totalWords = currentWordList.length;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // 1. 統計總體記憶等級分佈 (Lv.1~5)
    const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const catStats = {};

    // 2. 統計 FSRS 未來 7 天複習量預測與平均記憶保留率
    const forecastCounts = [0, 0, 0, 0, 0, 0, 0];
    let dueTodayCount = 0;
    let newUnlearnedCount = 0;
    let totalRetrievability = 0;
    let learnedWithRCount = 0;

    // 3. 收集去重後的頑固難字（lapses > 0）
    const leechMap = new Map();

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const endOfTodayTs = endOfToday.getTime();

    // 計算全局去重後的總體數據
    currentWordList.forEach(w => {
        const lv = Math.min(5, Math.max(1, w.level || 1));
        levelCounts[lv]++;

        if (w.state === 'new') {
            newUnlearnedCount++;
        } else {
            const due = w.nextReview || 0;
            if (due <= endOfTodayTs) {
                forecastCounts[0]++;
                if (due <= now) dueTodayCount++;
            } else {
                const daysAhead = Math.ceil((due - endOfTodayTs) / dayMs);
                if (daysAhead >= 1 && daysAhead <= 6) {
                    forecastCounts[daysAhead]++;
                }
            }

            if (typeof calculateRetrievability === 'function' && (w.stability || 0) > 0) {
                totalRetrievability += calculateRetrievability(w, now);
                learnedWithRCount++;
            }
        }

        if ((w.lapses || 0) > 0 && w.word) {
            const key = w.word.trim().toLowerCase();
            const existing = leechMap.get(key);
            if (!existing || (w.lapses || 0) > (existing.lapses || 0)) {
                leechMap.set(key, w);
            }
        }
    });

    // 計算各字庫個別數據
    rawWordList.forEach(w => {
        const lv = Math.min(5, Math.max(1, w.level || 1));
        const cat = w.category || defaultCatName;
        if (!catStats[cat]) {
            catStats[cat] = { total: 0, levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
        }
        catStats[cat].total++;
        catStats[cat].levels[lv]++;
    });

    const masteredCount = levelCounts[4] + levelCounts[5];
    const masterRate = totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0;
    const avgRetentionPct = learnedWithRCount > 0
        ? Math.round((totalRetrievability / learnedWithRCount) * 100)
        : 100;

    let html = '';

    // -------------------------------------------------------------
    // 卡片 A: 總單字量與掌握率
    // -------------------------------------------------------------
    if (showTotal) {
        const totalWordsLabel = typeof t === 'function' ? t('statsTotalWords') : '總單字量 (不重複)';
        const masteredRateLabel = typeof t === 'function' ? t('statsMasteredRate') : '熟練率 (Lv.4~5)';

        html += `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4">
                    <div class="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center text-brand-600 dark:text-brand-400 text-2xl font-bold">
                        <i class="fa-solid fa-book-bookmark"></i>
                    </div>
                    <div>
                        <span class="text-xs font-semibold text-slate-400 block">${totalWordsLabel}</span>
                        <span class="text-2xl font-black text-slate-900 dark:text-white">${totalWords} <span class="text-xs font-normal text-slate-400">${unitItemLabel}</span></span>
                        <span class="text-[11px] text-slate-400 block mt-0.5">未學新字 ${newUnlearnedCount} · 當前記憶保留率 ${avgRetentionPct}%</span>
                    </div>
                </div>

                <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-2xl font-bold">
                        <i class="fa-solid fa-award"></i>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-center">
                            <span class="text-xs font-semibold text-slate-400 block">${masteredRateLabel}</span>
                            <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">${masterRate}%</span>
                        </div>
                        <span class="text-2xl font-black text-slate-900 dark:text-white">${masteredCount} <span class="text-xs font-normal text-slate-400">${unitItemLabel}</span></span>
                        <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                            <div class="h-full bg-emerald-500 rounded-full transition-all duration-500" style="width: ${masterRate}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // -------------------------------------------------------------
    // 卡片 FSRS: 未來 7 天複習量預測雷達
    // -------------------------------------------------------------
    if (totalWords > 0) {
        const maxForecast = Math.max(...forecastCounts, 1);
        const dayLabels = ['今天', '明天', '+2天', '+3天', '+4天', '+5天', '+6天'];

        html += `
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                <div class="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <i class="fa-solid fa-calendar-check text-brand-500"></i>
                            <span>FSRS 未來 7 天待複習預測</span>
                        </h3>
                        <p class="text-[11px] text-slate-400 mt-0.5">依據每張單字的遺忘曲線 (90% 保留率臨界點) 自動排程</p>
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-xs font-bold ${dueTodayCount > 0 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'}">
                        ${dueTodayCount > 0 ? `目前待複習：${dueTodayCount} ${unitItemLabel}` : '今日到期已全數清空'}
                    </span>
                </div>

                <div class="grid grid-cols-7 gap-2 pt-2 items-end h-32">
                    ${forecastCounts.map((cnt, idx) => {
                        const heightPct = cnt === 0 ? 6 : Math.max(14, Math.round((cnt / maxForecast) * 100));
                        const isToday = idx === 0;
                        const barColor = isToday
                            ? (cnt > 0 ? 'bg-amber-500' : 'bg-emerald-500')
                            : 'bg-brand-500/80 dark:bg-brand-500';
                        return `
                            <div class="flex flex-col items-center justify-end h-full space-y-1.5">
                                <span class="text-[11px] font-bold ${isToday ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}">${cnt}</span>
                                <div class="w-full max-w-[34px] bg-slate-100 dark:bg-slate-700/60 rounded-t-lg flex items-end h-20 overflow-hidden">
                                    <div class="w-full ${barColor} rounded-t-lg transition-all duration-500" style="height: ${heightPct}%"></div>
                                </div>
                                <span class="text-[11px] font-semibold ${isToday ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-400'}">${dayLabels[idx]}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // -------------------------------------------------------------
    // 卡片 B: 全局記憶等級熟悉度分佈 (Lv.1~5 + 穩定度天數區間)
    // -------------------------------------------------------------
    if (showLevel) {
        const levelDetailLabel = typeof t === 'function' ? t('statsLevelDetail') : '記憶穩定度等級分佈';

        const lvColors = {
            1: { bg: 'bg-rose-500', span: '新學 / 短期重學', badge: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
            2: { bg: 'bg-amber-500', span: '穩定 1~3 天', badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
            3: { bg: 'bg-blue-500', span: '穩定 3~8 天', badge: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
            4: { bg: 'bg-indigo-500', span: '穩定 8~21 天', badge: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
            5: { bg: 'bg-emerald-500', span: '長期記憶 21 天+', badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' }
        };

        html += `
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>${levelDetailLabel}</span>
                </h3>
                <div class="space-y-3">
        `;

        for (let lv = 1; lv <= 5; lv++) {
            const count = levelCounts[lv];
            const pct = totalWords > 0 ? Math.round((count / totalWords) * 100) : 0;
            const lvInfo = (typeof getLevelInfo === 'function') ? getLevelInfo(lv) : { name: `Lv.${lv}` };

            html += `
                <div class="space-y-1">
                    <div class="flex justify-between items-center text-xs">
                        <div class="flex items-center space-x-2">
                            <span class="px-2 py-0.5 rounded text-[11px] font-bold border ${lvColors[lv].badge}">
                                ${lvInfo.name}
                            </span>
                            <span class="text-[11px] text-slate-400">${lvColors[lv].span}</span>
                        </div>
                        <span class="font-bold text-slate-700 dark:text-slate-300">${count} ${unitItemLabel} <span class="text-slate-400 font-normal">(${pct}%)</span></span>
                    </div>
                    <div class="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div class="h-full ${lvColors[lv].bg} rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        }

        html += `</div></div>`;
    }

    // -------------------------------------------------------------
    // 卡片 C & D: 各字庫/語言分佈與等級細節
    // -------------------------------------------------------------
    if (showCategory || showCatLevel) {
        const catBreakdownLabel = typeof t === 'function' ? t('statsCatBreakdown') : '各字庫學習進度';
        const accuracyRateLabel = typeof t === 'function' ? t('accuracyRate') : '熟練率';
        const catKeys = Object.keys(catStats);
        const rawTotal = rawWordList.length;

        html += `
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">${catBreakdownLabel}</h3>
                <div class="divide-y divide-slate-100 dark:divide-slate-700">
        `;

        catKeys.forEach(cat => {
            const data = catStats[cat];
            const catPct = rawTotal > 0 ? Math.round((data.total / rawTotal) * 100) : 0;
            const catMastered = data.levels[4] + data.levels[5];
            const catMasterRate = data.total > 0 ? Math.round((catMastered / data.total) * 100) : 0;

            html += `
                <div class="py-4 first:pt-0 last:pb-0 space-y-2">
                    <div class="flex justify-between items-center">
                        <div>
                            <span class="font-bold text-slate-800 dark:text-slate-200 text-sm">${escapeHtml(cat)}</span>
                            <span class="text-xs text-slate-400 ml-2">(${data.total} ${unitItemLabel} / ${catPct}%)</span>
                        </div>
                        <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            ${accuracyRateLabel} ${catMasterRate}%
                        </span>
                    </div>
            `;

            if (showCatLevel) {
                html += `<div class="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full flex overflow-hidden">`;
                const colorMap = { 1: 'bg-rose-500', 2: 'bg-amber-500', 3: 'bg-blue-500', 4: 'bg-indigo-500', 5: 'bg-emerald-500' };
                for (let lv = 1; lv <= 5; lv++) {
                    const c = data.levels[lv];
                    if (c > 0) {
                        const p = ((c / data.total) * 100).toFixed(1);
                        html += `<div class="h-full ${colorMap[lv]}" style="width: ${p}%" title="Lv.${lv}: ${c}字 (${p}%)"></div>`;
                    }
                }
                html += `</div>`;
            }

            html += `</div>`;
        });

        html += `</div></div>`;
    }

    // -------------------------------------------------------------
    // 卡片 E: 高遺忘頑固難字榜 (Top 8 Leeches)
    // -------------------------------------------------------------
    const topLeeches = Array.from(leechMap.values())
        .sort((a, b) => (b.lapses || 0) - (a.lapses || 0) || (b.difficulty || 0) - (a.difficulty || 0))
        .slice(0, 8);

    if (topLeeches.length > 0) {
        html += `
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <i class="fa-solid fa-fire text-rose-500"></i>
                            <span>高遺忘頑固難字榜 (Top ${topLeeches.length})</span>
                        </h3>
                        <p class="text-[11px] text-slate-400 mt-0.5">曾背熟後又多次遺忘的單字，系統已自動提高出現加權</p>
                    </div>
                </div>
                <div class="divide-y divide-slate-100 dark:divide-slate-700">
                    ${topLeeches.map(item => {
                        const safeId = escapeHtml(item.id);
                        const diffScore = typeof item.difficulty === 'number' ? item.difficulty.toFixed(1) : '5.5';
                        return `
                            <div class="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold text-sm text-slate-900 dark:text-white truncate">${escapeHtml(item.word)}</span>
                                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0">
                                            遺忘 ${item.lapses} 次
                                        </span>
                                        <span class="text-[10px] text-slate-400 shrink-0">難度 ${diffScore}/10</span>
                                    </div>
                                    <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">${escapeHtml(item.meaning || '')}</p>
                                </div>
                                <button type="button" onclick="practiceLeechWord('${safeId}')" class="px-2.5 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/70 text-brand-600 dark:text-brand-300 text-xs font-bold transition shrink-0">
                                    立即強訓
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html || `<div class="text-center text-slate-400 text-xs py-10">請最少勾選一個顯示指標</div>`;
}
