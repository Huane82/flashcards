let wordList = [];

/**
 * 🌐 取得預設字庫名稱（相容 i18n）
 */
function getStorageDefaultCatName() {
  if (typeof t === 'function') {
    const val = t('defaultCategoryName');
    if (val && val !== 'defaultCategoryName') return val;
  }
  return '預設字庫';
}

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

  const aReps = (a.reps || 0) + (a.knowStreak || a.streak || 0);
  const bReps = (b.reps || 0) + (b.knowStreak || b.streak || 0);
  if (aReps !== bReps) return aReps - bReps;

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
 * 🔄 跨字庫進度同步（同步更新其他字庫中的同名單字，含 FSRS 與自由加練進度）
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
      target.knowStreak = sourceCard.knowStreak || 0;
      target.lastReview = sourceCard.lastReview;
      target.nextReview = sourceCard.nextReview;
      target.freeLevel = typeof sourceCard.freeLevel === 'number' ? sourceCard.freeLevel : 1;
      target.freeStreak = typeof sourceCard.freeStreak === 'number' ? sourceCard.freeStreak : 0;
      target.updatedAt = sourceCard.updatedAt || Date.now();
      syncedCount++;
    }
  }
  return syncedCount;
}

const StorageEngine = {
  LOCAL_DECKS_KEY: 'flashcards_decks',
  LOCAL_APIKEY_KEY: 'flashcard_gemini_key_v1',
  LOCAL_DIRTY_KEY: 'lzhcard_dirty_sync',
  LOCAL_QUIZ_SCORE_KEY: 'lzhcard_quiz_score',
  _cloudSaveTimer: null,
  _inFlightLoad: null,

  getCurrentUid() {
    return (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser)
      ? firebase.auth().currentUser.uid
      : null;
  },

  /**
   * 🗑️ 同字庫重複單字自動清理（保留進度最高者，補齊缺漏欄位，並刪除多餘項）
   */
  deduplicateSameDeckWords(decks) {
    if (!Array.isArray(decks) || decks.length === 0) return false;
    const defaultCatName = getStorageDefaultCatName();
    const seen = new Map();
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

      if (typeof card.freeLevel !== 'number') card.freeLevel = 1;
      if (typeof card.freeStreak !== 'number') card.freeStreak = 0;

      if (neededMigration) {
        hasMigrated = true;
      }
    }

    return hasMigrated;
  },

  sanitizeDecksForStorage(decks) {
    if (!Array.isArray(decks)) return [];
    return decks.map(card => {
      if (!card || typeof card !== 'object') return card;
      if (typeof migrateCardFSRS === 'function') {
        migrateCardFSRS(card);
      }
      if (typeof card.freeLevel !== 'number') card.freeLevel = 1;
      if (typeof card.freeStreak !== 'number') card.freeStreak = 0;

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
   * 🔀 合併雲端與本機單字進度（以 updatedAt 較新者為準，避免尚未上傳的作答被舊雲端覆蓋）
   */
  mergeRemoteAndLocalDecks(remoteDecks, localDecks, isLocalDirty) {
    if (!Array.isArray(localDecks) || localDecks.length === 0) {
      return { decks: Array.isArray(remoteDecks) ? remoteDecks : [], needsCloudSync: false };
    }
    if (!Array.isArray(remoteDecks) || remoteDecks.length === 0) {
      return { decks: localDecks, needsCloudSync: true };
    }

    const defaultCatName = getStorageDefaultCatName();
    const localById = new Map();
    const localByKey = new Map();

    localDecks.forEach(c => {
      if (!c || typeof c !== 'object') return;
      if (c.id) localById.set(c.id, c);
      const norm = (c.word || '').trim().toLowerCase();
      if (norm) {
        const cat = (c.category || defaultCatName).trim();
        localByKey.set(`${cat}::${norm}`, c);
      }
    });

    let needsCloudSync = Boolean(isLocalDirty);
    const seenIds = new Set();
    const seenKeys = new Set();

    const merged = remoteDecks.map(remoteCard => {
      if (!remoteCard || typeof remoteCard !== 'object') return remoteCard;
      const norm = (remoteCard.word || '').trim().toLowerCase();
      const cat = (remoteCard.category || defaultCatName).trim();
      const compositeKey = norm ? `${cat}::${norm}` : null;

      if (remoteCard.id) seenIds.add(remoteCard.id);
      if (compositeKey) seenKeys.add(compositeKey);

      const localCard = (remoteCard.id && localById.get(remoteCard.id))
        || (compositeKey && localByKey.get(compositeKey));

      if (localCard) {
        const localTs = typeof localCard.updatedAt === 'number' ? localCard.updatedAt : 0;
        const remoteTs = typeof remoteCard.updatedAt === 'number' ? remoteCard.updatedAt : 0;

        if (localTs > remoteTs) {
          needsCloudSync = true;
          return { ...remoteCard, ...localCard };
        }
      }

      return remoteCard;
    });

    // 若本機有尚未成功同步至雲端的新增單字，一併保留並補傳
    if (isLocalDirty) {
      localDecks.forEach(localCard => {
        if (!localCard || typeof localCard !== 'object') return;
        const norm = (localCard.word || '').trim().toLowerCase();
        const cat = (localCard.category || defaultCatName).trim();
        const compositeKey = norm ? `${cat}::${norm}` : null;

        const alreadyExists = (localCard.id && seenIds.has(localCard.id))
          || (compositeKey && seenKeys.has(compositeKey));

        if (!alreadyExists) {
          merged.push(localCard);
          needsCloudSync = true;
        }
      });
    }

    return { decks: merged, needsCloudSync };
  },

  getLocalQuizScore() {
    try {
      const raw = localStorage.getItem(this.LOCAL_QUIZ_SCORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.correct === 'number' && typeof parsed.total === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    return { correct: 0, total: 0, updatedAt: 0 };
  },

  applyQuizScoreState(scoreObj) {
    if (!scoreObj || typeof scoreObj.correct !== 'number' || typeof scoreObj.total !== 'number') return;
    localStorage.setItem(this.LOCAL_QUIZ_SCORE_KEY, JSON.stringify(scoreObj));
    if (typeof window.syncQuizScoreFromStorage === 'function') {
      window.syncQuizScoreFromStorage(scoreObj);
    } else {
      const scoreElem = document.getElementById('quizScore');
      if (scoreElem) scoreElem.innerText = `${scoreObj.correct}/${scoreObj.total}`;
    }
  },

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

  async loadData() {
    const uid = this.getCurrentUid();
    const loadKey = uid || 'guest';

    // 避免同一身份重複並發載入造成競態覆蓋
    if (this._inFlightLoad && this._inFlightLoad.key === loadKey) {
      return this._inFlightLoad.promise;
    }

    const runLoad = async () => {
      let localDecks = [];
      try {
        const rawLocal = localStorage.getItem(this.LOCAL_DECKS_KEY);
        if (rawLocal) localDecks = JSON.parse(rawLocal);
      } catch (e) {
        localDecks = [];
      }
      const isLocalDirty = localStorage.getItem(this.LOCAL_DIRTY_KEY) === 'true';

      if (uid && typeof db !== 'undefined') {
        try {
          const docRef = db.collection('users').doc(uid);
          const doc = await docRef.get();

          if (doc.exists) {
            const data = doc.data();
            let remoteDecks = [];

            if (data.decks && Array.isArray(data.decks)) {
              remoteDecks = data.decks;
            } else if (data.wordList && Array.isArray(data.wordList)) {
              remoteDecks = data.wordList;
            }

            const { decks: mergedDecks, needsCloudSync } = this.mergeRemoteAndLocalDecks(
              remoteDecks,
              localDecks,
              isLocalDirty
            );

            wordList = mergedDecks;
            const migrated = this.migrateAllCardsFSRS(wordList);
            const deduped = this.deduplicateSameDeckWords(wordList);
            localStorage.setItem(this.LOCAL_DECKS_KEY, JSON.stringify(wordList));

            // 合併隨堂測驗累計分數
            const localQuiz = this.getLocalQuizScore();
            const remoteQuiz = data.quizScore || { correct: 0, total: 0, updatedAt: 0 };
            const bestQuiz = (localQuiz.updatedAt || 0) > (remoteQuiz.updatedAt || 0) ? localQuiz : remoteQuiz;
            this.applyQuizScoreState(bestQuiz);

            if (migrated || deduped || needsCloudSync || (localQuiz.updatedAt || 0) > (remoteQuiz.updatedAt || 0)) {
              await this.flushCloudSave();
            } else {
              localStorage.removeItem(this.LOCAL_DIRTY_KEY);
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
            const localApiKey = localStorage.getItem(this.LOCAL_APIKEY_KEY) || '';
            const initialDecks = Array.isArray(localDecks) ? localDecks : [];
            this.migrateAllCardsFSRS(initialDecks);
            this.deduplicateSameDeckWords(initialDecks);
            const sanitizedDecks = this.sanitizeDecksForStorage(initialDecks);
            const currentSettings = this.getLocalSettings();
            const localQuiz = this.getLocalQuizScore();

            await docRef.set({
              decks: sanitizedDecks,
              apiKey: localApiKey,
              settings: currentSettings,
              quizScore: localQuiz,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            wordList = sanitizedDecks;
            localStorage.setItem(this.LOCAL_DECKS_KEY, JSON.stringify(wordList));
            localStorage.removeItem(this.LOCAL_DIRTY_KEY);
            this.applyQuizScoreState(localQuiz);

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

      wordList = Array.isArray(localDecks) ? localDecks : [];
      const migratedLocal = this.migrateAllCardsFSRS(wordList);
      const dedupedLocal = this.deduplicateSameDeckWords(wordList);
      if (migratedLocal || dedupedLocal) {
        localStorage.setItem(this.LOCAL_DECKS_KEY, JSON.stringify(wordList));
      }
      this.applyQuizScoreState(this.getLocalQuizScore());
      return wordList;
    };

    const promise = runLoad().finally(() => {
      if (this._inFlightLoad && this._inFlightLoad.promise === promise) {
        this._inFlightLoad = null;
      }
    });

    this._inFlightLoad = { key: loadKey, promise };
    return promise;
  },

  async flushCloudSave() {
    if (this._cloudSaveTimer) {
      clearTimeout(this._cloudSaveTimer);
      this._cloudSaveTimer = null;
    }

    const uid = this.getCurrentUid();
    const currentApiKey = localStorage.getItem(this.LOCAL_APIKEY_KEY) || '';
    const currentSettings = this.getLocalSettings();
    const sanitizedDecks = this.sanitizeDecksForStorage(wordList);
    const currentQuizScore = this.getLocalQuizScore();

    if (uid && typeof db !== 'undefined') {
      try {
        await db.collection('users').doc(uid).set({
          decks: sanitizedDecks,
          apiKey: currentApiKey,
          settings: currentSettings,
          quizScore: currentQuizScore,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        localStorage.removeItem(this.LOCAL_DIRTY_KEY);
      } catch (e) {
        console.error("雲端同步失敗:", e);
      }
    }
  },

  async saveData(decks) {
    if (Array.isArray(decks)) {
      this.deduplicateSameDeckWords(decks);
    }
    const sanitizedDecks = this.sanitizeDecksForStorage(decks);

    localStorage.setItem(this.LOCAL_DECKS_KEY, JSON.stringify(sanitizedDecks));
    localStorage.setItem(this.LOCAL_DIRTY_KEY, 'true');

    if (this._cloudSaveTimer) {
      clearTimeout(this._cloudSaveTimer);
    }

    this._cloudSaveTimer = setTimeout(() => {
      this.flushCloudSave();
    }, 400);
  }
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && (StorageEngine._cloudSaveTimer || localStorage.getItem(StorageEngine.LOCAL_DIRTY_KEY) === 'true')) {
      StorageEngine.flushCloudSave();
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (StorageEngine._cloudSaveTimer || localStorage.getItem(StorageEngine.LOCAL_DIRTY_KEY) === 'true') {
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
