🎴 LZHCard — 智慧 FSRS 單字卡與社群學習系統
> 結合 Gemini AI 智慧單字補齊、FSRS 間隔重複排程與自由練習雙軌演算法、多元隨堂測驗、兩階段新手互動導覽 與 雲端社群金幣商店 的全方位單字學習 Web 應用程式。
> 
🌟 核心特色
🧠 1. FSRS 記憶排程與自由練習雙軌演算法 (js/algorithm.js / js/algorithm_2.js)
 * FSRS 智慧記憶排程 (js/algorithm.js)：
   * 依據每張單字的遺忘曲線（90% 記憶保留率臨界點）動態計算穩定度（stability）、難度（difficulty）、當前記憶可提取性（retrievability）與遺忘次數（lapses）。
   * 支援四段式熟練度評分（不熟悉 / 模糊 / 已掌握 / 秒答）與三層優先級抽卡，自動排程最佳複習時間，並支援舊版卡片資料無縫遷移（migrateCardFSRS）。
 * 自由練習 / 考前衝刺模式 (js/algorithm_2.js)：
   * 獨立運作的考前臨時熟悉引擎，沿用經典 5 階段動態焦點池（臨時 Lv.1 集中池最多 6 字、Lv.2 最多 4 字）、嚴格防連續重複與雙層群組歸一化權重抽卡。
   * 採用獨立進度欄位（freeLevel、freeStreak）並跨字庫同步，完全不影響正式的 FSRS 排程數據；提供按鈕等級變化即時預覽與考後一鍵重置功能。
🤖 2. Gemini AI 智慧輔助 (src/aiHandler.js)
 * 單字自動解析補齊：輸入外文單字後，AI 自動填寫詞性 (POS)、IPA/音標、繁體中文釋義、實用例句及例句翻譯。
 * 錯植重新解析與一鍵覆蓋：支援自訂學習目標語言與母語，自動修正非目標語言的錯植資料。
 * 全站 UI 多語系自動翻譯：當使用者選擇自訂語言時，AI 自動將系統介面動態翻譯為該語言。
📝 3. 多元隨堂測驗機制 (js/quiz.js)
 * 模式 1：純英文上下文聯想 — 題目隱藏關鍵單字首尾字母，透過例句填空進行聯想記憶。
 * 模式 2：詞性與繁中釋義對照 — 結合詞性提示與中文意義的快答練習。
 * 模式 3：🎯 句意對照挖空 — 中英文雙語對照加上句子挖空測驗。
 * FSRS 三層優先級出題與雙向連動：自動過濾具備例句的單字並依最高進度去重，優先抽出到期與易忘單字；答對自動寫入 FSRS 鞏固排程並顯示下次複習時間，答錯則立即排入 10 分鐘後重點重學。
🧭 4. 兩階段新手引導與互動導覽 (js/onboarding.js)
 * 兩階段客製化偏好設定 Modal：
   * Step 1 / 2（語言偏好）：優先確認使用者「母語」與「學習目標語言」，點擊下一步時即時切換並翻譯全站 UI。
   * Step 2 / 2（顯示與 API 偏好）：選擇卡片正面顯示模式及 Gemini Key 雙軌模式（「免費共用 Key」與「個人 Key」；個人 Key 選擇時才展開輸入框）。
 * 高亮聚焦導覽教學 (Interactive Spotlight Tour)：透過動態 Spotlight 遮罩高亮核心介面（字庫選擇器、學習模式選單、字庫管理、商店與設定），循序漸進引導新使用者熟悉全站功能。
 * 偏好設定儲存與關閉連動：支援一鍵「儲存並開啟導覽」或「略過設定」，系統自動記憶完成狀態，亦可在設定頁面隨時重新開啟導覽教學。
🛒 5. 社群字庫商店與金幣經濟 (src/shopHandler.js)
 * 雲端字庫發布與下架：使用者可將自製字庫作品設定簡介與金幣價格發布至社群。
 * 金幣交易分潤機制：買家花費金幣購買，平台抽成 30%，賣家實得 70% 金幣收益並自動入帳。
 * 字庫預覽與分享：支援點擊預覽單字內容、作者作品集展演，以及 URL Hash 深度連結（#share=deckId）分享。
💬 6. 即時社群與雲端好友 (js/chat.js / js/firebase.js)
 * Firebase Auth 多重登入：支援 Google 一鍵快速登入、Email 註冊與訪客模式。
 * Firestore 即時對話：提供全站公開討論區 (chat_group_public) 與 1-on-1 好友雲端私聊。
 * 好友搜尋系統：支援使用 Email 或固定暱稱搜尋雲端用戶並添加好友。
 * 官方公告與管理員權限：管理員（Admin）具備發布全站公告、強制下架商店字庫及刪除對話紀錄之權限。
