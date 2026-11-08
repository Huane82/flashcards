/**
 * LZHCard - UI 語系與全介面 AI 翻譯引擎
 */

const I18N_DICTIONARY = {
    'zh-TW': {
        appSubtitle: "小考背單字神器",
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
        stockCount: "當前庫存:",
        flipHintFront: "點擊卡片翻面",
        flipHintBack: "點擊翻回正面",
        btnDontKnow: "不熟悉 (降級)",
        btnKnow: "已掌握",
        accuracyRate: "答對率:",
        quizMode1: "模式 1",
        quizMode2: "模式 2",
        quizMode3: "模式 3",
        quizMode1Ready: "模式 1 準備中",
        quizPromptTitle: "題目提示",
        quizInputPlaceholder: "在此輸入答案...",
        btnSubmit: "提交答案",
        btnNext: "下一題",
        btnAddWord: "新增單字",
        btnBatchImport: "批量匯入",
        btnBackup: "JSON 備份",
        btnSplit: "拆分",
        btnClear: "清空",
        lblSelectAll: "全選",
        btnRenameDeck: "重命名字庫",
        btnBatchMove: "移動字庫",
        btnBatchAi: "✨ AI 補齊",
        btnBatchDelete: "刪除",
        libAiProgressText: "AI 自動補充中...",
        optTargetFront: "🔤 目標語言在正面，母語在背面",
        optNativeFront: "🇹🇼 母語在正面，目標語言在背面",
        optBothFront: "✨ 正面同時顯示 (雙語對照)",
        
        guestMode: "訪客模式",
        notLinkedGoogle: "目前未連結 Google 帳號",
        btnLoginGoogle: "使用 Google 帳號登入",
        btnLogout: "登出帳號",

        sortDefault: "預設排序",
        sortAlphaAsc: "字母 (A ➔ Z)",
        sortAlphaDesc: "字母 (Z ➔ A)",
        sortPos: "詞性排序",
        sortLevelAsc: "等級 (Lv.1 ➔ 5)",
        sortLevelDesc: "等級 (Lv.5 ➔ 1)",

        themeSystem: "📱 跟隨系統",
        themeLight: "☀️ 亮色模式",
        themeDark: "🌙 夜間模式",

        searchPlaceholder: "搜尋單字、詞性、字庫或母語釋義...",
        catAll: "全部字庫",
        defaultCategoryName: "預設字庫",
        thCheck: "勾選",
        thWord: "單字 / 音標",
        thCategory: "字庫",
        thLevel: "等級",
        thMeaning: "母語釋義",
        thAction: "操作",
        emptySearchResult: "查無相關單字資料",
        emptyNoticeTitle: "目前選擇的字庫沒有單字！",
        emptyNoticeDesc: "您可以切換至「字庫管理」進行匯入或新增單字。",
        storeTitle: "官方單字庫商店",
        storeDesc: "免費下載與擴充主題單字庫",

        storeDevTitle: "開發中",
        storeDevDesc: "涵蓋大考中心 Level 1 ~ Level 6 全部單字。",
        btnGoPreset: "前往載入預設包",

        optCustomLang: "✏️ 自訂語言...",
        customTargetPlaceholder: "輸入自訂目標語言",
        btnSetKey: "設定 Key",

        // 彈窗 Modal
        modalCardTitle: "新增/編輯單字卡",
        lblFormCategory: "歸屬字庫/分類名稱",
        phFormCategory: "例如: 預設字庫 / 核心單字",
        lblFormWord: "目標語言單字 / 詞彙",
        phFormWord: "例如: resilient / 食べる",
        btnAiFill: "AI 自動帶入",
        lblFormPos: "詞性 (POS)",
        phFormPos: "例如: adj. / 動詞",
        lblFormPhonetic: "音標 / 讀音 (Phonetic)",
        phFormPhonetic: "例如: /rɪˈzɪl.jənt/ 或 たべる",
        lblFormMeaning: "母語釋義 / 翻譯",
        phFormMeaning: "例如: 有彈性的 / 吃 (可留空，交由 AI 自動補充)",
        lblFormSentence: "目標語言例句",
        phFormSentence: "例如: She is resilient enough to bounce back from failure.",
        lblFormTranslation: "例句母語翻譯",
        phFormTranslation: "例如: 她很有韌性，能從失敗中迅速振作起來。",
        btnSaveCard: "儲存卡片",
        btnCancel: "取消",

        modalBatchTitle: "批量貼上與 AI 智慧解析",
        batchPresetTitle: "一鍵載入高中 7000 單字庫 (大考中心 / 108 課綱分級)",
        lblBatchCategory: "匯入至此字庫名稱：",
        phBatchCategory: "例如: 高中 7000 單 L1",
        lblBatchRaw: "貼上原始文字庫資料：",
        phBatchRaw: "請在此貼上單字內容...\n\n例如：\napple n. 蘋果\nresilient /rɪˈzɪl.jənt/ [adj.] 很有韌性的",
        btnParseText: "解析貼入文字",
        lblBatchPreview: "解析預覽",
        btnBatchAiFill: "AI 批次補齊缺漏欄位",
        thBatchWord: "單字",
        thBatchPos: "詞性",
        thBatchMeaning: "母語釋義",
        thBatchStatus: "狀態",
        btnConfirmImport: "確認匯入至字庫",

        modalKeyTitle: "Gemini API Key 設定",
        modalKeyDesc: "輸入您的 Google Gemini API Key 以啟用自動生成單字音標、詞性、母語釋義及例句翻譯功能。",
        lblApiKeyInput: "API Key",
        btnSaveKey: "儲存金鑰",

        modalBackupTitle: "字庫 JSON 備份與還原",
        lblExport: "選擇匯出的字庫 (Export)",
        btnDownloadBackup: "下載 JSON 備份檔",
        lblImport: "還原字庫 (Import)",
        lblImportDesc: "上傳先前備份的 .json 檔案進行還原。",
        btnUploadImport: "匯入並更新字庫",

        modalSplitTitle: "批量拆分大字庫",
        modalSplitDesc: "選擇要拆分的大字庫，並輸入每個新字庫包含的單字上限。",
        lblSplitCategory: "選擇要拆分的目標字庫：",
        lblSplitChunkSize: "每個拆分小字庫的單字數量：",
        btnStartSplit: "開始拆分字庫",

        modalQuickAddTitle: "快速收錄生字",
        modalQuickAddDesc: "輸入例句中不會的單字（多個單字可以用逗號、空白或換行隔開），AI 將會在背景自動補充音標、詞性與母語釋義！",
        phQuickAddInput: "例如: resilient, fragile",
        btnQuickAddConfirm: "確定並 AI 自動填入",

        // 動態及狀態提示
        statusComplete: "完整",
        statusPending: "待補齊",
        btnRemove: "移除",
        titleRemove: "剔除此單字",
        noMeaning: "（無母語釋義）",
        noSentence: "無例句資訊",
        noWordAvailable: "無可用單字",
        selectOtherDeck: "請選擇其他字庫或匯入單字",
        unitItem: "筆",

        // JS 動態彈窗與 Toast 訊息
        toastCategoryNotFound: "⚠️ 找不到名為【{name}】的字庫！",
        toastRenameSuccess: "🎉 成功將【{oldName}】重新命名為【{newName}】（共 {count} 筆單字）！",
        toastSelectMoveWords: "請先勾選要變更字庫的單字！",
        toastMoveSuccess: "成功將 {count} 筆單字移至【{name}】！",
        toastSelectDeleteWords: "請先勾選要刪除的單字！",
        toastDeleteBatchSuccess: "批量刪除成功！",
        toastNoWordsToFill: "目前列表中無可補充的單字！",
        toastAllWordsComplete: "所選單字皆已具備完整資料！",
        toastBatchLimitExceeded: "待補齊單字共 {count} 筆，超過單次 50 筆限制！",
        toastBatchFillSuccess: "🎉 成功自動補齊 {count} 筆單字！",
        toastWordDeleted: "單字已刪除",
        toastDeckCleared: "字庫已清空",
        toastFillWordFirst: "請填寫單字！",
        toastCardSaved: "單字卡已儲存",
        toastCardAdded: "成功新增單字卡",
        toastEnterEnglishFirst: "請先輸入英文單字！",
        toastAiSingleSuccess: "AI 自動帶入完成",
        toastCdnFailed: "⚠️ 無法連線至字庫伺服器",
        toastLevelNotFound: "找不到 Level {level} 的單字資料。",
        toastPresetSuccess: "解析【{name}】共 {count} 筆單字成功！",
        toastPasteFirst: "請先貼入單字資料！",
        toastParseError: "無法解析輸入內容，請確認格式。",
        toastParseSuccess: "成功解析 {count} 筆單字",
        toastAiBatchSuccess: "AI 批量補充完成",
        toastNoExportWords: "當前選擇的字庫沒有單字可供匯出！",
        toastDownloadSuccess: "成功下載 {count} 筆單字 JSON 備份！",
        toastSelectJsonFirst: "請先選擇要還原的 .json 檔案！",
        toastJsonFormatError: "檔案格式錯誤：必須是單字陣列 JSON！",
        toastImportSuccess: "🎉 成功還原 {count} 筆單字！",
        toastImportSuccessDeDup: "🎉 成功處理 {count} 筆備份資料！(自動去重 {dedup} 筆重複字，實際更新 {actual} 個單字)",
        toastSelectSplitDeck: "請選擇要拆分的字庫！",
        toastSplitThreshold: "字庫單字量小於拆分門檻 ({size} 字)",
        toastSplitSuccess: "成功拆分為 {count} 個小字庫！",
        toastEnterApiKey: "請輸入有效的 Gemini API Key！",
        toastKeySaved: "🔑 Gemini API Key 已成功儲存並同步至雲端！",
        toastKeyLoaded: "🔑 已載入已儲存的 API Key",
        toastJsonParseError: "備份檔讀取失敗，請確認檔案內容格式！",
        toastEnterQuickWords: "請先輸入單字！",
        toastNoValidQuickWords: "未檢測到有效的單字內容！",
        toastQuickWordsExist: "輸入的單字已存在於字庫中！",
        toastQuickAddSuccess: "⚡ 已成功新增 {count} 個單字！",
        toastAiCompletionDone: "✨ AI 已完成單字音標與例句補充！",
        toastNativeLangUpdated: "母語設定已更新！",
        toastTargetLangUpdated: "學習目標語言已更新！",
        toastDisplayModeUpdated: "卡片顯示模式已更新！",
        toastInvalidApiKey: "⚠️ API Key 無效，請重新設定 Key！",
        toastRateLimit: "⚠️ 觸發 API 頻率限制，請稍後再試！",
        toastApiConnError: "⚠️ 無法連線至 Gemini API 端點！",
        toastNoApiKey: "尚未設定 API Key，請先設定！",

        promptSelectRenameDeck: "請輸入要重命名的字庫名稱：\n（可選字庫：{list}）",
        promptNewDeckName: "請輸入【{name}】字庫的新名稱：",
        promptMoveTarget: "將已選取的 {count} 筆單字移至新的字庫名稱：",
        confirmDeleteBatch: "確定要批量刪除已勾選的 {count} 筆單字嗎？此操作無法復原！",
        confirmBatchAiFill: "找到 {count} 筆缺漏欄位的單字，確定要讓 AI 自動補充嗎？",
        confirmDeleteSingle: "確定要刪除這張單字卡嗎？",
        confirmClearAll: "警告：此操作將清空全部單字庫，無法復原！確定要清空嗎？",
        confirmLoadPreset: "確定要載入【Level {level}】高中單字嗎？",
        modalTitleEdit: "編輯單字卡",
        modalTitleAdd: "新增單字卡",
        progressBatchAi: "AI 補充進度 ({current} / {total})...",
        progressAiComplete: "✨ 批量補充完成！",
        progressAiParsing: "AI 解析中...",
        btnDownloading: "下載中...",
        btnProcessing: "處理中..."
    },
    'en': {
        appSubtitle: "Exam Prep Flashcards",
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
        stockCount: "Current Total:",
        flipHintFront: "Click card to flip",
        flipHintBack: "Click to flip front",
        btnDontKnow: "Don't Know",
        btnKnow: "Mastered",
        accuracyRate: "Accuracy:",
        quizMode1: "Mode 1",
        quizMode2: "Mode 2",
        quizMode3: "Mode 3",
        quizMode1Ready: "Mode 1 Ready",
        quizPromptTitle: "Prompt",
        quizInputPlaceholder: "Type your answer here...",
        btnSubmit: "Submit",
        btnNext: "Next",
        btnAddWord: "Add Word",
        btnBatchImport: "Batch Import",
        btnBackup: "JSON Backup",
        btnSplit: "Split",
        btnClear: "Clear All",
        lblSelectAll: "Select All",
        btnRenameDeck: "Rename Deck",
        btnBatchMove: "Move Deck",
        btnBatchAi: "✨ AI Auto-fill",
        btnBatchDelete: "Delete",
        libAiProgressText: "AI auto-filling...",
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
        themeDark: "🌙 Dark Mode",

        searchPlaceholder: "Search words, POS, decks, or meanings...",
        catAll: "All Decks",
        defaultCategoryName: "Default Deck",
        thCheck: "Select",
        thWord: "Word / Phonetic",
        thCategory: "Deck",
        thLevel: "Level",
        thMeaning: "Definition",
        thAction: "Actions",
        emptySearchResult: "No matching words found",
        emptyNoticeTitle: "No words in the selected deck!",
        emptyNoticeDesc: "You can switch to 'Decks' to import or add words.",
        storeTitle: "Official Deck Store",
        storeDesc: "Free download and expansion of topic decks",

        storeDevTitle: "Under Development",
        storeDevDesc: "Covers all Level 1 - Level 6 vocabulary.",
        btnGoPreset: "Load Preset Packs",

        optCustomLang: "✏️ Custom...",
        customTargetPlaceholder: "Enter custom target language",
        btnSetKey: "Set Key",

        modalCardTitle: "Add / Edit Word Card",
        lblFormCategory: "Deck / Category Name",
        phFormCategory: "e.g., Default Deck / Core Words",
        lblFormWord: "Target Word / Vocabulary",
        phFormWord: "e.g., resilient / 食べる",
        btnAiFill: "AI Auto-Fill",
        lblFormPos: "Part of Speech (POS)",
        phFormPos: "e.g., adj. / verb",
        lblFormPhonetic: "Phonetic / Pronunciation",
        phFormPhonetic: "e.g., /rɪˈzɪl.jənt/ or たべる",
        lblFormMeaning: "Native Definition / Translation",
        phFormMeaning: "e.g., resilient / eat (Can leave empty for AI)",
        lblFormSentence: "Target Sentence",
        phFormSentence: "e.g., She is resilient enough to bounce back from failure.",
        lblFormTranslation: "Sentence Translation",
        phFormTranslation: "e.g., She is very resilient...",
        btnSaveCard: "Save Card",
        btnCancel: "Cancel",

        modalBatchTitle: "Batch Paste & AI Smart Parser",
        batchPresetTitle: "One-click Load High School 7000 Words",
        lblBatchCategory: "Import to Deck Name:",
        phBatchCategory: "e.g., High School 7000 L1",
        lblBatchRaw: "Paste Raw Text Data:",
        phBatchRaw: "Paste word content here...\n\ne.g.:\napple n. apple\nresilient /rɪˈzɪl.jənt/ [adj.] resilient",
        btnParseText: "Parse Text",
        lblBatchPreview: "Preview Parsed Results",
        btnBatchAiFill: "AI Batch Fill Missing Fields",
        thBatchWord: "Word",
        thBatchPos: "POS",
        thBatchMeaning: "Definition",
        thBatchStatus: "Status",
        btnConfirmImport: "Confirm Import to Deck",

        modalKeyTitle: "Gemini API Key Settings",
        modalKeyDesc: "Enter your Google Gemini API Key to enable auto-generation of phonetics, POS, definitions, and sentences.",
        lblApiKeyInput: "API Key",
        btnSaveKey: "Save Key",

        modalBackupTitle: "JSON Backup & Restore",
        lblExport: "Select Deck to Export",
        btnDownloadBackup: "Download JSON Backup",
        lblImport: "Restore Deck (Import)",
        lblImportDesc: "Upload a previously backed-up .json file to restore.",
        btnUploadImport: "Upload and Update Deck",

        modalSplitTitle: "Split Large Deck",
        modalSplitDesc: "Select a large deck to split and specify the maximum word limit per new deck.",
        lblSplitCategory: "Select Target Deck:",
        lblSplitChunkSize: "Words Per Split Deck:",
        btnStartSplit: "Start Splitting",

        modalQuickAddTitle: "Quick Add Words",
        modalQuickAddDesc: "Enter unfamiliar words (separated by commas, spaces, or newlines). AI will auto-fill phonetics, POS, and definitions in the background!",
        phQuickAddInput: "e.g., resilient, fragile",
        btnQuickAddConfirm: "Confirm & AI Auto-fill",

        statusComplete: "Complete",
        statusPending: "Pending",
        btnRemove: "Remove",
        titleRemove: "Remove this word",
        noMeaning: "(No definition)",
        noSentence: "No sentence available",
        noWordAvailable: "No words available",
        selectOtherDeck: "Please select another deck or import words",
        unitItem: "items",

        toastCategoryNotFound: "⚠️ Deck '{name}' not found!",
        toastRenameSuccess: "🎉 Renamed '{oldName}' to '{newName}' ({count} words)!",
        toastSelectMoveWords: "Please select words to move!",
        toastMoveSuccess: "Successfully moved {count} words to '{name}'!",
        toastSelectDeleteWords: "Please select words to delete!",
        toastDeleteBatchSuccess: "Batch delete successful!",
        toastNoWordsToFill: "No words to auto-fill in current list!",
        toastAllWordsComplete: "All selected words already have complete data!",
        toastBatchLimitExceeded: "Total {count} words pending, exceeding max limit of 50!",
        toastBatchFillSuccess: "🎉 Auto-filled {count} words!",
        toastWordDeleted: "Word deleted",
        toastDeckCleared: "Deck cleared",
        toastFillWordFirst: "Please enter a word!",
        toastCardSaved: "Word card saved",
        toastCardAdded: "Word card added successfully",
        toastEnterEnglishFirst: "Please enter a word first!",
        toastAiSingleSuccess: "AI auto-fill complete",
        toastCdnFailed: "⚠️ Failed to connect to dictionary server",
        toastLevelNotFound: "No vocabulary found for Level {level}.",
        toastPresetSuccess: "Parsed {count} words for '{name}' successfully!",
        toastPasteFirst: "Please paste word data first!",
        toastParseError: "Failed to parse input. Please check the format.",
        toastParseSuccess: "Successfully parsed {count} words",
        toastAiBatchSuccess: "AI batch auto-fill complete",
        toastNoExportWords: "No words in the selected deck to export!",
        toastDownloadSuccess: "Downloaded JSON backup of {count} words!",
        toastSelectJsonFirst: "Please select a .json file to restore!",
        toastJsonFormatError: "Invalid format: Must be a JSON array of words!",
        toastImportSuccess: "🎉 Restored {count} words!",
        toastImportSuccessDeDup: "🎉 Processed {count} items! (Removed {dedup} duplicates, updated {actual} unique words)",
        toastSelectSplitDeck: "Please select a deck to split!",
        toastSplitThreshold: "Deck size is smaller than split limit ({size} words)",
        toastSplitSuccess: "Successfully split into {count} smaller decks!",
        toastEnterApiKey: "Please enter a valid Gemini API Key!",
        toastKeySaved: "🔑 Gemini API Key saved and synced!",
        toastKeyLoaded: "🔑 Loaded saved API Key",
        toastJsonParseError: "Failed to read backup file. Please check format!",
        toastEnterQuickWords: "Please enter words!",
        toastNoValidQuickWords: "No valid words detected!",
        toastQuickWordsExist: "Entered words already exist in deck!",
        toastQuickAddSuccess: "⚡ Added {count} words successfully!",
        toastAiCompletionDone: "✨ AI auto-fill complete for phonetics and sentences!",
        toastNativeLangUpdated: "Native language updated!",
        toastTargetLangUpdated: "Target language updated!",
        toastDisplayModeUpdated: "Card display mode updated!",
        toastInvalidApiKey: "⚠️ Invalid API Key. Please re-configure!",
        toastRateLimit: "⚠️ Rate limit reached. Please try again later!",
        toastApiConnError: "⚠️ Cannot connect to Gemini API endpoint!",
        toastNoApiKey: "API Key not set. Please configure first!",

        promptSelectRenameDeck: "Enter the deck name to rename:\n(Available: {list})",
        promptNewDeckName: "Enter new name for deck '{name}':",
        promptMoveTarget: "Move selected {count} words to new deck name:",
        confirmDeleteBatch: "Are you sure you want to delete selected {count} words? This cannot be undone!",
        confirmBatchAiFill: "Found {count} words with missing fields. Let AI auto-fill them?",
        confirmDeleteSingle: "Are you sure you want to delete this card?",
        confirmClearAll: "Warning: This will clear all decks permanently! Are you sure?",
        confirmLoadPreset: "Are you sure you want to load High School Level {level} vocabulary?",
        modalTitleEdit: "Edit Word Card",
        modalTitleAdd: "Add Word Card",
        progressBatchAi: "AI progress ({current} / {total})...",
        progressAiComplete: "✨ Batch fill complete!",
        progressAiParsing: "AI parsing...",
        btnDownloading: "Downloading...",
        btnProcessing: "Processing..."
    },
    'ja': {
        appSubtitle: "単語暗記ツール",
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
        stockCount: "現在の登録数:",
        flipHintFront: "クリックで裏返す",
        flipHintBack: "クリックで表に戻る",
        btnDontKnow: "まだ覚えられない",
        btnKnow: "覚えた",
        accuracyRate: "正解率:",
        quizMode1: "モード 1",
        quizMode2: "モード 2",
        quizMode3: "モード 3",
        quizMode1Ready: "モード 1 準備中",
        quizPromptTitle: "問題ヒント",
        quizInputPlaceholder: "ここに回答を入力...",
        btnSubmit: "回答する",
        btnNext: "次の問題",
        btnAddWord: "単語を追加",
        btnBatchImport: "一括インポート",
        btnBackup: "バックアップ",
        btnSplit: "分割",
        btnClear: "全消去",
        lblSelectAll: "すべて選択",
        btnRenameDeck: "名前変更",
        btnBatchMove: "移動",
        btnBatchAi: "✨ AI補完",
        btnBatchDelete: "削除",
        libAiProgressText: "AI自動補完中...",
        optTargetFront: "🔤 表面：学習言語 / 裏面：母国語",
        optNativeFront: "🇹🇼 表面：母国語 / 裏面：学習言語",
        optBothFront: "✨ 表面：両方表示 (二言語対照)",

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
        themeDark: "🌙 ダークモード",

        searchPlaceholder: "単語、品詞、単語帳、意味を検索...",
        catAll: "すべての単語帳",
        defaultCategoryName: "デフォルト",
        thCheck: "選択",
        thWord: "単語 / 発音記号",
        thCategory: "単語帳",
        thLevel: "レベル",
        thMeaning: "意味",
        thAction: "操作",
        emptySearchResult: "該当する単語が見つかりません",
        emptyNoticeTitle: "選択した単語帳に単語がありません！",
        emptyNoticeDesc: "「単語帳管理」に切り替えて、単語をインポートまたは追加できます。",
        storeTitle: "公式単語帳ストア",
        storeDesc: "テーマ別単語帳を無料でダウンロード・拡張",

        storeDevTitle: "開発中",
        storeDevDesc: "Level 1 〜 Level 6 の全単語をカバー。",
        btnGoPreset: "プリセットパックを読み込む",

        optCustomLang: "✏️ カスタム...",
        customTargetPlaceholder: "カスタム学習言語を入力",
        btnSetKey: "APIキー設定",

        modalCardTitle: "単語カードの追加・編集",
        lblFormCategory: "所属単語帳/分類名",
        phFormCategory: "例: デフォルト / 核心単語",
        lblFormWord: "学習言語の単語・語彙",
        phFormWord: "例: resilient / 食べる",
        btnAiFill: "AI自動入力",
        lblFormPos: "品詞 (POS)",
        phFormPos: "例: adj. / 動詞",
        lblFormPhonetic: "発音記号・読み",
        phFormPhonetic: "例: /rɪˈzɪl.jənt/ または たべる",
        lblFormMeaning: "意味・翻訳",
        phFormMeaning: "例: しなやかな / 食べる (空欄でAI自動補完)",
        lblFormSentence: "例文 (学習言語)",
        phFormSentence: "例: She is resilient enough to bounce back from failure.",
        lblFormTranslation: "例文の翻訳 (母国語)",
        phFormTranslation: "例: 彼女はとてもしなやかだ...",
        btnSaveCard: "保存",
        btnCancel: "キャンセル",

        modalBatchTitle: "一括貼り付けとAI解析",
        batchPresetTitle: "高校7000単語を一括読み込み",
        lblBatchCategory: "インポート先の単語帳名：",
        phBatchCategory: "例: 高校7000単語 L1",
        lblBatchRaw: "テキストデータを貼り付け：",
        phBatchRaw: "ここに単語データを貼り付けてください...\n\n例：\napple n. りんご\nresilient /rɪˈzɪl.jənt/ [adj.] しなやかな",
        btnParseText: "解析",
        lblBatchPreview: "解析プレビュー",
        btnBatchAiFill: "AI未入力項目一括補完",
        thBatchWord: "単語",
        thBatchPos: "品詞",
        thBatchMeaning: "意味",
        thBatchStatus: "ステータス",
        btnConfirmImport: "インポート確定",

        modalKeyTitle: "Gemini API キー設定",
        modalKeyDesc: "Google Gemini APIキーを入力して、発音記号、品詞、意味、例文の自動生成機能を有効にします。",
        lblApiKeyInput: "API キー",
        btnSaveKey: "キーを保存",

        modalBackupTitle: "JSONバックアップと復元",
        lblExport: "エクスポートする単語帳を選択",
        btnDownloadBackup: "JSONダウンロード",
        lblImport: "単語帳を復元 (インポート)",
        lblImportDesc: "バックアップ済みの .json ファイルをアップロードして復元します。",
        btnUploadImport: "インポートして更新",

        modalSplitTitle: "大容量単語帳の分割",
        modalSplitDesc: "分割する単語帳を選択し、新しい単語帳1つあたりの上限単語数を指定してください。",
        lblSplitCategory: "分割対象の単語帳を選択：",
        lblSplitChunkSize: "1つの単語帳あたりの単語数：",
        btnStartSplit: "分割を開始",

        modalQuickAddTitle: "クイック単語追加",
        modalQuickAddDesc: "分からない単語を入力してください（カンマ、スペース、改行で区切り可能）。AIがバックグラウンドで発音記号、品詞、意味を自動補完します！",
        phQuickAddInput: "例: resilient, fragile",
        btnQuickAddConfirm: "確定してAI自動入力",

        statusComplete: "完了",
        statusPending: "未完了",
        btnRemove: "削除",
        titleRemove: "この単語を削除",
        noMeaning: "（意味未入力）",
        noSentence: "例文なし",
        noWordAvailable: "利用可能な単語がありません",
        selectOtherDeck: "他の単語帳を選択するか単語を追加してください",
        unitItem: "件",

        toastCategoryNotFound: "⚠️ 「{name}」という単語帳が見つかりません！",
        toastRenameSuccess: "🎉 「{oldName}」を「{newName}」に名前変更しました（計 {count} 件）！",
        toastSelectMoveWords: "移動する単語を選択してください！",
        toastMoveSuccess: "{count} 件の単語を「{name}」に移動しました！",
        toastSelectDeleteWords: "削除する単語を選択してください！",
        toastDeleteBatchSuccess: "一括削除が完了しました！",
        toastNoWordsToFill: "補完できる単語がリストにありません！",
        toastAllWordsComplete: "選択した単語はすべて入力済みです！",
        toastBatchLimitExceeded: "未入力単語が {count} 件あり、一度の上限50件を超えています！",
        toastBatchFillSuccess: "🎉 {count} 件の単語を自動補完しました！",
        toastWordDeleted: "単語を削除しました",
        toastDeckCleared: "単語帳を消去しました",
        toastFillWordFirst: "単語を入力してください！",
        toastCardSaved: "カードを保存しました",
        toastCardAdded: "カードを追加しました",
        toastEnterEnglishFirst: "先に単語を入力してください！",
        toastAiSingleSuccess: "AI自動入力が完了しました",
        toastCdnFailed: "⚠️ 単語サーバーに接続できません",
        toastLevelNotFound: "Level {level} の単語データが見つかりません。",
        toastPresetSuccess: "「{name}」から {count} 件の単語を解析しました！",
        toastPasteFirst: "先に単語データを貼り付けてください！",
        toastParseError: "解析できませんでした。形式を確認してください。",
        toastParseSuccess: "{count} 件の単語を解析しました",
        toastAiBatchSuccess: "AI一括補完が完了しました",
        toastNoExportWords: "エクスポートする単語がありません！",
        toastDownloadSuccess: "{count} 件のJSONバックアップをダウンロードしました！",
        toastSelectJsonFirst: "復元する .json ファイルを選択してください！",
        toastJsonFormatError: "形式エラー：単語のJSON配列である必要があります！",
        toastImportSuccess: "🎉 {count} 件の単語を復元しました！",
        toastImportSuccessDeDup: "🎉 {count} 件処理しました！（重複 {dedup} 件を除去、{actual} 件更新）",
        toastSelectSplitDeck: "分割する単語帳を選択してください！",
        toastSplitThreshold: "単語数が分割上限（{size}件）以下です",
        toastSplitSuccess: "{count} 個の単語帳に分割しました！",
        toastEnterApiKey: "有効な Gemini API キーを入力してください！",
        toastKeySaved: "🔑 Gemini API キーを保存しました！",
        toastKeyLoaded: "🔑 保存済み API キーを読み込みました",
        toastJsonParseError: "バックアップファイルの読み込みに失敗しました！",
        toastEnterQuickWords: "単語を入力してください！",
        toastNoValidQuickWords: "有効な単語が検出されませんでした！",
        toastQuickWordsExist: "入力した単語は既に存在します！",
        toastQuickAddSuccess: "⚡ {count} 件の単語を追加しました！",
        toastAiCompletionDone: "✨ AIによる補完が完了しました！",
        toastNativeLangUpdated: "母国語を設定しました！",
        toastTargetLangUpdated: "学習言語を設定しました！",
        toastDisplayModeUpdated: "表示モードを変更しました！",
        toastInvalidApiKey: "⚠️ 無効な API キーです！",
        toastRateLimit: "⚠️ リクエスト制限に達しました！",
        toastApiConnError: "⚠️ Gemini API に接続できません！",
        toastNoApiKey: "API キーが設定されていません！",

        promptSelectRenameDeck: "名前を変更する単語帳名を入力してください：\n（候補: {list}）",
        promptNewDeckName: "「{name}」の新しい名前を入力してください：",
        promptMoveTarget: "選択した {count} 件の単語の移動先を入力：",
        confirmDeleteBatch: "選択した {count} 件の単語を削除しますか？元に戻せません！",
        confirmBatchAiFill: "未入力欄のある単語が {count} 件あります。AIで自動補完しますか？",
        confirmDeleteSingle: "この単語カードを削除しますか？",
        confirmClearAll: "警告：すべての単語帳が削除されます！実行しますか？",
        confirmLoadPreset: "【Level {level}】の単語を読み込みますか？",
        modalTitleEdit: "カードを編集",
        modalTitleAdd: "カードを追加",
        progressBatchAi: "AI補完中 ({current} / {total})...",
        progressAiComplete: "✨ 一括補完が完了しました！",
        progressAiParsing: "AI解析中...",
        btnDownloading: "ダウンロード中...",
        btnProcessing: "処理中..."
    }
};

/**
 * 🌐 全域多語言翻譯與變數替換輔助函式
 */
function t(key, params = {}) {
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

    let text = dict[key] || I18N_DICTIONARY['zh-TW'][key] || key;

    // 自動做動態變數替換 (如 {name}, {count})
    Object.keys(params).forEach(p => {
        text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
    });

    return text;
}

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

    // 1. 翻譯普通標籤文字 (data-i18n)
    document.querySelectorAll('[data-i18n]').forEach(elem => {
        const key = elem.getAttribute('data-i18n');
        if (dict[key]) {
            elem.innerText = dict[key];
        }
    });

    // 2. 翻譯輸入框預設文字 (data-i18n-placeholder)
    document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
        const key = elem.getAttribute('data-i18n-placeholder');
        if (dict[key]) {
            elem.setAttribute('placeholder', dict[key]);
        }
    });

    // 3. 同步刷新字庫下拉選單的語系與單位
    if (typeof updateCategorySelects === 'function') {
        updateCategorySelects();
    }
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