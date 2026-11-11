/**
 * LZHCard - 多語系、顯示模式、主題與系統設定模組 (settings.js)
 */

const API_KEY_STORAGE_NAME = typeof STORAGE_KEY_APIKEY !== 'undefined' ? STORAGE_KEY_APIKEY : 'flashcard_gemini_key_v1';

/**
 * 🎨 變更主題設定 (light / dark / system)
 */
function handleThemeChange(mode) {
    localStorage.setItem('theme_preference', mode);
    applyTheme(mode);
    if (typeof saveStorage === 'function') saveStorage();
}

/**
 * 🌓 依據模式套用主題至 <html> DOM
 */
function applyTheme(mode) {
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (mode === 'dark' || (mode === 'system' && isSystemDark)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

// 監聽系統深色模式變更
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const preference = localStorage.getItem('theme_preference') || 'system';
    if (preference === 'system') {
        applyTheme('system');
    }
});

/**
 * 🔄 同步設定頁面 UI 狀態
 */
function syncSettingsUI() {
    const savedNative = localStorage.getItem('lzhcard_native_lang') || 'zh-TW';
    const savedTarget = localStorage.getItem('lzhcard_target_lang') || 'en';
    const customNative = localStorage.getItem('lzhcard_custom_native') || '';
    const customTarget = localStorage.getItem('lzhcard_custom_target') || '';
    const savedDisplayMode = localStorage.getItem('lzhcard_display_mode') || 'target_front';
    const savedPhoneticPos = localStorage.getItem('lzhcard_phonetic_pos') || 'front';
    const savedTheme = localStorage.getItem('theme_preference') || 'system';

    const nativeSelect = document.getElementById('nativeLangSelect');
    if (nativeSelect) nativeSelect.value = savedNative;

    const targetSelect = document.getElementById('targetLangSelect');
    if (targetSelect) targetSelect.value = savedTarget;

    const displaySelect = document.getElementById('cardDisplayModeSelect');
    if (displaySelect) displaySelect.value = savedDisplayMode;

    const phoneticPosSelect = document.getElementById('phoneticPosSelect');
    if (phoneticPosSelect) phoneticPosSelect.value = savedPhoneticPos;

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = savedTheme;

    const customNativeInput = document.getElementById('customNativeInput');
    if (customNativeInput) {
        customNativeInput.value = customNative;
        customNativeInput.classList.toggle('hidden', savedNative !== 'custom');
    }

    const customTargetInput = document.getElementById('customTargetInput');
    if (customTargetInput) {
        customTargetInput.value = customTarget;
        customTargetInput.classList.toggle('hidden', savedTarget !== 'custom');
    }

    // 同步暱稱輸入框
    const nicknameInput = document.getElementById('settingsNicknameInput');
    if (nicknameInput && window.userData && window.userData.nickname) {
        nicknameInput.value = window.userData.nickname;
    }

    // 🟢 同步「隱藏線上狀態與已讀」切換開關 (privacyStatusToggle)
    const privacyToggle = document.getElementById('privacyStatusToggle');
    if (privacyToggle) {
        privacyToggle.checked = !!(window.userData && window.userData.privacyHideStatus);
    }
}

/**
 * 🌐 初始化系統語言設定
 */
function initLanguageSettings() {
    if (!localStorage.getItem('lzhcard_native_lang')) {
        const navLang = (navigator.language || '').toLowerCase();
        if (navLang.startsWith('zh')) {
            localStorage.setItem('lzhcard_native_lang', 'zh-TW');
        } else if (navLang.startsWith('ja')) {
            localStorage.setItem('lzhcard_native_lang', 'ja');
        } else {
            localStorage.setItem('lzhcard_native_lang', 'en');
        }
    }

    if (!localStorage.getItem('lzhcard_target_lang')) {
        localStorage.setItem('lzhcard_target_lang', 'en');
    }

    syncSettingsUI();

    if (typeof updateBatchPlaceholders === 'function') {
        updateBatchPlaceholders();
    }

    if (typeof applyLanguageUI === 'function') {
        applyLanguageUI();
    }
}

/**
 * 🗣️ 切換母語設定
 */
