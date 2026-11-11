已為您更新 README 檔案，納入了新增的 `src/` 模組目錄（`aiHandler.js` 與 `shopHandler.js`），並同步更新了最新的**兩階段新手偏好設定**與 Gemini Key 雙軌模式：

---

# 🎴 LZHCard — 智慧艾賓浩斯單字卡與社群學習系統

> 結合 **Gemini AI 智慧單字補齊**、**艾賓浩斯間隔重複記憶演算法**、**多元隨堂測驗**、**兩階段新手互動導覽** 與 **雲端社群金幣商店** 的全方位單字學習 Web 應用程式。

---

## 🌟 核心特色

### 🧠 1. 艾賓浩斯間隔重複演算法 (`js/algorithm.js`)

* **5 階段記憶等級 (Lv.1 ~ Lv.5)**：根據使用者的熟練程度自動動態調整出現機率。
* **動態焦點池**：限制低等級單字（Lv.1 集中池最多 6 字、Lv.2 最多 4 字）進行強化複習。
* **嚴格防重複與權重隨機抽出**：防止同一張單字卡連續重複出現，配合過往歷史權重衰減機制，確保複習效率極大化。

### 🤖 2. Gemini AI 智慧輔助 (`src/aiHandler.js`)

* **單字自動解析補齊**：輸入外文單字後，AI 自動填寫詞性 (POS)、IPA/音標、繁體中文釋義、實用例句及例句翻譯。
* **錯植重新解析與一鍵覆蓋**：支援自訂學習目標語言與母語，自動修正非目標語言的錯植資料。
* **全站 UI 多語系自動翻譯**：當使用者選擇自訂語言時，AI 自動將系統介面動態翻譯為該語言。

### 📝 3. 多元隨堂測驗機制 (`js/quiz.js`)

* **模式 1：純英文上下文聯想** — 題目隱藏關鍵單字首尾字母，透過例句填空進行聯想記憶。
* **模式 2：詞性與繁中釋義對照** — 結合詞性提示與中文意義的快答練習。
* **模式 3：🎯 句意對照挖空** — 中英文雙語對照加上句子挖空測驗。
* **即時演算法連動**：測驗答對時自動增加升級連續答對次數（`knowStreak`），答錯則自動降級。

### 🧭 4. 兩階段新手引導與互動導覽 (`js/onboarding.js`)

* **兩階段客製化偏好設定 Modal**：
* **Step 1 / 2（語言偏好）**：優先確認使用者「母語」與「學習目標語言」，點擊下一步時即時切換並翻譯全站 UI。
* **Step 2 / 2（顯示與 API 偏好）**：選擇卡片正面顯示模式及 **Gemini Key 雙軌模式**（「免費共用 Key」與「個人 Key」；個人 Key 選擇時才展開輸入框）。


* **高亮聚焦導覽教學 (Interactive Spotlight Tour)**：透過動態 Spotlight 遮罩高亮核心介面（字庫選擇器、學習模式選單、字庫管理、商店與設定），循序漸進引導新使用者熟悉全站功能。
* **偏好設定儲存與關閉連動**：支援一鍵「儲存並開啟導覽」或「略過設定」，系統自動記憶完成狀態，亦可在設定頁面隨時重新開啟導覽教學。

### 🛒 5. 社群字庫商店與金幣經濟 (`src/shopHandler.js`)

* **雲端字庫發布與下架**：使用者可將自製字庫作品設定簡介與金幣價格發布至社群。
* **金幣交易分潤機制**：買家花費金幣購買，平台抽成 30%，賣家實得 70% 金幣收益並自動入帳。
* **字庫預覽與分享**：支援點擊預覽單字內容、作者作品集展演，以及 URL Hash 深度連結（`#share=deckId`）分享。

### 💬 6. 即時社群與雲端好友 (`js/chat.js` / `js/firebase.js`)

* **Firebase Auth 多重登入**：支援 Google 一鍵快速登入、Email 註冊與訪客模式。
* **Firestore 即時對話**：提供全站公開討論區 (`chat_group_public`) 與 1-on-1 好友雲端私聊。
* **好友搜尋系統**：支援使用 Email 或固定暱稱搜尋雲端用戶並添加好友。
* **官方公告與管理員權限**：管理員（Admin）具備發布全站公告、強制下架商店字庫及刪除對話紀錄之權限。

### 📊 7. 多維度學習統計 (`js/stats.js`)

* **數據儀表板**：即時統計總單字量、熟練率（Lv.4 + Lv.5 佔比）。
* **艾賓浩斯層級分佈**：視覺化進度條呈現 Lv.1 ~ Lv.5 單字熟練度。
* **字庫分類統計**：動態過濾並比較不同字庫的掌握率與等級結構。

