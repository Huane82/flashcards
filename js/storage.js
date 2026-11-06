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
}