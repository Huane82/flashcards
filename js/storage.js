let wordList = [];

/**
 * 🏆 比較兩張單字卡的學習進度（回傳 > 0 代表 a 進度高於 b）
 */
function compareCardProgress(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  const aLearned = (a.state && a.state !== 'new') ? 1 : 0;
  const bLearned = (b.state && b.state !== 'new') ? 1 : 0;
  if (aLearned !== bLearned) return aLearned - bLearned;

  const aLv = a.level || 1;
  const bLv = b.level || 1;
  if (aLv !== bLv) return aLv - bLv;

  const aStab = typeof a.stability === 'number' ? a.stability : 0;
  const bStab = typeof b.stability === 'number' ? b.stability : 0;
  if (Math.abs(aStab - bStab) > 0.001) return aStab - bStab;

  const aReps = (a.reps || 0) + (a.streak || 0);
  const bReps = (b.reps || 0) + (b.streak || 0);
  if (aReps !== bReps) return aReps - bReps;

  // 進度完全相同時，優先保留欄位較完整（有釋義/例句/音標）的卡片
  const completeness = (c) =>
    (c.meaning ? 1 : 0) +
    (c.sentence ? 1 : 0) +
    (c.phonetic ? 1 : 0) +
    (c.pos ? 1 : 0) +
    (c.translation ? 1 : 0);

  return completeness(a) - completeness(b);
}

/**
 * 🔍 跨字庫去重（依單字小寫去重，只保留進度最高的那一張）
 */
function deduplicateWordsByHighestProgress(cards) {
  if (!Array.isArray(cards)) return [];
  const result = [];
  const indexByWord = new Map();

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card || typeof card !== 'object') continue;

    const norm = (card.word || '').trim().toLowerCase();
    if (!norm) {
      result.push(card);
      continue;
    }

    if (!indexByWord.has(norm)) {
      indexByWord.set(norm, result.length);
      result.push(card);
    } else {
      const existingIdx = indexByWord.get(norm);
      if (compareCardProgress(card, result[existingIdx]) > 0) {
        result[existingIdx] = card;
      }
    }
  }

  return result;
}

/**
 * 🔄 跨字庫進度同步（當某張單字升級/更新排程時，同步更新其他字庫中的同名單字）
 */
function syncDuplicateWordsProgress(sourceCard, decks = wordList) {
  if (!sourceCard || !Array.isArray(decks)) return 0;
  const norm = (sourceCard.word || '').trim().toLowerCase();
  if (!norm) return 0;

  let syncedCount = 0;
  for (let i = 0; i < decks.length; i++) {
    const target = decks[i];
    if (!target || target === sourceCard) continue;
    if ((target.word || '').trim().toLowerCase() === norm) {
      target.level = sourceCard.level;
      target.state = sourceCard.state;
      target.stability = sourceCard.stability;
      target.difficulty = sourceCard.difficulty;
      target.reps = sourceCard.reps;
      target.lapses = sourceCard.lapses;
      target.lastReview = sourceCard.lastReview;
      target.nextReview = sourceCard.nextReview;
      if (typeof sourceCard.streak === 'number') {
        target.streak = sourceCard.streak;
      }
      syncedCount++;
    }
  }
  return syncedCount;
}

