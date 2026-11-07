/**
 * LZHCard - UI 語系與全介面 AI 翻譯引擎
 */

const I18N_DICTIONARY = {
    'zh-TW': {
        navHome: "主頁",
        navList: "字庫管理",
        navStore: "字庫商店",
        navSettings: "設定",
        homeTitle: "選擇學習模式",
        homeDesc: "專注背單字，高效提升記憶力",
        modeFlashcard: "卡片輪播",
        modeFlashcardDesc: "5 級艾賓浩斯記憶權重與焦點池演算法",
        modeQuiz: "隨堂測驗",
        modeQuizDesc: "拼字、詞性變化與拼寫上下文挑戰",
        btnStartFocus: "開啟專注輪播",
        btnStartQuiz: "進入測驗",
        settingsTitle: "帳號與系統設定",
        settingsDesc: "管理您的個人資料、學習偏好、外觀主題與 API 金鑰",
        lblNativeLang: "使用者母語 (Native Language)",
        descNativeLang: "系統已依據您的裝置語言自動判定",
        lblTargetLang: "學習目標語言 (Target Language)",
        descTargetLang: "選擇 AI 自動解析單字與例句時的語言",
        lblDisplayMode: "卡片正面顯示模式",
        descDisplayMode: "可自由切換母語/外語在正面或同時顯示",
        lblTheme: "外觀主題設定",
        descTheme: "可手動切換或跟隨手機系統預設",
        lblApiKey: "Gemini AI Key",
        descApiKey: "用於自動帶入音標與例句",
        btnExit: "退出模式",
        btnQuickAdd: "快速記生字",
        btnDontKnow: "不熟悉 (降級)",
        btnKnow: "已掌握",
        btnSubmit: "提交答案",
        btnNext: "下一題",
        btnAddWord: "新增單字",
        btnBatchImport: "批量匯入",
        btnBackup: "JSON 備份",
        btnSplit: "拆分",
        btnClear: "清空",
        lblSelectAll: "全選",
        btnBatchMove: "移動字庫",
        btnBatchAi: "✨ AI 補齊",
        btnBatchDelete: "刪除",
        optTargetFront: "🔤 目標語言在正面，母語在背面",
        optNativeFront: "🇹🇼 母語在正面，目標語言在背面",
        optBothFront: "✨ 正面同時顯示 (雙語對照)",
        
        // 🌟 新增：登入/登出與狀態文字
        guestMode: "訪客模式",
        notLinkedGoogle: "目前未連結 Google 帳號",
        btnLoginGoogle: "使用 Google 帳號登入",
        btnLogout: "登出帳號",

        // 🌟 新增：字庫排序選單
        sortDefault: "預設排序",
        sortAlphaAsc: "字母 (A ➔ Z)",
        sortAlphaDesc: "字母 (Z ➔ A)",
        sortPos: "詞性排序",
        sortLevelAsc: "等級 (Lv.1 ➔ 5)",
        sortLevelDesc: "等級 (Lv.5 ➔ 1)",

        // 🌟 新增：外觀主題選單
        themeSystem: "📱 跟隨系統",
        themeLight: "☀️ 亮色模式",
        themeDark: "🌙 夜間模式"
    },
    'en': {
        navHome: "Home",
        navList: "Decks",
        navStore: "Store",
        navSettings: "Settings",
        homeTitle: "Select Study Mode",
        homeDesc: "Focus on words and boost your memory effectively",
        modeFlashcard: "Flashcards",
        modeFlashcardDesc: "5-level Ebbinghaus repetition & focus pool algorithm",
        modeQuiz: "Quiz Mode",
        modeQuizDesc: "Spelling, parts of speech & context recall challenges",
        btnStartFocus: "Start Flashcards",
        btnStartQuiz: "Start Quiz",
        settingsTitle: "Settings",
        settingsDesc: "Manage your profile, preferences, themes & API key",
        lblNativeLang: "Native Language",
        descNativeLang: "Auto-detected based on your device language",
        lblTargetLang: "Target Learning Language",
        descTargetLang: "Language used for AI auto-generating definitions & sentences",
        lblDisplayMode: "Card Front Display",
        descDisplayMode: "Switch native/target on front or show both",
        lblTheme: "Appearance Theme",
        descTheme: "Switch manually or follow system default",
        lblApiKey: "Gemini AI Key",
        descApiKey: "Used for auto-generating phonetics & sentences",
        btnExit: "Exit Mode",
        btnQuickAdd: "Quick Add",
        btnDontKnow: "Don't Know",
        btnKnow: "Mastered",
        btnSubmit: "Submit",
        btnNext: "Next",
        btnAddWord: "Add Word",
        btnBatchImport: "Batch Import",
        btnBackup: "JSON Backup",
        btnSplit: "Split",
        btnClear: "Clear All",
        lblSelectAll: "Select All",
        btnBatchMove: "Move Deck",
        btnBatchAi: "✨ AI Auto-fill",
        btnBatchDelete: "Delete",
        optTargetFront: "🔤 Target Front, Native Back",
        optNativeFront: "🇹🇼 Native Front, Target Back",
        optBothFront: "✨ Both Front (Bilingual)",
        
        guestMode: "Guest Mode",
        notLinkedGoogle: "Google Account not linked",
        btnLoginGoogle: "Sign in with Google",
        btnLogout: "Log Out",

        sortDefault: "Default Sort",
        sortAlphaAsc: "Alphabetical (A ➔ Z)",
        sortAlphaDesc: "Alphabetical (Z ➔ A)",
        sortPos: "By Part of Speech",
        sortLevelAsc: "Level (Lv.1 ➔ 5)",
        sortLevelDesc: "Level (Lv.5 ➔ 1)",

        themeSystem: "📱 System Default",
        themeLight: "☀️ Light Mode",
        themeDark: "🌙 Dark Mode"
    },
    'ja': {
        navHome: "ホーム",
        navList: "単語帳管理",
        navStore: "ストア",
        navSettings: "設定",
        homeTitle: "学習モードを選択",
        homeDesc: "効率的に記憶力を高めましょう",
        modeFlashcard: "カードめくり",
        modeFlashcardDesc: "エビングハウス忘却曲線に基づいた学習",
        modeQuiz: "小テスト",
        modeQuizDesc: "スペルと文脈理解のクイズ",
        btnStartFocus: "カード学習を開始",
        btnStartQuiz: "テストを開始",
        settingsTitle: "アカウントと設定",
        settingsDesc: "個人設定、テーマ、APIキーの管理",
        lblNativeLang: "母国語 (Native Language)",
        descNativeLang: "端末の言語設定に基づいて自動判定されています",
        lblTargetLang: "学習言語 (Target Language)",
        descTargetLang: "AIが単語や例文を解析する際に使用する言語",
        lblDisplayMode: "表面の表示モード",
        descDisplayMode: "表面に母国語・学習言語のどちらを表示するか切替",
        lblTheme: "テーマ設定",
        descTheme: "手動切り替えまたはシステム設定に従う",
        lblApiKey: "Gemini API キー",
        descApiKey: "発音記号や例文の自動生成に使用",
        btnExit: "終了",
        btnQuickAdd: "クイック追加",
        btnDontKnow: "まだ覚えられない",
        btnKnow: "覚えた",
        btnSubmit: "回答する",
        btnNext: "次の問題",
        btnAddWord: "単語を追加",
        btnBatchImport: "一括インポート",
        btnBackup: "バックアップ",
        btnSplit: "分割",
        btnClear: "全消去",
        lblSelectAll: "すべて選択",
        btnBatchMove: "移動",
        btnBatchAi: "✨ AI補完",
        btnBatchDelete: "削除",
        optTargetFront: "🔤 表面：学習言語 / 裏面：母国語",
        optNativeFront: "🇹🇼 表面：母国語 / 裏面：学習言語",
        optBothFront: "✨ 表面：両方表示 (二言語對照)",

        guestMode: "ゲストモード",
        notLinkedGoogle: "Googleアカウント未連携",
        btnLoginGoogle: "Googleでログイン",
        btnLogout: "ログアウト",

        sortDefault: "デフォルト順",
        sortAlphaAsc: "アルファベット順 (A ➔ Z)",
        sortAlphaDesc: "アルファベット順 (Z ➔ A)",
        sortPos: "品詞順",
        sortLevelAsc: "レベル順 (Lv.1 ➔ 5)",
        sortLevelDesc: "レベル逆順 (Lv.5 ➔ 1)",

        themeSystem: "📱 システムに従う",
        themeLight: "☀️ ライトモード",
        themeDark: "🌙 ダークモード"
    }
};

