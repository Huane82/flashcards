/**
 * 🚀 新手客製化設定與互動導覽教學模組 (js/onboarding.js)
 */

let currentTourIndex = 0;

// 🎯 完整 7 步驟導覽 (指向 DOM 元素 ID)
const TOUR_STEPS = [
    {
        targetId: 'headerCategorySelector',
        titleKey: 'tourCatTitle',
        descKey: 'tourCatDesc',
        tab: 'home'
    },
    {
        targetId: 'headerChatBtn',
        titleKey: 'tourChatTitle',
        descKey: 'tourChatDesc',
        tab: 'home'
    },
    {
        targetId: 'sec-home',
        titleKey: 'tourHomeTitle',
        descKey: 'tourHomeDesc',
        tab: 'home'
    },
    {
        targetId: 'bnav-list',
        titleKey: 'tourListTitle',
        descKey: 'tourListDesc',
        tab: 'home'
    },
    {
        targetId: 'bnav-store',
        titleKey: 'tourStoreTitle',
        descKey: 'tourStoreDesc',
        tab: 'home'
    },
    {
        targetId: 'bnav-stats',
        titleKey: 'tourStatsTitle',
        descKey: 'tourStatsDesc',
        tab: 'home'
    },
    {
        targetId: 'bnav-settings',
        titleKey: 'tourSettingsTitle',
        descKey: 'tourSettingsDesc',
        tab: 'home'
    }
];

/**
 * 🗣️ 切換母語選單時，即時觸發全站與 Modal 文字翻譯
 */
function handleObNativeChange(langCode) {
    localStorage.setItem('lzhcard_native_lang', langCode);
    if (typeof applyLanguageUI === 'function') {
        applyLanguageUI();
    }
    if (typeof syncSettingsUI === 'function') {
        syncSettingsUI();
    }
}

/**
 * 🛠️ 控制新手設定 Modal 中個人 API Key 輸入框的顯隱狀態，並即時記憶選擇
 */
function toggleObApiKeyBox() {
    const isPersonal = document.getElementById('obApiModePersonal')?.checked;
    const box = document.getElementById('obApiKeyBox');
    if (box) {
        if (isPersonal) {
            box.classList.remove('hidden');
        } else {
            box.classList.add('hidden');
        }
    }
    if (document.getElementById('obApiModePersonal') || document.getElementById('obApiModeShared')) {
        localStorage.setItem('lzhcard_api_mode', isPersonal ? 'personal' : 'shared');
    }
}

/**
 * 📍 步驟 1 轉 步驟 2：儲存語言偏好並即時更新全站多語系 UI
 */
function confirmOnboardingLanguageStep() {
    const nativeLang = document.getElementById('obNativeLang')?.value || 'zh-TW';
    const targetLang = document.getElementById('obTargetLang')?.value || 'en';

    localStorage.setItem('lzhcard_native_lang', nativeLang);
    localStorage.setItem('lzhcard_target_lang', targetLang);

    if (typeof applyLanguageUI === 'function') {
        applyLanguageUI();
    }
    if (typeof syncSettingsUI === 'function') {
        syncSettingsUI();
    }

    const step1 = document.getElementById('obStep1');
    const step2 = document.getElementById('obStep2');
    if (step1) step1.classList.add('hidden');
    if (step2) step2.classList.remove('hidden');

    toggleObApiKeyBox();
}

/**
 * 🔙 步驟 2 返回 步驟 1
 */
function backToOnboardingStep1() {
    const step1 = document.getElementById('obStep1');
    const step2 = document.getElementById('obStep2');
    if (step2) step2.classList.add('hidden');
    if (step1) step1.classList.remove('hidden');
}

/**
 * 1. 同意條款/登入後觸發：開啟新手客製化設定 Modal (重置回 Step 1)
 */
function startOnboardingFlow() {
    if (typeof closeModal === 'function') closeModal('welcomeModal');
    
    // 若已完成過新手設定則直接返回
    if (localStorage.getItem('lzhcard_onboarding_completed') === 'true') {
        return;
    }

    // 🛡️ 防止 Firebase 同步完成後重複觸發，導致使用者操作一半被重置回 Step 1 或共用 Key
    const setupModal = document.getElementById('onboardingSetupModal');
    if (setupModal && !setupModal.classList.contains('hidden')) {
        return;
    }

    let savedNative = localStorage.getItem('lzhcard_native_lang');
    if (!savedNative) {
        const navLang = (navigator.language || '').toLowerCase();
        if (navLang.startsWith('zh')) savedNative = 'zh-TW';
        else if (navLang.startsWith('ja')) savedNative = 'ja';
        else savedNative = 'en';
        localStorage.setItem('lzhcard_native_lang', savedNative);
    }

    if (typeof applyLanguageUI === 'function') {
        applyLanguageUI();
    }

    const step1 = document.getElementById('obStep1');
    const step2 = document.getElementById('obStep2');
    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');

    const nativeSelect = document.getElementById('obNativeLang');
    const targetSelect = document.getElementById('obTargetLang');
    const cardSelect = document.getElementById('obCardDisplayMode');
    const keyInput = document.getElementById('obApiKey');

    if (nativeSelect) nativeSelect.value = savedNative;
    if (targetSelect) targetSelect.value = localStorage.getItem('lzhcard_target_lang') || 'en';
    if (cardSelect) cardSelect.value = localStorage.getItem('lzhcard_display_mode') || 'target_front';
    
    const savedMode = localStorage.getItem('lzhcard_api_mode') || 'shared';
    const radShared = document.getElementById('obApiModeShared');
    const radPersonal = document.getElementById('obApiModePersonal');
    if (radShared) radShared.checked = (savedMode === 'shared');
    if (radPersonal) radPersonal.checked = (savedMode === 'personal');

    if (keyInput) keyInput.value = (typeof getValidApiKey === 'function') ? (getValidApiKey() || '') : '';

    toggleObApiKeyBox();

    if (typeof openModal === 'function') openModal('onboardingSetupModal');
}