const StorageEngine = {
  LOCAL_DECKS_KEY: 'flashcards_decks',
  LOCAL_APIKEY_KEY: 'flashcard_gemini_key_v1',
  _cloudSaveTimer: null,

  getCurrentUid() {
    return (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) 
      ? firebase.auth().currentUser.uid 
      : null;
  },

  /**
   * 🗑️ 同字庫重複單字自動清理（保留進度最高者，補齊缺漏欄位，並刪除多餘項）
   * @returns {boolean} 是否有刪除重複單字
   */
  deduplicateSameDeckWords(decks) {
    if (!Array.isArray(decks) || decks.length === 0) return false;
    const defaultCatName = (typeof t === 'function') ? t('defaultCategoryName') : '預設字庫';
    const seen = new Map(); // key: `${cat}::${normWord}` -> index in deduped
    const deduped = [];
    let removed = false;

    const mergeMissingFields = (winner, loser) => {
      const fields = ['pos', 'phonetic', 'meaning', 'sentence', 'translation'];
      fields.forEach(f => {
        if ((!winner[f] || !String(winner[f]).trim()) && loser[f] && String(loser[f]).trim()) {
          winner[f] = loser[f];
        }
      });
    };

    for (let i = 0; i < decks.length; i++) {
      const card = decks[i];
      if (!card || typeof card !== 'object') continue;

      const normWord = (card.word || '').trim().toLowerCase();
      if (!normWord) {
        deduped.push(card);
        continue;
      }

      const cat = (card.category || defaultCatName).trim();
      const key = `${cat}::${normWord}`;

      if (!seen.has(key)) {
        seen.set(key, deduped.length);
        deduped.push(card);
      } else {
        removed = true;
        const existingIdx = seen.get(key);
        const existing = deduped[existingIdx];

        if (compareCardProgress(card, existing) > 0) {
          mergeMissingFields(card, existing);
          deduped[existingIdx] = card;
        } else {
          mergeMissingFields(existing, card);
        }
      }
    }

    if (removed) {
      decks.length = 0;
      decks.push(...deduped);
    }

    return removed;
  },

  /**
   * 🔄 為整份字庫補齊 FSRS 記憶排程欄位（相容舊版資料與匯入備份）
   * @returns {boolean} 是否有舊卡片剛完成欄位遷移
   */
  migrateAllCardsFSRS(decks) {
    if (!Array.isArray(decks)) return false;
    let hasMigrated = false;

    for (let i = 0; i < decks.length; i++) {
      const card = decks[i];
      if (!card || typeof card !== 'object') continue;

      const neededMigration = (
        typeof card.stability !== 'number' ||
        typeof card.difficulty !== 'number' ||
        typeof card.nextReview !== 'number' ||
        !card.state
      );

      if (typeof migrateCardFSRS === 'function') {
        migrateCardFSRS(card);
      }

      if (neededMigration) {
        hasMigrated = true;
      }
    }

    return hasMigrated;
  },

  /**
   * 🧹 淨化單字物件（補齊 FSRS 欄位並移除 undefined，避免 Firestore 寫入失敗）
   */
  sanitizeDecksForStorage(decks) {
    if (!Array.isArray(decks)) return [];
    return decks.map(card => {
      if (!card || typeof card !== 'object') return card;
      if (typeof migrateCardFSRS === 'function') {
        migrateCardFSRS(card);
      }
      const clean = {};
      Object.keys(card).forEach(k => {
        if (card[k] !== undefined) {
          clean[k] = card[k];
        }
      });
      return clean;
    });
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

    if (settings.apiMode === 'personal' || settings.apiMode === 'shared') {
      localStorage.setItem('lzhcard_api_mode', settings.apiMode);
    }

    if (settings.onboardingCompleted === true) {
      localStorage.setItem('lzhcard_onboarding_completed', 'true');
      if (typeof closeModal === 'function') closeModal('onboardingSetupModal');
    }

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

          if (data.decks && Array.isArray(data.decks)) {
            wordList = data.decks;
          } else if (data.wordList && Array.isArray(data.wordList)) {
            wordList = data.wordList;
          }

          const migrated = this.migrateAllCardsFSRS(wordList);
          const deduped = this.deduplicateSameDeckWords(wordList);
          localStorage.setItem(this.LOCAL_DECKS_KEY, JSON.stringify(wordList));
          if (migrated || deduped) {
            this.saveData(wordList);
          }

          if (data.apiKey) {
            localStorage.setItem(this.LOCAL_APIKEY_KEY, data.apiKey);
            if (typeof updateApiKeyStatusUI === 'function') updateApiKeyStatusUI();
          }

          if (data.settings) {
            this.applyRemoteSettings(data.settings);
          }

          if (typeof checkAndOpenOnboardingModal === 'function') {
            checkAndOpenOnboardingModal();
          }

          return wordList;
        } else {
          const localDecks = localStorage.getItem(this.LOCAL_DECKS_KEY);
          const localApiKey = localStorage.getItem(this.LOCAL_APIKEY_KEY) || '';
          const initialDecks = localDecks ? JSON.parse(localDecks) : [];
          this.migrateAllCardsFSRS(initialDecks);
          this.deduplicateSameDeckWords(initialDecks);
          const sanitizedDecks = this.sanitizeDecksForStorage(initialDecks);
          const currentSettings = this.getLocalSettings();

          await docRef.set({
            decks: sanitizedDecks,
            apiKey: localApiKey,
            settings: currentSettings,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          wordList = sanitizedDecks;
          localStorage.setItem(this.LOCAL_DECKS_KEY, JSON.stringify(wordList));

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
    
    const localData = localStorage.getItem(this.LOCAL_DECKS_KEY);
    wordList = localData ? JSON.parse(localData) : [];
    const migratedLocal = this.migrateAllCardsFSRS(wordList);
    const dedupedLocal = this.deduplicateSameDeckWords(wordList);
    if (migratedLocal || dedupedLocal) {
      localStorage.setItem(this.LOCAL_DECKS_KEY, JSON.stringify(wordList));
    }
    return wordList;
  },

  /**
   * 立即執行 pending 中的雲端同步（切換分頁或關閉視窗時呼叫）
   */
  async flushCloudSave() {
    if (this._cloudSaveTimer) {
      clearTimeout(this._cloudSaveTimer);
      this._cloudSaveTimer = null;
    }

    const uid = this.getCurrentUid();
    const currentApiKey = localStorage.getItem(this.LOCAL_APIKEY_KEY) || '';
    const currentSettings = this.getLocalSettings();
    const sanitizedDecks = this.sanitizeDecksForStorage(wordList);

    if (uid && typeof db !== 'undefined') {
      try {
        await db.collection('users').doc(uid).set({
          decks: sanitizedDecks,
          apiKey: currentApiKey,
          settings: currentSettings,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log("已成功同步字庫、FSRS 排程、API Key 與系統設定至 Cloud Firestore");
      } catch (e) {
        console.error("雲端同步失敗:", e);
      }
    }
  },

  /**
   * 儲存字庫、API Key 與系統設定至本機與雲端（雲端寫入採 1.5 秒防抖合併）
   */
  async saveData(decks) {
    if (Array.isArray(decks)) {
      this.deduplicateSameDeckWords(decks);
    }
    const sanitizedDecks = this.sanitizeDecksForStorage(decks);

    // 1. 立即寫入本機 LocalStorage，確保進度不遺失
    localStorage.setItem(this.LOCAL_DECKS_KEY, JSON.stringify(sanitizedDecks));

    // 2. 防抖寫入雲端 Firestore（連續刷卡時合併為停手後 1.5 秒一次上傳）
    if (this._cloudSaveTimer) {
      clearTimeout(this._cloudSaveTimer);
    }

    this._cloudSaveTimer = setTimeout(() => {
      this.flushCloudSave();
    }, 1500);
  }
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && StorageEngine._cloudSaveTimer) {
      StorageEngine.flushCloudSave();
    }
  });
}

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