/**
 * 更新 DOM 元素 UI 語言
 */
function applyLanguageUI() {
    const nativeLang = localStorage.getItem('lzhcard_native_lang') || 'zh-TW';
    const customNative = localStorage.getItem('lzhcard_custom_native') || '';

    let dict = I18N_DICTIONARY[nativeLang];

    if (nativeLang === 'custom' && customNative) {
        const cached = localStorage.getItem(`lzhcard_ui_dict_${customNative}`);
        if (cached) {
            try { dict = JSON.parse(cached); } catch (e) {}
        }
    }

    if (!dict) dict = I18N_DICTIONARY['zh-TW'];

    document.querySelectorAll('[data-i18n]').forEach(elem => {
        const key = elem.getAttribute('data-i18n');
        if (dict[key]) {
            elem.innerText = dict[key];
        }
    });
}

/**
 * AI 翻譯介面為自訂母語
 */
async function translateUiWithAI(customLangName) {
    if (!customLangName) return;
    const rawKey = (typeof getValidApiKey === 'function') ? getValidApiKey() : null;
    if (!rawKey) return;

    if (typeof showToast === 'function') showToast(`🤖 AI 正在將 UI 介面翻譯為「${customLangName}」...`, "info");

    const sourceDict = I18N_DICTIONARY['zh-TW'];
    const prompt = `Translate all JSON string values from Traditional Chinese to "${customLangName}". 
Keep JSON keys identical.
Source: ${JSON.stringify(sourceDict)}
Return ONLY valid JSON.`;

    try {
        const apiUrl = buildGeminiUrl(rawKey);
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (res.ok) {
            const data = await res.json();
            let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const translatedDict = safeParseJSON(rawText);
            if (translatedDict) {
                localStorage.setItem(`lzhcard_ui_dict_${customLangName}`, JSON.stringify(translatedDict));
                applyLanguageUI();
                if (typeof showToast === 'function') showToast(`✨ 介面已翻譯為「${customLangName}」！`, "success");
            }
        }
    } catch (e) {
        console.error("AI UI 翻譯失敗:", e);
    }
}

document.addEventListener('DOMContentLoaded', applyLanguageUI);