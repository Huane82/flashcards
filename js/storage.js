<<<<<<< HEAD
// 全域字庫資料陣列
let wordList = [];

// 雙軌儲存引擎：支援離線 LocalStorage 與雲端 Firestore 自動同步
const StorageEngine = {
  LOCAL_KEY: 'flashcards_decks',

  getCurrentUid() {
    return (firebase.auth && firebase.auth().currentUser) ? firebase.auth().currentUser.uid : null;
  },

  async loadDecks() {
    const uid = this.getCurrentUid();
    
    // 已登入：優先從 Firestore 雲端讀取
    if (uid) {
      try {
        const docRef = db.collection('users').doc(uid);
        const doc = await docRef.get();
        if (doc.exists && doc.data().decks) {
          const cloudDecks = doc.data().decks;
          localStorage.setItem(this.LOCAL_KEY, JSON.stringify(cloudDecks));
          return cloudDecks;
        }
      } catch (e) {
        console.warn("Firestore 讀取失敗，降級使用 LocalStorage:", e);
      }
    }
    
    // 未登入或讀取失敗：讀取 LocalStorage
    const localData = localStorage.getItem(this.LOCAL_KEY);
    return localData ? JSON.parse(localData) : [];
  },

  async saveDecks(decks) {
    localStorage.setItem(this.LOCAL_KEY, JSON.stringify(decks));

    const uid = this.getCurrentUid();
    if (uid) {
      try {
        await db.collection('users').doc(uid).set({
          decks: decks,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log("已成功同步字庫至 Cloud Firestore");
      } catch (e) {
        console.error("雲端同步失敗:", e);
      }
    }
  }
};

// 供 app.js 呼叫的全域載入與儲存函式
async function loadStorage() {
  wordList = await StorageEngine.loadDecks();
  if (typeof updateCategorySelects === 'function') updateCategorySelects();
  if (typeof updateUI === 'function') updateUI();
  if (typeof nextCard === 'function') nextCard();
}

async function saveStorage() {
  await StorageEngine.saveDecks(wordList);
=======
/**
 * LocalStorage 儲存與備份模組
 */

const STORAGE_KEY_WORDS = 'flashcard_words_v1';
const STORAGE_KEY_APIKEY = 'flashcard_gemini_key_v1';

let wordList = [];
let selectedCategory = "ALL"; // 當前篩選的學習字庫

function loadStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_WORDS);
        if (raw) {
            wordList = JSON.parse(raw);
            wordList.forEach(item => {
                if (!item.level) item.level = 1;
                if (typeof item.knowStreak === 'undefined') item.knowStreak = 0;
                if (!item.category) item.category = "預設字庫";
            });
        } else {
            wordList = [];
        }
    } catch (e) {
        console.error("載入本地數據失敗:", e);
        wordList = [];
    }
}

function saveStorage() {
    try {
        localStorage.setItem(STORAGE_KEY_WORDS, JSON.stringify(wordList));
    } catch (e) {
        console.error("儲存本地數據失敗:", e);
    }
}

/**
 * 取得目前字庫列表中所有的分類名稱
 */
function getAllCategories() {
    const set = new Set();
    wordList.forEach(w => set.add(w.category || "預設字庫"));
    return Array.from(set);
}

/**
 * 匯出 JSON 備份檔 (支援選擇性匯出特定字庫)
 */
function exportJSON() {
    if (wordList.length === 0) {
        alert("目前字庫為空，無法匯出！");
        return;
    }

    const exportSelect = document.getElementById('exportCategorySelect');
    const targetCat = exportSelect ? exportSelect.value : "ALL";

    let exportData = wordList;
    if (targetCat !== "ALL") {
        exportData = wordList.filter(w => (w.category || "預設字庫") === targetCat);
    }

    if (exportData.length === 0) {
        alert("所選字庫內無任何單字！");
        return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `flashcards_${targetCat === 'ALL' ? 'all' : targetCat}_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

function handleImportJSON() {
    const fileInput = document.getElementById('jsonFileInput');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert("請選擇要匯入的 .json 檔案！");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                let count = 0;
                imported.forEach(item => {
                    if (item.word) {
                        wordList.unshift({
                            id: item.id || ('w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
                            word: item.word,
                            pos: item.pos || '',
                            phonetic: item.phonetic || '',
                            meaning: item.meaning || '',
                            sentence: item.sentence || '',
                            translation: item.translation || '',
                            category: item.category || '匯入字庫',
                            level: item.level || 1,
                            knowStreak: item.knowStreak || 0,
                            updatedAt: item.updatedAt || Date.now()
                        });
                        count++;
                    }
                });
                saveStorage();
                if (typeof updateUI === 'function') updateUI();
                if (typeof closeModal === 'function') closeModal('backupModal');
                alert(`成功匯入 ${count} 筆單字！`);
            } else {
                alert("檔案格式不符合 JSON 陣列標準！");
            }
        } catch (err) {
            alert("解析 JSON 檔案失敗，請確認檔案內容格式！");
        }
    };
    reader.readAsText(file);
>>>>>>> 97df496a385b551c22b8b915f775accc7c4dd07e
}