📊 7. FSRS 多維度學習數據與頑固難字分析 (js/stats.js)
 * 總覽儀表板：即時統計跨字庫去重後的總單字量、未學新字數、當前記憶保留率及熟練率（Lv.4 ~ Lv.5 佔比）。
 * FSRS 未來 7 天待複習預測雷達：依據每張單字的遺忘曲線自動估算今日至未來 6 天的到期複習量。
 * 記憶穩定度等級分佈：視覺化進度條呈現 Lv.1 ~ Lv.5 各階段單字分佈與對應的記憶穩定天數區間。
 * 高遺忘頑固難字榜 (Top 8 Leeches)：自動追蹤曾背熟後又多次遺忘的單字，支援點擊「立即強訓」將其設為已到期並直接啟動專注閃卡重訓。
 * 各字庫學習進度：動態過濾並比較不同字庫的單字佔比、熟練率與等級結構。
⚙️ 8. 雙軌儲存與彈性偏好 (js/storage.js / js/settings.js)
 * 離線與雲端雙軌引擎 (StorageEngine)：登入時自動與 Firestore 雙向同步字庫與設定，離線或訪客狀態下自動降級至 LocalStorage 運作。
 * 個人化設定：支援深色/淺色/跟隨系統主題切換、卡片正面顯示模式（外文/繁中/雙語）、音標顯示位置及隱私狀態切換。
🛠️ 技術棧 (Tech Stack)
| 領域 | 技術 / 工具 | 說明 |
|---|---|---|
| 前端架構 | HTML5, JavaScript (ES6+), Tailwind CSS | 純 JS 模組化開發，免編譯打包工具，響應式 UI 設計 |
| 圖示庫 | FontAwesome 6 | 提供全站 UI 圖示 |
| 後端與雲端 | Firebase Firestore, Firebase Auth, Realtime Database | 即時資料庫同步、使用者驗證與雲端儲存 |
| AI 介接 | Google Gemini API | 進行單字解析、詞性標記、例句翻譯生成與 UI 多語系翻譯 |
| 演算法 | FSRS 排程演算法 + 動態焦點池雙軌引擎 | 遺忘曲線記憶排程與獨立考前衝刺抽卡機制 |
📂 專案檔案架構
├── index.html             # 主程式 HTML 佈局與 Modal 視窗結構
├── css/
│   └── style.css          # 客製化樣式與動畫
├── js/                    # 前端互動與介面邏輯模組
│   ├── algorithm.js       # FSRS 間隔重複排程與遺忘曲線演算法
│   ├── algorithm_2.js     # 自由練習 / 考前臨時熟悉演算法（獨立 5 階段焦點池）
│   ├── app.js             # 主控制邏輯、卡片輪播、單字表單與 Toast 系統
│   ├── batch.js           # 批量單字處理 (貼上解析、拆分、JSON 匯入匯出)
│   ├── chat.js            # 聊天室、好友搜尋與系統公告模組
│   ├── firebase.js        # Firebase Auth 登入與 Firestore 狀態監聽
│   ├── i18n.js            # 全介面多語系字典與翻譯引擎
│   ├── onboarding.js      # 兩階段新手客製化偏好設定與高亮聚焦導覽教學
│   ├── quiz.js            # 三大模式隨堂測驗控制邏輯（FSRS 雙向連動）
│   ├── settings.js        # 系統語言、主題深淺色與偏好設定控制
│   ├── stats.js           # FSRS 未來 7 天預測、記憶穩定度與頑固難字統計面板
│   └── storage.js         # LocalStorage 與 Firestore 雙軌備援儲存引擎
└── src/                   # 核心處理器模組 (Handlers)
    ├── aiHandler.js       # Gemini API 自動化單字解析、錯植修復與 UI 翻譯處理器
    └── shopHandler.js     # 社群字庫商店交易、金幣分潤計算與雲端發布處理器

🚀 快速開始
1. 取得原始碼
複製本專案至本機電腦：
git clone https://github.com/your-username/LZHCard.git
cd LZHCard

2. 設定 Firebase
 * 前往 Firebase Console 建立專案。
 * 啟用 Authentication（開啟 Google 與 Email 登入方式）。
 * 啟用 Cloud Firestore Database 與 Realtime Database。
 * 將專案中的 js/firebase.js 設定檔替換為您的 Firebase 配置：
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

3. 設定 Gemini API Key
 * 前往 Google AI Studio 申請 Gemini API Key。
 * 開啟 LZHCard 系統後，可在首次進入的「新手偏好設定 Step 2」視窗，或隨時點擊「設定 (Settings) ⚙️」選擇個人 Key 並貼入輸入框。
 * 系統亦預設提供全站「免費共用 Key」模式，免輸入即可即刻使用 AI 單字解析功能。
4. 運行專案
本專案為純前端應用，直接使用瀏覽器開啟 index.html，或搭配 Live Server 伺服器即可運作：
# 使用 npx http-server 快速啟動測試
npx http-server .

📜 權限與安全說明
 * 訪客權限限制：訪客可體驗卡片學習、測驗、新手導覽與本機儲存，但社交聊天、商店購買/發布及雲端備份功能需先登入帳號。
 * 管理員權限 (Admin)：在 Firestore users/{uid} 中將 role 欄位設定為 "admin"，即可啟用公告發布、聊天訊息與商店作品管理權限。
📄 授權條款 (License)
本專案採用 MIT License 條款開源。歡迎自由 Fork、修改與商業/非商業擴充使用。