### ⚙️ 8. 雙軌儲存與彈性偏好 (`js/storage.js` / `js/settings.js`)

* **離線與雲端雙軌引擎 (`StorageEngine`)**：登入時自動與 Firestore 雙向同步字庫與設定，離線或訪客狀態下自動降級至 LocalStorage 運作。
* **個人化設定**：支援深色/淺色/跟隨系統主題切換、卡片正面顯示模式（外文/繁中/雙語）及音標顯示位置。

---

## 🛠️ 技術棧 (Tech Stack)

| 領域 | 技術 / 工具 | 說明 |
| --- | --- | --- |
| **前端架構** | HTML5, JavaScript (ES6+), Tailwind CSS | 純 JS 模組化開發，免編譯打包工具，響應式 UI 設計 |
| **圖示庫** | FontAwesome 6 | 提供全站 UI 圖示 |
| **後端與雲端** | Firebase Firestore, Firebase Auth, Realtime Database | 即時資料庫同步、使用者驗證與雲端儲存 |
| **AI 介接** | Google Gemini API | 進行單字解析、詞性標記、例句翻譯生成與 UI 多語系翻譯 |
| **演算法** | 艾賓浩斯記憶曲線 (Ebbinghaus Forgetting Curve) | 動態隨機抽卡與等級升降機制 |

---

## 📂 專案檔案架構

```text
├── index.html             # 主程式 HTML 佈局與 Modal 視窗結構
├── css/
│   └── style.css          # 客製化樣式與動畫
├── js/                    # 前端互動與介面邏輯模組
│   ├── algorithm.js       # 艾賓浩斯間隔重複抽卡演算法
│   ├── app.js             # 主控制邏輯、卡片輪播、單字表單與 Toast 系統
│   ├── batch.js           # 批量單字處理 (貼上解析、拆分、JSON 匯入匯出)
│   ├── chat.js            # 聊天室、好友搜尋與系統公告模組
│   ├── firebase.js        # Firebase Auth 登入與 Firestore 狀態監聽
│   ├── i18n.js            # 全介面多語系字典與翻譯引擎
│   ├── onboarding.js      # 兩階段新手客製化偏好設定與高亮聚焦導覽教學
│   ├── quiz.js            # 三大模式隨堂測驗控制邏輯
│   ├── settings.js        # 系統語言、主題深淺色與偏好設定控制
│   ├── stats.js           # 學習進度與艾賓浩斯分佈統計圖表
│   └── storage.js         # LocalStorage 與 Firestore 雙軌備援儲存引擎
└── src/                   # 核心處理器模組 (Handlers)
    ├── aiHandler.js       # Gemini API 自動化單字解析、錯植修復與 UI 翻譯處理器
    └── shopHandler.js     # 社群字庫商店交易、金幣分潤計算與雲端發布處理器

```

---

## 🚀 快速開始

### 1. 取得原始碼

複製本專案至本機電腦：

```bash
git clone https://github.com/your-username/LZHCard.git
cd LZHCard

```

### 2. 設定 Firebase

1. 前往 [Firebase Console](https://console.firebase.google.com/) 建立專案。
2. 啟用 **Authentication**（開啟 Google 與 Email 登入方式）。
3. 啟用 **Cloud Firestore Database** 與 **Realtime Database**。
4. 將專案中的 `js/firebase.js` 設定檔替換為您的 Firebase 配置：

```javascript
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

```

### 3. 設定 Gemini API Key

1. 前往 [Google AI Studio](https://aistudio.google.com/) 申請 Gemini API Key。
2. 開啟 LZHCard 系統後，可在首次進入的「新手偏好設定 Step 2」視窗，或隨時點擊「設定 (Settings) ⚙️」選擇個人 Key 並貼入輸入框。
3. 系統亦預設提供全站「免費共用 Key」模式，免輸入即可即刻使用 AI 單字解析功能。

### 4. 運行專案

本專案為純前端應用，直接使用瀏覽器開啟 `index.html`，或搭配 Live Server 伺服器即可運作：

```bash
# 使用 npx http-server 快速啟動測試
npx http-server .

```

---

## 📜 權限與安全說明

* **訪客權限限制**：訪客可體驗卡片學習、測驗、新手導覽與本機儲存，但社交聊天、商店購買/發布及雲端備份功能需先登入帳號。
* **管理員權限 (Admin)**：在 Firestore `users/{uid}` 中將 `role` 欄位設定為 `"admin"`，即可啟用公告發布、聊天訊息與商店作品管理權限。

---

## 📄 授權條款 (License)

本專案採用 [MIT License](https://opensource.org/licenses/MIT) 條款開源。歡迎自由 Fork、修改與商業/非商業擴充使用。