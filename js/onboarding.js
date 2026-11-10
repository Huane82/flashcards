/**
 * 🚀 新手客製化設定與互動導覽教學模組 (js/onboarding.js)
 */

let currentTourIndex = 0;

// 🎯 導覽步驟定義 (指向 DOM 元素 ID)
const TOUR_STEPS = [
    {
        targetId: 'headerCategorySelector',
        titleKey: 'tour1Title',
        descKey: 'tour1Desc',
        tab: 'home'
    },
    {
        targetId: 'sec-home',
        titleKey: 'tour2Title',
        descKey: 'tour2Desc',
        tab: 'home'
    },
    {
        targetId: 'bnav-list',
        titleKey: 'tour3Title',
        descKey: 'tour3Desc',
        tab: 'home'
    },
    {
        targetId: 'bnav-store',
        titleKey: 'tour4Title',
        descKey: 'tour4Desc',
        tab: 'home'
    },
    {
        targetId: 'bnav-settings',
        titleKey: 'tour5Title',
        descKey: 'tour5Desc',
        tab: 'home'
    }
];

/**
 * 1. 同意條款後觸發：開啟新手客製化設定 Modal
 */
function startOnboardingFlow() {
    closeModal('welcomeModal');
    
    // 如果已經完成過新手引導，直接進入
    if (localStorage.getItem('lzhcard_onboarding_completed') === 'true') {
        return;
    }

    // 填入當前設定預設值
    const nativeSelect = document.getElementById('obNativeLang');
    const targetSelect = document.getElementById('obTargetLang');
    const cardSelect = document.getElementById('obCardDisplayMode');
    const keyInput = document.getElementById('obApiKey');

    if (nativeSelect) nativeSelect.value = localStorage.getItem('lzhcard_native_lang') || 'zh-TW';
    if (targetSelect) targetSelect.value = localStorage.getItem('lzhcard_target_lang') || 'en';
    if (cardSelect) cardSelect.value = localStorage.getItem('lzhcard_display_mode') || 'target_front';
    if (keyInput) keyInput.value = (typeof getValidApiKey === 'function') ? (getValidApiKey() || '') : '';

    openModal('onboardingSetupModal');
}

/**
 * 2. 略過設定 Modal
 */
function skipOnboardingSetup() {
    closeModal('onboardingSetupModal');
    startInteractiveTour(); // 直接開啟介面導覽
}

/**
 * 3. 儲存設定並開啟導覽
 */
function saveOnboardingSetupAndContinue() {
    const nativeLang = document.getElementById('obNativeLang')?.value || 'zh-TW';
    const targetLang = document.getElementById('obTargetLang')?.value || 'en';
    const cardMode = document.getElementById('obCardDisplayMode')?.value || 'target_front';
    const apiKey = document.getElementById('obApiKey')?.value.trim();

    // 寫入儲存
    localStorage.setItem('lzhcard_native_lang', nativeLang);
    localStorage.setItem('lzhcard_target_lang', targetLang);
    localStorage.setItem('lzhcard_display_mode', cardMode);

    if (apiKey) {
        localStorage.setItem('gemini_api_key', apiKey);
    }

    // 更新介面 UI 語系
    if (typeof applyLanguageUI === 'function') applyLanguageUI();

    closeModal('onboardingSetupModal');
    startInteractiveTour();
}

/**
 * 4. 開啟高亮聚焦導覽教學
 */
function startInteractiveTour() {
    currentTourIndex = 0;
    const tourOverlay = document.getElementById('onboardingTourOverlay');
    if (tourOverlay) tourOverlay.classList.remove('hidden');

    renderTourStep(currentTourIndex);
}

/**
 * 繪製目前導覽步驟 (計算 Element 位置並高亮)
 */
function renderTourStep(index) {
    if (index < 0 || index >= TOUR_STEPS.length) {
        finishTour();
        return;
    }

    const step = TOUR_STEPS[index];

    // 如果該步驟需要切換 Tab，自動切換
    if (step.tab && typeof switchTab === 'function') {
        switchTab(step.tab);
    }

    const targetElem = document.getElementById(step.targetId);
    const highlightBox = document.getElementById('tourHighlightBox');
    const popover = document.getElementById('tourPopover');

    if (!targetElem || !highlightBox || !popover) return;

    // 取得目標元素的螢幕位置
    const rect = targetElem.getBoundingClientRect();

    // 1. 設定高亮框的位置與大小
    highlightBox.style.top = `${rect.top - 6}px`;
    highlightBox.style.left = `${rect.left - 6}px`;
    highlightBox.style.width = `${rect.width + 12}px`;
    highlightBox.style.height = `${rect.height + 12}px`;

    // 2. 更新標題與內容
    document.getElementById('tourStepBadge').innerText = `${index + 1} / ${TOUR_STEPS.length}`;
    document.getElementById('tourStepTitle').innerText = t(step.titleKey);
    document.getElementById('tourStepDesc').innerText = t(step.descKey);

    // 3. 計算浮動卡片 Popover 位置 (判斷擺在目標上方或下方)
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const popoverHeight = popover.offsetHeight || 180;
    const popoverWidth = popover.offsetWidth || 320;

    let popoverTop = rect.bottom + 16;
    let popoverLeft = rect.left + (rect.width / 2) - (popoverWidth / 2);

    // 若下方空間不足，改顯示在目標上方
    if (popoverTop + popoverHeight > windowHeight - 20) {
        popoverTop = rect.top - popoverHeight - 16;
    }

    // 邊界修正，防止超出螢幕左右兩側
    if (popoverLeft < 10) popoverLeft = 10;
    if (popoverLeft + popoverWidth > windowWidth - 10) popoverLeft = windowWidth - popoverWidth - 10;

    popover.style.top = `${Math.max(10, popoverTop)}px`;
    popover.style.left = `${popoverLeft}px`;

    // 4. 更新按鈕狀態
    const prevBtn = document.getElementById('tourPrevBtn');
    const nextBtn = document.getElementById('tourNextBtn');

    if (prevBtn) prevBtn.disabled = (index === 0);

    if (nextBtn) {
        if (index === TOUR_STEPS.length - 1) {
            nextBtn.innerText = t('btnFinishTour');
            nextBtn.className = "px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs";
        } else {
            nextBtn.innerHTML = `${t('btnNextStep')} <i class="fa-solid fa-chevron-right ml-1"></i>`;
            nextBtn.className = "px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition shadow-xs";
        }
    }
}

/**
 * 上一步
 */
function prevTourStep() {
    if (currentTourIndex > 0) {
        currentTourIndex--;
        renderTourStep(currentTourIndex);
    }
}

/**
 * 下一步 / 完成
 */
function nextTourStep() {
    if (currentTourIndex < TOUR_STEPS.length - 1) {
        currentTourIndex++;
        renderTourStep(currentTourIndex);
    } else {
        finishTour();
    }
}

/**
 * 結束/略過導覽
 */
function finishTour() {
    const tourOverlay = document.getElementById('onboardingTourOverlay');
    if (tourOverlay) tourOverlay.classList.add('hidden');

    // 標記已完成，下次登入不再自動彈出
    localStorage.setItem('lzhcard_onboarding_completed', 'true');
    
    // 重置回到主頁
    if (typeof switchTab === 'function') switchTab('home');
}