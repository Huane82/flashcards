/**
 * LZHCard - UI 語系與全介面 AI 翻譯引擎 (js/i18n.js)
 */

const I18N_DICTIONARY = {
    'zh-TW': {
        // 頂部與導覽
        appSubtitle: "小考背單字神器",
        navHome: "主頁",
        navList: "字庫管理",
        navStore: "字庫商店",
        navStats: "統計",
        navSettings: "設定",
        catAll: "全部字庫",
        defaultCategoryName: "預設字庫",
        categoryDropdownBtnText: "未選取字庫",
        noCategorySelected: "未選取字庫",
        selectedPrefix: "已選",
        unitDeck: "個字庫",

        // 主頁 View
        homeTitle: "選擇學習模式",
        homeDesc: "專注背單字，高效提升記憶力",
        modeFlashcard: "卡片輪播",
        modeFlashcardDesc: "5 級艾賓浩斯記憶權重與焦點池演算法",
        modeQuiz: "隨堂測驗",
        modeQuizDesc: "拼字、詞性變化與拼寫上下文挑戰",
        btnStartFocus: "開啟專注輪播",
        btnStartQuiz: "進入測驗",

        // 專注與測驗 View
        btnExit: "退出模式",
        btnQuickAdd: "快速填入",
        stockCount: "當前庫存:",
        flipHintFront: "點擊卡片翻面",
        flipHintBack: "點擊翻回正面",
        btnDontKnow: "不熟悉 (降級)",
        btnKnow: "已掌握",
        accuracyRate: "精熟率:",
        quizMode1: "模式 1",
        quizMode2: "模式 2",
        quizMode3: "模式 3",
        quizMode1Ready: "模式 1 準備中",
        quizPromptTitle: "題目提示",
        quizInputPlaceholder: "在此輸入答案...",
        btnSubmit: "提交答案",
        btnNext: "下一題",

        // 字庫管理 View
        btnAddWord: "個別填入",
        btnBatchImport: "批量單字",
        btnBackup: "JSON 備份",
        btnSplit: "拆分",
        btnClear: "清空",
        lblSelectAll: "全選",
        btnRenameDeck: "重命名字庫",
        btnBatchMove: "移動字庫",
        btnBatchAi: "✨ AI 補齊",
        btnBatchDelete: "刪除",
        libAiProgressText: "AI 自動補充中...",
        searchPlaceholder: "搜尋單字、詞性、字庫或母語釋義...",
        thCheck: "勾選",
        thWord: "單字 / 音標",
        thCategory: "字庫",
        thLevel: "等級",
        thMeaning: "母語釋義",
        thAction: "操作",
        emptySearchResult: "查無相關單字資料",
        emptyNoticeTitle: "目前選擇的字庫沒有單字！",
        emptyNoticeDesc: "您可以切換至「字庫管理」進行匯入或新增單字。",

        // 排序
        sortDefault: "預設排序",
        sortAlphaAsc: "字母 (A ➔ Z)",
        sortAlphaDesc: "字母 (Z ➔ A)",
        sortPos: "詞性排序",
        sortLevelAsc: "等級 (Lv.1 ➔ 5)",
        sortLevelDesc: "等級 (Lv.5 ➔ 1)",

        // 設定 View
        settingsTitle: "帳號與系統設定",
        settingsDesc: "管理您的個人資料、學習偏好、外觀主題與 API 金鑰",
        lblNickname: "個人固定暱稱 (用於發布字庫與社群)",
        descNickname: "登入後固定綁定帳號，防止他人盜用身份發布",
        phNicknameInput: "設定您的固定暱稱...",
        btnSaveNickname: "儲存暱稱",
        guestMode: "訪客模式",
        notLinkedGoogle: "目前未連結 Google 帳號",
        btnLoginGoogle: "使用 Google 帳號登入",
        btnLogout: "登出帳號",
        lblNativeLang: "使用者母語 (Native Language)",
        descNativeLang: "系統已依據您的裝置語言自動判定",
        lblTargetLang: "學習目標語言 (Target Language)",
        descTargetLang: "選擇 AI 自動解析單字與例句時的語言",
        lblDisplayMode: "卡片正面顯示模式",
        descDisplayMode: "可自由切換母語/外語在正面或同時顯示",
        lblPhoneticPos: "音標 / 讀音顯示位置",
        descPhoneticPos: "背日文時建議設為「背面」，避免正面直接透露發音",
        lblTheme: "外觀主題設定",
        descTheme: "可手動切換或跟隨手機系統預設",
        lblApiKey: "Gemini AI Key",
        descApiKey: "用於自動帶入音標與例句",
        btnSetKey: "設定 Key",
        optTargetFront: "目標語言在正面，母語在背面",
        optNativeFront: "母語在正面，目標語言在背面",
        optBothFront: "正面同時顯示 (雙語對照)",
        optPhoneticFront: "🔤 正面顯示 (英文預設)",
        optPhoneticBack: "🙈 背面顯示 (日文推薦)",
        optCustomLang: "✏️ 自訂 / 自動識別語言...",
        customTargetPlaceholder: "輸入語言名稱（或留空由 AI 自動識別）",
        optCustomNative: "✏️ 自訂母語...",
        phCustomNative: "輸入自訂母語",
        themeSystem: "📱 跟隨系統",
        themeLight: "☀️ 亮色模式",
        themeDark: "🌙 夜間模式",

        // 商店 View
        storeTitle: "官方單字庫商店",
        storeDesc: "免費下載與擴充主題單字庫",
        storeSubDesc: "搜尋、下載或分享來自社群的單字庫",
        btnPublishDeck: "發布字庫",
        storeSearchPlaceholder: "搜尋字庫名稱、簡介或作者名稱...",
        btnGetDeck: "取得字庫",
        btnClose: "關閉",
        storeDevTitle: "開發中",
        storeDevDesc: "涵蓋大考中心 Level 1 ~ Level 6 全部單字。",
        btnGoPreset: "前往載入預設包",

        // 統計 View
        statsTitle: "學習成果與數據統計",
        statsDesc: "掌握您的詞彙累積量、學習熟悉度與各字庫分佈",
        statsOptionsTitle: "顯示指標設定",
        lblShowTotal: "📊 總單字量與掌握率",
        lblShowCategory: "📚 各字庫 / 語言分佈",
        lblShowLevel: "📈 艾賓浩斯等級熟悉度分佈",
        lblShowCatLevel: "🔍 各字庫之等級細節分佈",
        statsTotalWords: "總單字量",
        statsMasteredRate: "總體掌握率 (Lv.4~5)",
        statsLevelDetail: "記憶等級分佈 (Lv.1~5)",
        statsCatBreakdown: "字庫 / 語言明細",

        // Modals
        modalCardTitle: "新增/編輯單字卡",
        lblFormCategory: "歸屬字庫/分類名稱",
        lblFormLevel: "熟悉度等級 (Level 1~5)",
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

        modalPublishTitle: "🚀 發布我的字庫至商店",
        lblPubCategory: "選擇要發布的字庫分類",
        lblPubTitle: "字庫名稱 (不可與商店現有名稱重複)",
        phPubTitle: "例如：JLPT N3 高頻動詞 100 選",
        lblPubPrice: "下載所需金幣 (0 表示免費分享)",
        phPubPrice: "例如：100",
        lblPubAuthor: "發布者暱稱 (已鎖定帳號)：",
        lblPubDesc: "字庫簡介",
        phPubDesc: "簡短說明這個字庫包含什麼內容...",
        btnSubmitPublish: "發布上架",

        // 歡迎與條款
        welcomeTitle: "歡迎使用 LZHCard",
        welcomeSub: "請閱讀並同意服務條款以開啟學習旅程",
        tosTitle: "使用者服務與隱私條款",
        tosSub: "為維護平台安全與使用者權益，請仔細閱讀以下聲明：",
        tosItem1Title: "💬 對話內容檢視權限：",
        tosItem1Desc: "本平台包含之公開聊天室與「私訊管理員」功能，系統管理員出於安全稽核、違規處理與服務維護之必要，皆擁有查看與審核之權限。",
        tosItem2Title: "💾 資料保管免責聲明：",
        tosItem2Desc: "本網頁服務不承擔任何單字庫與學習數據之免費保管或永久儲存責任。建議使用者務必定期使用系統內建之「JSON 備份」功能自行下載備份資料。",
        tosItem3Title: "⚠️ 防詐騙與安全提醒：",
        tosItem3Desc: "請勿於聊天室中透漏任何個人敏感資訊（如銀行帳密、身份證字號）。本平台不會以私訊要求轉帳或提供信用卡資訊，請提高警覺避免受騙。",
        tosCheckLabel: "我已閱讀並完全同意上述使用者服務與隱私條款",
        btnGuestContinue: "以訪客身份繼續使用",

        // 聊天室
        chatDrawerTitle: "交流聊天室",
        badgeAdmin: "管理員",
        phChatSearch: "搜尋群組、固定暱稱或 Email...",
        tabNotice: "公告",
        tabChats: "對話",
        tabFriends: "好友",
        tabAdmin: "巡視",
        btnPubAnnounce: "發布官方公告",
        lblFriendsHeader: "好友與聯絡人",
        btnEmailAddFriend: "Email 加好友",
        phChatInput: "輸入訊息...",
        modalAnnounceTitle: "📢 發布官方公告",
        phAnnTitle: "公告標題",
        phAnnContent: "公告內容...",
        btnPubAnnounceSubmit: "發布公告",

        // 群組
        btnCreateGroup: "+ 建立新群組",
        btnLeaveGroup: "退出群組",
        btnInviteMember: "邀請",
        pendingRequests: "待處理的好友申請",
        pendingGroupInvites: "待處理的群組邀請",

        // 狀態與輔助文字
        statusComplete: "完整",
        statusPending: "待補齊",
        btnRemove: "移除",
        titleRemove: "剔除此單字",
        noMeaning: "（無母語釋義）",
        noSentence: "無例句資訊",
        noWordAvailable: "無可用單字",
        selectOtherDeck: "請選擇其他字庫或匯入單字",
        unitItem: "筆",

        // Toast 訊息提示
        toastCategoryNotFound: "⚠️ 找不到名為【{name}】的字庫！",
        toastRenameSuccess: "🎉 成功將【{oldName}】重新命名為【{newName}】（共 {count} 筆單字）！",
        toastSelectMoveWords: "請先勾選要變更字庫的單字！",
        toastMoveSuccess: "成功將 {count} 筆單字移至【{name}】！",
        toastSelectDeleteWords: "請先勾選要刪除的單字！",
        toastDeleteBatchSuccess: "批量刪除成功！",
        toastNoWordsToFill: "目前列表中無可補充的單字！",
        toastAllWordsComplete: "所選單字皆已具備完整資料！",
        toastBatchLimitExceeded: "待補齊單字共 {count} 筆，超過單次 200 筆限制！",
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
        toastPhoneticBack: "已切換為背面顯示 (防劇透模式)",
        toastPhoneticFront: "已切換為正面顯示",
        toastInvalidApiKey: "⚠️ API Key 無效，請重新設定 Key！",
        toastRateLimit: "⚠️ 觸發 API 頻率限制，請稍後再試！",
        toastApiConnError: "⚠️ 無法連線至 Gemini API 端點！",
        toastNoApiKey: "尚未設定 API Key，請先設定！",

        // Prompts & Confirms
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
        btnProcessing: "處理中...",
        emptyFriendSearchResult: "查無符合「{query}」的好友或搜尋結果",
        emptyChatThreads: "沒有找到對話紀錄",
        clickToStartChat: "點擊開啟即時對話",
        typeGroup: "群組",
        typePrivate: "私聊",
        myFriendsList: "我的好友列表：",
        cloudSearchResults: "雲端搜尋結果 ({count})：",
        cloudUser: "雲端用戶",
        btnAddFriend: "加好友",
        sendFriendReqTo: "發送好友申請給：「{query}」",
        btnSendReq: "送出申請",
        btnAccept: "同意",
        btnReject: "拒絕",
        btnJoin: "加入",
        inviter: "邀請者：",
        noMessages: "目前暫無訊息，發送第一條訊息開始交談吧！",
        noAnnouncements: "目前無系統公告",
        authorLabel: "發布者：",

        // 新手客製化與導覽
        onboardingSetupTitle: "建立您的個人化偏好",
        onboardingSetupDesc: "先花 10 秒設定好您的學習習慣，稍後可隨時在「設定」中變更：",
        btnSkipAll: "略過設定 ✕",
        btnSkip: "略過",
        btnSaveAndTour: "儲存並開啟導覽",
        btnSkipTour: "結束導覽 ✕",
        btnPrevStep: "上一步",
        btnNextStep: "下一步",
        btnFinishTour: "完成教學 🎉",
        
        tour1Title: "📚 字庫切換與選擇器",
        tour1Desc: "點擊這裡可以快速切換當前學習的單字庫，或勾選多個字庫進行混合複習！",
        tour2Title: "🏠 學習模式選單",
        tour2Desc: "包含「卡片輪播」專注背單字，以及「隨堂測驗」考驗拼寫與記憶熟練度。",
        tour3Title: "📋 字庫管理頁面",
        tour3Desc: "您可以在這裡新增單字、批量貼上匯入，或是使用 AI 自動幫您補充音標與例句！",
        tour4Title: "🛍️ 社群字庫商店",
        tour4Desc: "探索並免費下載社群玩家分享的單字庫，或把自己的字庫發布分享給大家！",
        tour5Title: "⚙️ 統計與個人設定",
        tour5Desc: "查看記憶熟練度圖表，或隨時調整外觀主題、語言與 API 金鑰。",
        
        lblTourGuide: "頁面功能導覽",
        descTourGuide: "重新開啟新手介面指引教學",
        btnStartTour: "開啟導覽",
        tourCatTitle: "字庫選擇器",
        
        tourCatDesc: "點擊可切換或多選要學習的單字庫，彈性過濾學習目標。",

        tourChatTitle: "交流聊天室",
        tourChatDesc: "開啟全站公開討論區或 1-on-1 私訊，與其他創作者交流或尋求幫助。",

        tourHomeTitle: "核心學習模式",
        tourHomeDesc: "提供「卡片輪播 (艾賓浩斯演算法)」與「多元隨堂測驗」兩種高效記憶模式。",

        tourListTitle: "字庫管理",
        tourListDesc: "管理您的單字清單，支援 Gemini AI 智慧補齊、批量貼上解析與 JSON 備份。",

        tourStoreTitle: "字庫商店",
        tourStoreDesc: "探索、預覽與下載社群創作者分享的優秀字庫，亦可發布自製字庫賺取金幣。",

        tourStatsTitle: "學習成果統計",
        tourStatsDesc: "視覺化圖表呈現總單字累積量、掌握率及艾賓浩斯 5 級熟練度分佈。",

        tourSettingsTitle: "帳號與系統設定",
        tourSettingsDesc: "設定固定暱稱、母語/學習目標語言、卡片正面顯示模式及 Gemini API Key。"
    },
    'en': {
        appSubtitle: "Exam Prep Flashcards",
        navHome: "Home",
        navList: "Decks",
        navStore: "Store",
        navStats: "Stats",
        navSettings: "Settings",
        catAll: "All Decks",
        defaultCategoryName: "Default Deck",
        categoryDropdownBtnText: "No Deck Selected",
        noCategorySelected: "No Deck Selected",
        selectedPrefix: "Selected",
        unitDeck: "Decks",

        homeTitle: "Select Study Mode",
        homeDesc: "Focus on words and boost your memory effectively",
        modeFlashcard: "Flashcards",
        modeFlashcardDesc: "5-level Ebbinghaus repetition & focus pool algorithm",
        modeQuiz: "Quiz Mode",
        modeQuizDesc: "Spelling, parts of speech & context recall challenges",
        btnStartFocus: "Start Flashcards",
        btnStartQuiz: "Start Quiz",

        btnExit: "Exit Mode",
        btnQuickAdd: "Quick Add",
        stockCount: "Current Total:",
        flipHintFront: "Click card to flip",
        flipHintBack: "Click to flip front",
        btnDontKnow: "Don't Know",
        btnKnow: "Mastered",
        accuracyRate: "Proficiency:",
        quizMode1: "Mode 1",
        quizMode2: "Mode 2",
        quizMode3: "Mode 3",
        quizMode1Ready: "Mode 1 Ready",
        quizPromptTitle: "Prompt",
        quizInputPlaceholder: "Type your answer here...",
        btnSubmit: "Submit",
        btnNext: "Next",

        btnAddWord: "add one",
        btnBatchImport: "Add words",
        btnBackup: "JSON Backup",
        btnSplit: "Split",
        btnClear: "Clear All",
        lblSelectAll: "Select All",
        btnRenameDeck: "Rename Deck",
        btnBatchMove: "Move Deck",
        btnBatchAi: "✨ AI Auto-fill",
        btnBatchDelete: "Delete",
        libAiProgressText: "AI auto-filling...",
        searchPlaceholder: "Search words, POS, decks, or meanings...",
        thCheck: "Select",
        thWord: "Word / Phonetic",
        thCategory: "Deck",
        thLevel: "Level",
        thMeaning: "Definition",
        thAction: "Actions",
        emptySearchResult: "No matching words found",
        emptyNoticeTitle: "No words in the selected deck!",
        emptyNoticeDesc: "You can switch to 'Decks' to import or add words.",

        sortDefault: "Default Sort",
        sortAlphaAsc: "Alphabetical (A ➔ Z)",
        sortAlphaDesc: "Alphabetical (Z ➔ A)",
        sortPos: "By Part of Speech",
        sortLevelAsc: "Level (Lv.1 ➔ 5)",
        sortLevelDesc: "Level (Lv.5 ➔ 1)",

        settingsTitle: "Settings",
        settingsDesc: "Manage your profile, preferences, themes & API key",
        lblNickname: "Fixed Nickname (For Store & Chat)",
        descNickname: "Bound to account once set to prevent impersonation",
        phNicknameInput: "Set your fixed nickname...",
        btnSaveNickname: "Save Nickname",
        guestMode: "Guest Mode",
        notLinkedGoogle: "Google Account not linked",
        btnLoginGoogle: "Sign in with Google",
        btnLogout: "Log Out",
        lblNativeLang: "Native Language",
        descNativeLang: "Auto-detected based on your device language",
        lblTargetLang: "Target Learning Language",
        descTargetLang: "Language used for AI auto-generating definitions & sentences",
        lblDisplayMode: "Card Front Display",
        descDisplayMode: "Switch native/target on front or show both",
        lblPhoneticPos: "Phonetic / Pronunciation Position",
        descPhoneticPos: "Recommended 'Back' for Japanese to avoid spoiler",
        lblTheme: "Appearance Theme",
        descTheme: "Switch manually or follow system default",
        lblApiKey: "Gemini AI Key",
        descApiKey: "Used for auto-generating phonetics & sentences",
        btnSetKey: "Set Key",
        optTargetFront: "Target Front, Native Back",
        optNativeFront: "Native Front, Target Back",
        optBothFront: "Both Front (Bilingual)",
        optPhoneticFront: "🔤 Front (English default)",
        optPhoneticBack: "🙈 Back (Japanese recommended)",
        optCustomLang: "✏️ Custom / Auto-Detect...",
        customTargetPlaceholder: "Enter language (or leave blank for AI Auto-Detect)",
        optCustomNative: "✏️ Custom Native...",
        phCustomNative: "Type custom native language",
        themeSystem: "📱 System Default",
        themeLight: "☀️ Light Mode",
        themeDark: "🌙 Dark Mode",

        storeTitle: "Official Deck Store",
        storeDesc: "Free download and expansion of topic decks",
        storeSubDesc: "Search, download, or share decks from the community",
        btnPublishDeck: "Publish Deck",
        storeSearchPlaceholder: "Search title, description, or author...",
        btnGetDeck: "Get Deck",
        btnClose: "Close",
        storeDevTitle: "Under Development",
        storeDevDesc: "Covers all Level 1 - Level 6 vocabulary.",
        btnGoPreset: "Load Preset Packs",

        statsTitle: "Learning Statistics",
        statsDesc: "Track your vocabulary growth, mastery rate, and deck distribution",
        statsOptionsTitle: "Display Settings",
        lblShowTotal: "📊 Total Words & Mastery Rate",
        lblShowCategory: "📚 Deck / Language Breakdown",
        lblShowLevel: "📈 Mastery Level Distribution",
        lblShowCatLevel: "🔍 Detailed Deck Level Breakdown",
        statsTotalWords: "Total Vocabulary",
        statsMasteredRate: "Overall Mastery (Lv.4~5)",
        statsLevelDetail: "Memory Level Breakdown (Lv.1~5)",
        statsCatBreakdown: "Deck Breakdown",

        modalCardTitle: "Add / Edit Word Card",
        lblFormCategory: "Deck / Category Name",
        lblFormLevel: "Mastery Level (Lv.1~5)",
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

        modalPublishTitle: "🚀 Publish Deck to Store",
        lblPubCategory: "Select Deck Category",
        lblPubTitle: "Deck Title",
        phPubTitle: "e.g. JLPT N3 Essential Verbs",
        lblPubPrice: "Coins Required (0 = Free)",
        phPubPrice: "e.g. 100",
        lblPubAuthor: "Publisher Nickname:",
        lblPubDesc: "Description",
        phPubDesc: "Short summary of this deck...",
        btnSubmitPublish: "Publish Now",

        welcomeTitle: "Welcome to LZHCard",
        welcomeSub: "Please read and accept the Terms of Service to start.",
        tosTitle: "Terms of Service & Privacy Policy",
        tosSub: "To protect platform security and user rights, please read carefully:",
        tosItem1Title: "💬 Chat Content Inspection:",
        tosItem1Desc: "Admins retain rights to review public chat & support messages for security & maintenance.",
        tosItem2Title: "💾 Data Disclaimer:",
        tosItem2Desc: "This service provides no guaranteed permanent storage. Please export JSON backups regularly.",
        tosItem3Title: "⚠️ Anti-Fraud Warning:",
        tosItem3Desc: "Do not share sensitive credentials. We will never ask for wire transfers via chat.",
        tosCheckLabel: "I have read and fully agree to the Terms of Service",
        btnGuestContinue: "Continue as Guest",

        chatDrawerTitle: "Community Chat",
        badgeAdmin: "Admin",
        phChatSearch: "Search groups, nickname, or email...",
        tabNotice: "Notices",
        tabChats: "Chats",
        tabFriends: "Friends",
        tabAdmin: "Audit",
        btnPubAnnounce: "Post Announcement",
        lblFriendsHeader: "Friends & Contacts",
        btnEmailAddFriend: "Add Friend by Email",
        phChatInput: "Type a message...",
        modalAnnounceTitle: "📢 Official Announcement",
        phAnnTitle: "Title",
        phAnnContent: "Content...",
        btnPubAnnounceSubmit: "Post Notice",

        // Groups
        btnCreateGroup: "+ Create New Group",
        btnLeaveGroup: "Leave Group",
        btnInviteMember: "Invite",
        pendingRequests: "Pending Friend Requests",
        pendingGroupInvites: "Pending Group Invites",

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
        toastBatchLimitExceeded: "Total {count} words pending, exceeding max limit of 200!",
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
        toastPhoneticBack: "Phonetic position set to Back (Anti-spoiler mode)",
        toastPhoneticFront: "Phonetic position set to Front",
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
        btnProcessing: "Processing...",
        emptyFriendSearchResult: "No friends or search results found for \"{query}\"",
        emptyChatThreads: "No chat history found",
        clickToStartChat: "Click to open chat",
        typeGroup: "Group",
        typePrivate: "Direct",
        myFriendsList: "My Friends List:",
        cloudSearchResults: "Cloud Search Results ({count}):",
        cloudUser: "Cloud User",
        btnAddFriend: "Add Friend",
        sendFriendReqTo: "Send friend request to: \"{query}\"",
        btnSendReq: "Send Request",
        btnAccept: "Accept",
        btnReject: "Reject",
        btnJoin: "Join",
        inviter: "Invited by:",
        noMessages: "No messages yet. Send a message to start chatting!",
        noAnnouncements: "No announcements at this time",
        authorLabel: "Author:",

        // Onboarding Setup & Tour
        onboardingSetupTitle: "Personal Preferences",
        onboardingSetupDesc: "Spend 10 seconds setting up your study habits. You can change these anytime in Settings:",
        btnSkipAll: "Skip Setup ✕",
        btnSkip: "Skip",
        btnSaveAndTour: "Save & Start Tour",
        btnSkipTour: "End Tour ✕",
        btnPrevStep: "Previous",
        btnNextStep: "Next",
        btnFinishTour: "Finish Tour 🎉",

        tour1Title: "📚 Deck Selector",
        tour1Desc: "Click here to switch active decks or select multiple decks for combined study!",
        tour2Title: "🏠 Study Modes",
        tour2Desc: "Choose Flashcards for spaced repetition or Quiz Mode for spelling challenges.",
        tour3Title: "📋 Deck Management",
        tour3Desc: "Add words, batch import, or use AI to auto-fill phonetics & sentence definitions!",
        tour4Title: "🛍️ Deck Store",
        tour4Desc: "Explore and download community-shared decks, or publish your own decks!",
        tour5Title: "⚙️ Stats & Settings",
        tour5Desc: "Track your learning curves, or adjust appearance, language, and API keys anytime.",

        lblTourGuide: "App Feature Tour",
        descTourGuide: "Reopen the interactive beginner tutorial",
        btnStartTour: "Start Tour",

        tourCatTitle: "Deck Selector",
        tourCatDesc: "Click to switch or multi-select word decks to customize your study scope.",

        tourChatTitle: "Community Chat",
        tourChatDesc: "Open public forums or 1-on-1 private messaging to discuss and connect with others.",

        tourHomeTitle: "Learning Modes",
        tourHomeDesc: "Includes Interactive Flashcards (Ebbinghaus algorithm) and Multiple-mode Quizzes.",

        tourListTitle: "Deck Management",
        tourListDesc: "Manage your vocabulary list with AI auto-fill, batch text import, and JSON backup.",

        tourStoreTitle: "Deck Store",
        tourStoreDesc: "Explore and download community decks, or publish your own to earn coins.",

        tourStatsTitle: "Learning Analytics",
        tourStatsDesc: "Visualized charts showing vocabulary growth, mastery rate, and level distributions.",

        tourSettingsTitle: "System Settings",
        tourSettingsDesc: "Configure your nickname, native/target languages, card display mode, and Gemini API Key."
    },
    'ja': {
        appSubtitle: "単語暗記ツール",
        navHome: "ホーム",
        navList: "単語帳管理",
        navStore: "ストア",
        navStats: "設定",
        navSettings: "設定",
        catAll: "すべての単語帳",
        defaultCategoryName: "デフォルト",
        categoryDropdownBtnText: "単語帳未選択",
        noCategorySelected: "未選擇の單字帳",
        selectedPrefix: "選擇中:",
        unitDeck: "個の單字帳",

        homeTitle: "学習モードを選択",
        homeDesc: "効率的に記憶力を高めましょう",
        modeFlashcard: "カードめくり",
        modeFlashcardDesc: "エビングハウス忘却曲線に基づいた学習",
        modeQuiz: "小テスト",
        modeQuizDesc: "スペルと文脈理解のクイズ",
        btnStartFocus: "カード学習を開始",
        btnStartQuiz: "テストを開始",

        btnExit: "終了",
        btnQuickAdd: "クイック追加",
        stockCount: "現在の登録数:",
        flipHintFront: "クリックで裏返す",
        flipHintBack: "クリックで表に戻る",
        btnDontKnow: "まだ覚えられない",
        btnKnow: "覚えた",
        accuracyRate: "熟練度:",
        quizMode1: "モード 1",
        quizMode2: "モード 2",
        quizMode3: "モード 3",
        quizMode1Ready: "モード 1 準備中",
        quizPromptTitle: "問題ヒント",
        quizInputPlaceholder: "ここに回答を入力...",
        btnSubmit: "回答する",
        btnNext: "次の問題",

        btnAddWord: "単数",
        btnBatchImport: "複数",
        btnBackup: "バックアップ",
        btnSplit: "分割",
        btnClear: "全消去",
        lblSelectAll: "すべて選択",
        btnRenameDeck: "名前変更",
        btnBatchMove: "移動",
        btnBatchAi: "✨ AI補完",
        btnBatchDelete: "削除",
        libAiProgressText: "AI自動補完中...",
        searchPlaceholder: "単語、品詞、単語帳、意味を検索...",
        thCheck: "選択",
        thWord: "単語 / 発音記号",
        thCategory: "単語帳",
        thLevel: "レベル",
        thMeaning: "意味",
        thAction: "操作",
        emptySearchResult: "該当する単語が見つかりません",
        emptyNoticeTitle: "選択した単語帳に単語がありません！",
        emptyNoticeDesc: "「単語帳管理」に切り替えて、単語をインポートまたは追加できます。",

        sortDefault: "デフォルト順",
        sortAlphaAsc: "アルファベット順 (A ➔ Z)",
        sortAlphaDesc: "アルファベット順 (Z ➔ A)",
        sortPos: "品詞順",
        sortLevelAsc: "レベル順 (Lv.1 ➔ 5)",
        sortLevelDesc: "レベル逆順 (Lv.5 ➔ 1)",

        settingsTitle: "アカウントと設定",
        settingsDesc: "個人設定、テーマ、APIキーの管理",
        lblNickname: "固定ニックネーム",
        descNickname: "ストア公開やチャットで使用されます",
        phNicknameInput: "ニックネームを入力...",
        btnSaveNickname: "保存",
        guestMode: "ゲストモード",
        notLinkedGoogle: "Googleアカウント未連携",
        btnLoginGoogle: "Googleでログイン",
        btnLogout: "ログアウト",
        lblNativeLang: "母国語 (Native Language)",
        descNativeLang: "端末の言語設定に基づいて自動判定されています",
        lblTargetLang: "学習言語 (Target Language)",
        descTargetLang: "AIが単語や例文を解析する際に使用する言語",
        lblDisplayMode: "表面の表示モード",
        descDisplayMode: "表面に母国語・学習言語のどちらを表示するか切替",
        lblPhoneticPos: "発音記号・読みの表示位置",
        descPhoneticPos: "日本語学習時は「裏面」表示がおすすめ（ネタバレ防止）",
        lblTheme: "テーマ設定",
        descTheme: "手動切り替えまたはシステム設定に従う",
        lblApiKey: "Gemini API キー",
        descApiKey: "発音記号や例文の自動生成に使用",
        btnSetKey: "APIキー設定",
        optTargetFront: "表面：学習言語 / 裏面：母国語",
        optNativeFront: "表面：母国語 / 裏面：学習言語",
        optBothFront: "表面：両方表示 (二言語対照)",
        optPhoneticFront: "🔤 表面表示 (英語推奨)",
        optPhoneticBack: "🙈 裏面表示 (日本語推奨)",
        optCustomLang: "✏️ カスタム / 自動判別...",
        customTargetPlaceholder: "言語名を入力（空欄でAI自動識別）",
        optCustomNative: "✏️ カスタム母国語...",
        phCustomNative: "母国語を入力",
        themeSystem: "📱 システムに従う",
        themeLight: "☀️ ライトモード",
        themeDark: "🌙 ダークモード",

        storeTitle: "公式単語帳ストア",
        storeDesc: "テーマ別単語帳を無料でダウンロード・拡張",
        storeSubDesc: "コミュニティの単語帳を検索・ダウンロード",
        btnPublishDeck: "単語帳を公開",
        storeSearchPlaceholder: "タイトル、説明、作者名で検索...",
        btnGetDeck: "入手する",
        btnClose: "閉じる",
        storeDevTitle: "開発中",
        storeDevDesc: "Level 1 〜 Level 6 の全単語をカバー。",
        btnGoPreset: "プリセットパックを読み込む",

        statsTitle: "学習統計成果",
        statsDesc: "単語数の蓄積、定着度、単語帳ごとの進捗を分析",
        statsOptionsTitle: "表示項目設定",
        lblShowTotal: "📊 総単語数と定着率",
        lblShowCategory: "📚 単語帳・言語別内訳",
        lblShowLevel: "📈 習熟度レベル分布",
        lblShowCatLevel: "🔍 単語帳ごとのレベル詳細",
        statsTotalWords: "総単語数",
        statsMasteredRate: "全体定着率 (Lv.4~5)",
        statsLevelDetail: "記憶レベル分布 (Lv.1~5)",
        statsCatBreakdown: "単語帳別内訳",

        modalCardTitle: "単語カードの追加・編集",
        lblFormCategory: "所属単語帳/分類名",
        lblFormLevel: "習熟度レベル (Lv.1~5)",
        phFormCategory: "例: デフォルト / 核心単語",
        lblFormWord: "学習言語の単語・語彙",
        phFormWord: "例: resilient / 食べる",
        btnAiFill: "AI自動入力",
        lblFormPos: "品詞 (POS)",
        phFormPos: "例: adj. / 動詞",
        lblFormPhonetic: "発音記号・読み",
        phFormPhonetic: "例: /rɪˈzɪl.jənt/ または たべる",
        lblFormMeaning: "意味・翻訳",
        phFormMeaning: "例: 彈力のある",
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
        btnStartSplit: "開始",

        modalQuickAddTitle: "クイック単語追加",
        modalQuickAddDesc: "分からない単語を入力してください（カンマ、スペース、改行で区切り可能）。AIがバックグラウンドで発音記号、品詞、意味を自動補完します！",
        phQuickAddInput: "例: resilient, fragile",
        btnQuickAddConfirm: "確定してAI自動入力",

        modalPublishTitle: "🚀 単語帳をストアに公開",
        lblPubCategory: "カテゴリ選択",
        lblPubTitle: "単語帳タイトル",
        phPubTitle: "例: JLPT N3 重要動詞",
        lblPubPrice: "必要コイン (0 = 無料)",
        phPubPrice: "例: 100",
        lblPubAuthor: "作者ニックネーム：",
        lblPubDesc: "説明文",
        phPubDesc: "この単語帳の概要...",
        btnSubmitPublish: "公開する",

        welcomeTitle: "LZHCard へようこそ",
        welcomeSub: "利用規約に同意して学習を開始してください",
        tosTitle: "利用規約とプライバシーポリシー",
        tosSub: "安全な利用のために以下の規約をご確認ください：",
        tosItem1Title: "💬 チャット監査権限：",
        tosItem1Desc: "管理者には安全確保のため、チャット内容を点検する権限があります。",
        tosItem2Title: "💾 データ保存の免責：",
        tosItem2Desc: "データは定期的に JSON バックアップ機能で保存してください。",
        tosItem3Title: "⚠️ 詐欺防止の警告：",
        tosItem3Desc: "個人情報やクレジットカード情報をチャット上で公開しないでください。",
        tosCheckLabel: "上記の利用規約に同意します",
        btnGuestContinue: "ゲストとして継続",

        chatDrawerTitle: "コミュニティチャット",
        badgeAdmin: "管理者",
        phChatSearch: "グループ、名前、Emailで検索...",
        tabNotice: "お知らせ",
        tabChats: "チャット",
        tabFriends: "フレンド",
        tabAdmin: "監査",
        btnPubAnnounce: "お知らせ投稿",
        lblFriendsHeader: "フレンド一覧",
        btnEmailAddFriend: "Email で追加",
        phChatInput: "メッセージを入力...",
        modalAnnounceTitle: "📢 公式お知らせ投稿",
        phAnnTitle: "タイトル",
        phAnnContent: "内容...",
        btnPubAnnounceSubmit: "投稿",

        // Groups
        btnCreateGroup: "+ グループを作成",
        btnLeaveGroup: "グループを脱退",
        btnInviteMember: "招待",
        pendingRequests: "保留中のフレンド申請",
        pendingGroupInvites: "保留中のグループ招待",

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
        toastBatchLimitExceeded: "未入力単語が {count} 件あり、一度の上限200件を超えています！",
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
        toastPhoneticBack: "発音を裏面表示に設定しました（ネタバレ防止モード）",
        toastPhoneticFront: "発音を表面表示に設定しました",
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
        btnProcessing: "処理中...",
        emptyFriendSearchResult: "「{query}」に一致するフレンドまたは検索結果が見つかりません",
        emptyChatThreads: "チャット履歴が見つかりません",
        clickToStartChat: "クリックしてチャットを開始",
        typeGroup: "グループ",
        typePrivate: "個チャ",
        myFriendsList: "フレンドリスト：",
        cloudSearchResults: "クラウド検索結果 ({count})：",
        cloudUser: "クラウドユーザー",
        btnAddFriend: "追加",
        sendFriendReqTo: "「{query}」にフレンド申請を送信",
        btnSendReq: "申請送信",
        btnAccept: "承認",
        btnReject: "拒否",
        btnJoin: "参加",
        inviter: "招待者：",
        noMessages: "メッセージはまだありません。メッセージを送信してチャットを開始しましょう！",
        noAnnouncements: "現在お知らせはありません",
        authorLabel: "投稿者：",

        // 初心者オンボーディング・ガイド
        onboardingSetupTitle: "個人設定の作成",
        onboardingSetupDesc: "学習の習慣を10秒で設定しましょう。後からいつでも「設定」で変更できます：",
        btnSkipAll: "設定をスキップ ✕",
        btnSkip: "スキップ",
        btnSaveAndTour: "保存してツアーを開始",
        btnSkipTour: "ツアーを終了 ✕",
        btnPrevStep: "前へ",
        btnNextStep: "次へ",
        btnFinishTour: "ツアーを完了 🎉",

        tour1Title: "📚 単語帳の切り替え",
        tour1Desc: "ここをクリックすると、学習する単語帳を切り替えたり、複数の単語帳を選択してまとめて復習できます！",
        tour2Title: "🏠 学習モード",
        tour2Desc: "暗記に集中できる「カードめくり」と、スペルや記憶の定着度をテストする「小テスト」が利用できます。",
        tour3Title: "📋 単語帳管理",
        tour3Desc: "単語の個別追加や一括インポート、AIによる発音記号・例文の自動補完が行えます！",
        tour4Title: "🛍️ 単語帳ストア",
        tour4Desc: "コミュニティで共有された単語帳をダウンロードしたり、自分の単語帳を世界中に公開できます！",
        tour5Title: "⚙️ 統計・各種設定",
        tour5Desc: "定着度の統計グラフを確認したり、テーマ、言語、APIキーの変更が可能です。",

        lblTourGuide: "機能ガイド",
        descTourGuide: "初心者向けのチュートリアルを再開します",
        btnStartTour: "ツアーを開始",

        tourCatTitle: "単語帳セレクター",
        tourCatDesc: "クリックして学習したい単語帳を切り替え・複数選択できます。",

        tourChatTitle: "交流チャットルーム",
        tourChatDesc: "全体チャットや1対1のメッセージで他の学習者と交流できます。",

        tourHomeTitle: "コア学習モード",
        tourHomeDesc: "エビングハウス暗記カードと多様なクイズモードで効率的に学習します。",

        tourListTitle: "単語帳管理",
        tourListDesc: "AI自動補完、一括テキスト解析、JSONバックアップに対応した単語管理画面です。",

        tourStoreTitle: "単語帳ストア",
        tourStoreDesc: "コミュニティの単語帳を試聴・ダウンロードしたり、自作単語帳を販売できます。",

        tourStatsTitle: "学習成果統計",
        tourStatsDesc: "総単語数、習得率、エビングハウスレベルの分布をグラフで視覚化します。",

        tourSettingsTitle: "アカウント＆設定",
        tourSettingsDesc: "ニックネーム、母国語・目標言語、カード表示モード、Gemini API Keyを設定します。"
    }
};

