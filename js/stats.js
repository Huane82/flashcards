/**
 * LZHCard - 學習數據與成果統計模組 (stats.js)
 */

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
    const currentWordList = (typeof wordList !== 'undefined' && Array.isArray(wordList)) ? wordList : [];
    const totalWords = currentWordList.length;

    // 1. 統計總體記憶等級分佈 (Lv.1~5)
    const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    // 2. 統計各字庫細節 (含字庫總數與等級分佈)
    const catStats = {};

    currentWordList.forEach(w => {
        const lv = Math.min(5, Math.max(1, w.level || 1));
        const cat = w.category || defaultCatName;

        levelCounts[lv]++;

        if (!catStats[cat]) {
            catStats[cat] = { total: 0, levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
        }
        catStats[cat].total++;
        catStats[cat].levels[lv]++;
    });

    const masteredCount = levelCounts[4] + levelCounts[5];
    const masterRate = totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0;

    let html = '';

    // -------------------------------------------------------------
    // 卡片 A: 總單字量與掌握率
    // -------------------------------------------------------------
    if (showTotal) {
        const totalWordsLabel = typeof t === 'function' ? t('statsTotalWords') : '總單字量';
        const masteredRateLabel = typeof t === 'function' ? t('statsMasteredRate') : '熟練率';
        const unitItemLabel = typeof t === 'function' ? t('unitItem') : '個';

        html += `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-4">
                    <div class="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/50 flex items-center justify-center text-brand-600 dark:text-brand-400 text-2xl font-bold">
                        <i class="fa-solid fa-book-bookmark"></i>
                    </div>
                    <div>
                        <span class="text-xs font-semibold text-slate-400 block">${totalWordsLabel}</span>
                        <span class="text-2xl font-black text-slate-900 dark:text-white">${totalWords} <span class="text-xs font-normal text-slate-400">${unitItemLabel}</span></span>
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
    // 卡片 B: 全局艾賓浩斯等級熟悉度分佈 (Lv.1~5)
    // -------------------------------------------------------------
    if (showLevel) {
        const levelDetailLabel = typeof t === 'function' ? t('statsLevelDetail') : '艾賓浩斯記憶等級分佈';
        const unitItemLabel = typeof t === 'function' ? t('unitItem') : '個';

        const lvColors = {
            1: { bg: 'bg-rose-500', badge: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
            2: { bg: 'bg-amber-500', badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
            3: { bg: 'bg-blue-500', badge: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
            4: { bg: 'bg-indigo-500', badge: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
            5: { bg: 'bg-emerald-500', badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' }
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
                        <span class="px-2 py-0.5 rounded text-[11px] font-bold border ${lvColors[lv].badge}">
                            Lv.${lv} - ${lvInfo.name}
                        </span>
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
        const accuracyRateLabel = typeof t === 'function' ? t('accuracyRate') : '掌握率';
        const unitItemLabel = typeof t === 'function' ? t('unitItem') : '個';
        const catKeys = Object.keys(catStats);

        html += `
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">${catBreakdownLabel}</h3>
                <div class="divide-y divide-slate-100 dark:divide-slate-700">
        `;

        catKeys.forEach(cat => {
            const data = catStats[cat];
            const catPct = totalWords > 0 ? Math.round((data.total / totalWords) * 100) : 0;
            const catMastered = data.levels[4] + data.levels[5];
            const catMasterRate = data.total > 0 ? Math.round((catMastered / data.total) * 100) : 0;

            html += `
                <div class="py-4 first:pt-0 last:pb-0 space-y-2">
                    <div class="flex justify-between items-center">
                        <div>
                            <span class="font-bold text-slate-800 dark:text-slate-200 text-sm">${cat}</span>
                            <span class="text-xs text-slate-400 ml-2">(${data.total} ${unitItemLabel} / ${catPct}%)</span>
                        </div>
                        <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            ${accuracyRateLabel} ${catMasterRate}%
                        </span>
                    </div>
            `;

            // 顯示各字庫等級分佈條
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

    container.innerHTML = html || `<div class="text-center text-slate-400 text-xs py-10">請最少勾選一個顯示指標</div>`;
}