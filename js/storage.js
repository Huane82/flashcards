let wordList = [];

const StorageEngine = {
  LOCAL_DECKS_KEY: 'flashcards_decks',
  LOCAL_APIKEY_KEY: 'flashcard_gemini_key_v1',

  getCurrentUid() {
    return (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) 
      ? firebase.auth().currentUser.uid 
      : null;
  },

  /**
   * 抓取當前裝置的所有偏好設定（含 API 金鑰模式與新手導覽狀態）
   */
  getLocalSettings() {
    return {
      nativeLang: localStorage.getItem('lzhcard_native_lang') || 'zh-TW',
      targetLang: localStorage.getItem('lzhcard_target_lang') || 'en',
      customNative: localStorage.getItem('lzhcard_custom_native') || '',
      customTarget: localStorage.getItem('lzhcard_custom_target') || '',
      displayMode: localStorage.getItem('lzhcard_display_mode') || 'target_front',
      phoneticPos: localStorage.getItem('lzhcard_phonetic_pos') || 'front',
      theme: localStorage.getItem('theme_preference') || 'system',
      apiMode: localStorage.getItem('lzhcard_api_mode') || 'shared',
      onboardingCompleted: localStorage.getItem('lzhcard_onboarding_completed') === 'true'
    };
  },

  /**
   * 將雲端載入的設定同步寫回本機，並強制更新選單 UI 狀態
   */
  applyRemoteSettings(settings) {
    if (!settings) return;
    if (settings.nativeLang) localStorage.setItem('lzhcard_native_lang', settings.nativeLang);
    if (settings.targetLang) localStorage.setItem('lzhcard_target_lang', settings.targetLang);
    if (typeof settings.customNative === 'string') localStorage.setItem('lzhcard_custom_native', settings.customNative);
    if (typeof settings.customTarget === 'string') localStorage.setItem('lzhcard_custom_target', settings.customTarget);
    if (settings.displayMode) localStorage.setItem('lzhcard_display_mode', settings.displayMode);
    if (settings.phoneticPos) localStorage.setItem('lzhcard_phonetic_pos', settings.phoneticPos);
    if (settings.theme) localStorage.setItem('theme_preference', settings.theme);

    // 同步雲端的 API 金鑰模式
    if (settings.apiMode === 'personal' || settings.apiMode === 'shared') {
      localStorage.setItem('lzhcard_api_mode', settings.apiMode);
    }

    // 同步新手設定完成狀態（若雲端已完成，確保關閉新手設定彈窗）
    if (settings.onboardingCompleted === true) {
      localStorage.setItem('lzhcard_onboarding_completed', 'true');
      if (typeof closeModal === 'function') closeModal('onboardingSetupModal');
    }

    // 🌟 把從雲端同步下來的最新設定更新至畫面的選單中
    if (typeof syncSettingsUI === 'function') syncSettingsUI();
    if (typeof applyLanguageUI === 'function') applyLanguageUI();
    if (typeof applyTheme === 'function') applyTheme(settings.theme || 'system');
    if (typeof updateApiKeyStatusUI === 'function') updateApiKeyStatusUI();
  },

  /**
   * 載入雲端/本機資料與設定
   */
  async loadData() {
    const uid = this.getCurrentUid();
    
    if (uid && typeof db !== 'undefined') {
      try {
        const docRef = db.collection('users').doc(uid);
        const doc = await docRef.get();

        if (doc.exists) {
          const data = doc.data();

          // 1. 同步雲端字庫
          if (data.decks && Array.isArray(data.decks)) {
            localStorage.setItem(this.LOCAL_DECKS_KEY, JSON.stringify(data.decks));
            wordList = data.decks;
          } else if (data.wordList && Array.isArray(data.wordList)) {
            localStorage.setItem(this.LOCAL_DECKS_KEY, JSON.stringify(data.wordList));
            wordList = data.wordList;
          }

          // 2. 同步雲端 API Key
          if (data.apiKey) {
            localStorage.setItem(this.LOCAL_APIKEY_KEY, data.apiKey);
            if (typeof updateApiKeyStatusUI === 'function') updateApiKeyStatusUI();
          }

          // 3. 🌟 同步雲端個人設定（含 apiMode 與 onboardingCompleted）
          if (data.settings) {
            this.applyRemoteSettings(data.settings);
          }

          // 4. 雲端設定同步完成後，再決定是否開啟新手導覽
          if (typeof checkAndOpenOnboardingModal === 'function') {
            checkAndOpenOnboardingModal();
          }

          return wordList;
        } else {
          // 若雲端無資料，將本機字庫、API Key 及系統設定完整上傳初始化
          const localDecks = localStorage.getItem(this.LOCAL_DECKS_KEY);
          const localApiKey = localStorage.getItem(this.LOCAL_APIKEY_KEY) || '';
          const initialDecks = localDecks ? JSON.parse(localDecks) : [];
          const currentSettings = this.getLocalSettings();

          await docRef.set({
            decks: initialDecks,
            apiKey: localApiKey,
            settings: currentSettings,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          wordList = initialDecks;

          // 新帳號初始化完成後開啟新手導覽
          if (typeof checkAndOpenOnboardingModal === 'function') {
            checkAndOpenOnboardingModal();
          }

          return wordList;
        }
      } catch (e) {
        console.warn("Firestore 讀取失敗，降級使用 LocalStorage:", e);
        if (typeof checkAndOpenOnboardingModal === 'function') {
          checkAndOpenOnboardingModal();
        }
      }
    }
    
    // 未登入狀態：從本機 LocalStorage 讀取
    const localData = localStorage.getItem(this.LOCAL_DECKS_KEY);
    wordList = localData ? JSON.parse(localData) : [];
    return wordList;
  },

  /**
   * 儲存字庫、API Key 與系統設定至本機與雲端
   */
  async saveData(decks) {
    // 1. 寫入本機 LocalStorage
    localStorage.setItem(this.LOCAL_DECKS_KEY, JSON.stringify(decks));

    // 2. 寫入雲端 Firestore
    const uid = this.getCurrentUid();
    const currentApiKey = localStorage.getItem(this.LOCAL_APIKEY_KEY) || '';
    const currentSettings = this.getLocalSettings();

    if (uid && typeof db !== 'undefined') {
      try {
        await db.collection('users').doc(uid).set({
          decks: decks,
          apiKey: currentApiKey,
          settings: currentSettings,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log("已成功同步字庫、API Key 與系統設定至 Cloud Firestore");
      } catch (e) {
        console.error("雲端同步失敗:", e);
      }
    }
  }
};

async function loadStorage() {
  await StorageEngine.loadData();
  if (typeof updateCategorySelects === 'function') updateCategorySelects();
  if (typeof updateUI === 'function') updateUI();
  if (typeof nextCard === 'function') nextCard();
  if (typeof updateApiKeyStatusUI === 'function') updateApiKeyStatusUI();
}

async function saveStorage() {
  await StorageEngine.saveData(wordList);
}