/**
 * 取得當前使用的語言代碼
 */
function getCurrentLanguage() {
    const saved = localStorage.getItem('user_native_lang') || localStorage.getItem('lzhcard_native_lang');
    if (saved && (I18N_DICTIONARY[saved] || saved === 'custom')) {
        return saved;
    }
    const sysLang = navigator.language || navigator.userLanguage || 'zh-TW';
    if (sysLang.startsWith('zh')) return 'zh-TW';
    if (sysLang.startsWith('ja')) return 'ja';
    return 'en';
}

/**
 * 🌐 全域多語言翻譯與動態變數替換輔助函式 (相容 t('key', { name: 'xxx' }))
 */
function t(key, params = {}) {
    const nativeLang = getCurrentLanguage();
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

    // 若 params 為字串（舊版相容）
    if (typeof params === 'string') {
        return text || params;
    }

    // 自動執行 {name}, {count} 等動態變數替換
    if (params && typeof params === 'object') {
        Object.keys(params).forEach(p => {
            text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
        });
    }

    return text;
}

/**
 * 更新 DOM 元素 UI 語言
 */
function applyLanguageUI() {
    const nativeLang = getCurrentLanguage();
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
        } else if (I18N_DICTIONARY['zh-TW'][key]) {
            elem.innerText = I18N_DICTIONARY['zh-TW'][key];
        }
    });

    // 2. 翻譯輸入框預設文字 (data-i18n-placeholder)
    document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
        const key = elem.getAttribute('data-i18n-placeholder');
        if (dict[key]) {
            elem.setAttribute('placeholder', dict[key]);
        } else if (I18N_DICTIONARY['zh-TW'][key]) {
            elem.setAttribute('placeholder', I18N_DICTIONARY['zh-TW'][key]);
        }
    });

    // 3. 同步刷新字庫下拉選單的語系與單位
    if (typeof updateCategorySelects === 'function') {
        updateCategorySelects();
    }

    // 4. 同步更新批量輸入與快速新增的範例提示
    if (typeof updateBatchPlaceholders === 'function') {
        updateBatchPlaceholders();
    }
}

/**
 * 相容別名函式
 */
function updatePageTranslations() {
    applyLanguageUI();
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
            const translatedDict = typeof safeParseJSON === 'function' ? safeParseJSON(rawText) : JSON.parse(rawText);
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