function handleNativeLangChange(lang) {
    localStorage.setItem('lzhcard_native_lang', lang);
    syncSettingsUI();

    if (typeof applyLanguageUI === 'function') {
        applyLanguageUI();
    }

    if (typeof showToast === 'function') showToast(t('toastNativeLangUpdated'), 'info');
    if (typeof saveStorage === 'function') saveStorage();
}

/**
 * 🎯 切換學習目標語言
 */
function handleTargetLangChange(lang) {
    localStorage.setItem('lzhcard_target_lang', lang);
    syncSettingsUI();

    if (typeof updateBatchPlaceholders === 'function') {
        updateBatchPlaceholders();
    }

    if (typeof showToast === 'function') showToast(t('toastTargetLangUpdated'), 'info');
    if (typeof saveStorage === 'function') saveStorage();
}

/**
 * ✍️ 處理自訂語言變更
 */
function handleCustomLangChange(type, value) {
    const cleanValue = value.trim();
    if (type === 'native') {
        localStorage.setItem('lzhcard_custom_native', cleanValue);
        if (cleanValue && typeof translateUiWithAI === 'function') {
            translateUiWithAI(cleanValue);
        }
    } else if (type === 'target') {
        localStorage.setItem('lzhcard_custom_target', cleanValue);
    }
    if (typeof saveStorage === 'function') saveStorage();
}

/**
 * 🎴 切換卡片正面顯示模式 (外文 / 母語 / 雙語)
 */
function handleCardDisplayModeChange(mode) {
    localStorage.setItem('lzhcard_display_mode', mode);
    if (typeof updateUI === 'function') updateUI();
    if (typeof nextCard === 'function') nextCard();
    if (typeof showToast === 'function') showToast(t('toastDisplayModeUpdated'), 'success');
    if (typeof saveStorage === 'function') saveStorage();
}

/**
 * 🔤 切換音標 / 讀音顯示位置 (正面 / 背面)
 */
function handlePhoneticPosChange(mode) {
    localStorage.setItem('lzhcard_phonetic_pos', mode);
    if (typeof updateUI === 'function') updateUI();
    if (typeof nextCard === 'function') nextCard();
    if (typeof showToast === 'function') {
        const msgKey = mode === 'back' ? 'toastPhoneticBack' : 'toastPhoneticFront';
        showToast(t(msgKey), 'info');
    }
    if (typeof saveStorage === 'function') saveStorage();
}

/**
 * 🎛️ 切換 Gemini API 金鑰模式 (personal / shared)
 */
function switchApiMode(mode) {
    localStorage.setItem('lzhcard_api_mode', mode);
    const box = document.getElementById('personalKeyInputBox');
    if (box) {
        if (mode === 'shared') {
            box.classList.add('hidden');
        } else {
            box.classList.remove('hidden');
        }
    }
    if (typeof updateApiKeyStatusUI === 'function') {
        updateApiKeyStatusUI();
    }
}

/**
 * 🔑 儲存 Gemini API Key (支援個人 Key / 免費共用 Key 雙軌存檔)
 */
function handleSaveApiKey() {
    const selectedMode = document.querySelector('input[name="apiMode"]:checked')?.value || 'personal';
    localStorage.setItem('lzhcard_api_mode', selectedMode);

    if (selectedMode === 'personal') {
        const keyInput = document.getElementById('geminiApiKeyInput');
        const key = keyInput ? keyInput.value.trim() : '';
        if (!key) {
            if (typeof showToast === 'function') showToast(t('toastEnterApiKey') || '請輸入個人 API Key！', 'warning');
            return;
        }
        localStorage.setItem(API_KEY_STORAGE_NAME, key);
    }

    if (typeof updateApiKeyStatusUI === 'function') {
        updateApiKeyStatusUI();
    }

    if (typeof saveStorage === 'function') {
        saveStorage();
    }

    if (typeof closeModal === 'function') closeModal('keyModal');
    if (typeof showToast === 'function') showToast(t('toastKeySaved') || '設定已儲存！', 'success');
}

/* ==========================================================================
   🔒 登入門檻與服務條款 (TOS) 控制邏輯
   ========================================================================== */