/**
 * 2. 略過設定 Modal
 */
function skipOnboardingSetup() {
    localStorage.setItem('lzhcard_onboarding_completed', 'true');
    if (typeof saveStorage === 'function') saveStorage();
    if (typeof closeModal === 'function') closeModal('onboardingSetupModal');
    startInteractiveTour();
}

/**
 * 3. 儲存步驟 2 設定並上傳至 Firebase
 */
function saveOnboardingSetupAndContinue() {
    const nativeLang = document.getElementById('obNativeLang')?.value || 'zh-TW';
    const targetLang = document.getElementById('obTargetLang')?.value || 'en';
    const cardMode = document.getElementById('obCardDisplayMode')?.value || 'target_front';
    const apiKey = document.getElementById('obApiKey')?.value?.trim();

    const apiMode = document.querySelector('input[name="obApiMode"]:checked')?.value || 'shared';

    localStorage.setItem('lzhcard_native_lang', nativeLang);
    localStorage.setItem('lzhcard_target_lang', targetLang);
    localStorage.setItem('lzhcard_display_mode', cardMode);
    localStorage.setItem('lzhcard_api_mode', apiMode);

    if (apiMode === 'personal' && apiKey) {
        localStorage.setItem('flashcard_gemini_key_v1', apiKey);
    }

    localStorage.setItem('lzhcard_onboarding_completed', 'true');

    // 💾 立刻同步寫入 Firebase，確保雲端與本機一致
    if (typeof saveStorage === 'function') saveStorage();

    if (typeof applyLanguageUI === 'function') applyLanguageUI();
    if (typeof syncSettingsUI === 'function') syncSettingsUI();
    if (typeof updateApiKeyStatusUI === 'function') updateApiKeyStatusUI();

    if (typeof closeModal === 'function') closeModal('onboardingSetupModal');
    startInteractiveTour();
}

/**
 * 4. 開啟高亮聚焦導覽教學
 */
function startInteractiveTour() {
    if (typeof closeModal === 'function') closeModal('onboardingSetupModal');

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

    if (step.tab && typeof switchTab === 'function') {
        switchTab(step.tab);
    }

    const targetElem = document.getElementById(step.targetId);
    const highlightBox = document.getElementById('tourHighlightBox');
    const popover = document.getElementById('tourPopover');

    if (!targetElem || !highlightBox || !popover) return;

    const rect = targetElem.getBoundingClientRect();

    highlightBox.style.top = `${rect.top - 6}px`;
    highlightBox.style.left = `${rect.left - 6}px`;
    highlightBox.style.width = `${rect.width + 12}px`;
    highlightBox.style.height = `${rect.height + 12}px`;

    const badgeText = `${index + 1} / ${TOUR_STEPS.length}`;
    const titleText = (typeof t === 'function') ? t(step.titleKey) : step.titleKey;
    const descText = (typeof t === 'function') ? t(step.descKey) : step.descKey;

    const badgeElem = document.getElementById('tourStepBadge');
    const titleElem = document.getElementById('tourStepTitle');
    const descElem = document.getElementById('tourStepDesc');

    if (badgeElem) badgeElem.innerText = badgeText;
    if (titleElem) titleElem.innerText = titleText;
    if (descElem) descElem.innerText = descText;

    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const popoverHeight = popover.offsetHeight || 180;
    const popoverWidth = popover.offsetWidth || 320;

    let popoverTop = rect.bottom + 16;
    let popoverLeft = rect.left + (rect.width / 2) - (popoverWidth / 2);

    if (popoverTop + popoverHeight > windowHeight - 20) {
        popoverTop = rect.top - popoverHeight - 16;
    }

    if (popoverLeft < 10) popoverLeft = 10;
    if (popoverLeft + popoverWidth > windowWidth - 10) popoverLeft = windowWidth - popoverWidth - 10;

    popover.style.top = `${Math.max(10, popoverTop)}px`;
    popover.style.left = `${popoverLeft}px`;

    const prevBtn = document.getElementById('tourPrevBtn');
    const nextBtn = document.getElementById('tourNextBtn');

    if (prevBtn) prevBtn.disabled = (index === 0);

    if (nextBtn) {
        const finishText = (typeof t === 'function') ? t('btnFinishTour') : '完成導覽';
        const nextText = (typeof t === 'function') ? t('btnNextStep') : '下一步';

        if (index === TOUR_STEPS.length - 1) {
            nextBtn.innerText = finishText;
            nextBtn.className = "px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs";
        } else {
            nextBtn.innerHTML = `${nextText} <i class="fa-solid fa-chevron-right ml-1"></i>`;
            nextBtn.className = "px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition shadow-xs";
        }
    }
}

function prevTourStep() {
    if (currentTourIndex > 0) {
        currentTourIndex--;
        renderTourStep(currentTourIndex);
    }
}

function nextTourStep() {
    if (currentTourIndex < TOUR_STEPS.length - 1) {
        currentTourIndex++;
        renderTourStep(currentTourIndex);
    } else {
        finishTour();
    }
}

function finishTour() {
    const tourOverlay = document.getElementById('onboardingTourOverlay');
    if (tourOverlay) tourOverlay.classList.add('hidden');

    localStorage.setItem('lzhcard_onboarding_completed', 'true');
    if (typeof saveStorage === 'function') saveStorage();
    if (typeof switchTab === 'function') switchTab('home');
}