function toggleAuthButtons() {
    const isChecked = document.getElementById('tosCheckbox')?.checked || false;
    const googleBtn = document.getElementById('welcomeGoogleBtn');
    const guestBtn = document.getElementById('welcomeGuestBtn');

    if (googleBtn) {
        googleBtn.disabled = !isChecked;
        if (isChecked) {
            googleBtn.className = "w-full py-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition border border-slate-300 dark:border-slate-600 shadow-sm cursor-pointer";
        } else {
            googleBtn.className = "w-full py-3 bg-slate-200 dark:bg-slate-700 text-slate-400 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-not-allowed opacity-60";
        }
    }

    if (guestBtn) {
        guestBtn.disabled = !isChecked;
        if (isChecked) {
            guestBtn.className = "w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition shadow-sm cursor-pointer";
        } else {
            guestBtn.className = "w-full py-3 bg-slate-200 dark:bg-slate-700 text-slate-400 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-not-allowed opacity-60";
        }
    }
}

function handleWelcomeGoogleLogin() {
    const isChecked = document.getElementById('tosCheckbox')?.checked;
    if (!isChecked) {
        if (typeof showToast === 'function') showToast('請先勾選同意服務與隱私條款！', 'warning');
        return;
    }
    localStorage.setItem('lzhcard_tos_accepted', 'true');
    if (typeof loginWithGoogle === 'function') {
        loginWithGoogle();
    }
}

function handleWelcomeGuestLogin() {
    const isChecked = document.getElementById('tosCheckbox')?.checked;
    if (!isChecked) {
        if (typeof showToast === 'function') showToast('請先勾選同意服務與隱私條款！', 'warning');
        return;
    }
    localStorage.setItem('lzhcard_tos_accepted', 'true');
    localStorage.setItem('lzhcard_guest_mode', 'true');
    
    if (window.userData) {
        window.userData.username = '訪客玩家';
        window.userData.role = 'user';
        if (typeof saveUserData === 'function') saveUserData();
    }

    closeWelcomeModal();
    
    // 🚀 關鍵修復：關閉歡迎彈窗後，立刻檢查並開啟新手設定/導覽
    if (typeof checkOnboardingStatus === 'function') {
        checkOnboardingStatus();
    } else if (typeof startInteractiveTour === 'function') {
        startInteractiveTour();
    }

    if (typeof showToast === 'function') showToast('已以訪客身份進入系統！', 'success');
}

function closeWelcomeModal() {
    const modal = document.getElementById('welcomeModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function openWelcomeModal() {
    const modal = document.getElementById('welcomeModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function checkAuthAndTosState() {
    const tosAccepted = localStorage.getItem('lzhcard_tos_accepted') === 'true';
    const isGuest = localStorage.getItem('lzhcard_guest_mode') === 'true';

    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                closeWelcomeModal();
                syncSettingsUI();

                // 🚀 關鍵修復：登入成功後，立刻檢查並開啟新手設定/導覽
                if (typeof checkOnboardingStatus === 'function') {
                    checkOnboardingStatus();
                }
            } else if (isGuest && tosAccepted) {
                closeWelcomeModal();
            } else {
                openWelcomeModal();
            }
        });
    } else {
        if (isGuest && tosAccepted) {
            closeWelcomeModal();
        } else {
            openWelcomeModal();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initLanguageSettings();

    const preference = localStorage.getItem('theme_preference') || 'system';
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = preference;
    applyTheme(preference);

    checkAuthAndTosState();

    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(() => {
            if (typeof applyLanguageUI === 'function') applyLanguageUI();
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initLanguageSettings();

    const preference = localStorage.getItem('theme_preference') || 'system';
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = preference;
    applyTheme(preference);

    // 🎛️ 初始化 API 金鑰模式 (預設為 shared 免費共用模式)
    const savedApiMode = localStorage.getItem('lzhcard_api_mode') || 'shared';
    const radShared = document.getElementById('apiModeShared');
    const radPersonal = document.getElementById('apiModePersonal');
    if (savedApiMode === 'shared' && radShared) radShared.checked = true;
    if (savedApiMode === 'personal' && radPersonal) radPersonal.checked = true;
    switchApiMode(savedApiMode);

    checkAuthAndTosState();

    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(() => {
            if (typeof applyLanguageUI === 'function') applyLanguageUI();
        });
    }
});