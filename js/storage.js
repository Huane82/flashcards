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
 * 🔢 安全數值轉換（徹底阻絕 NaN / Infinity 進入 Firestore 導致整包寫入失敗）
 */
function toFiniteNumber(val, fallback = 0) {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * 🧹 遞迴淨化任何物件，移除 undefined / NaN / Infinity / function
 */
function deepSanitizeForFirestore(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => deepSanitizeForFirestore(item));
  }
  if (typeof value === 'object') {
    const cleanObj = {};
    Object.keys(value).forEach(key => {
      const v = value[key];
      if (v !== undefined && typeof v !== 'function') {
        cleanObj[key] = deepSanitizeForFirestore(v);
      }
    });
    return cleanObj;
  }
  return String(value);
}

/**
 * 🗄️ IndexedDB 本機大型資料庫封裝（突破 localStorage 5MB 上限，支援數萬筆完整單字）
 */
const LocalIDB = {
  DB_NAME: 'LZHCard_LocalDB',
  DB_VERSION: 1,
  STORE_NAME: 'kv_store',
  _dbPromise: null,

  isSupported() {
    return typeof indexedDB !== 'undefined';
  },

  open() {
    if (!this.isSupported()) {
      return Promise.reject(new Error('IndexedDB not supported'));
    }
    if (this._dbPromise) return this._dbPromise;

    this._dbPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            db.createObjectStore(this.STORE_NAME);
          }
        };

        request.onsuccess = (event) => {
          const db = event.target.result;
          db.onclose = () => { this._dbPromise = null; };
          db.onversionchange = () => {
            db.close();
            this._dbPromise = null;
          };
          resolve(db);
        };

        request.onerror = (event) => {
          this._dbPromise = null;
          reject(event.target.error || new Error('IndexedDB open error'));
        };
      } catch (err) {
        this._dbPromise = null;
        reject(err);
      }
    });

    return this._dbPromise;
  },

  async get(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async set(key, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('IndexedDB write aborted'));
    });
  },

  async remove(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};

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

  const aLv = toFiniteNumber(a.level, 1);
  const bLv = toFiniteNumber(b.level, 1);
  if (aLv !== bLv) return aLv - bLv;

  const aStab = toFiniteNumber(a.stability, 0);
  const bStab = toFiniteNumber(b.stability, 0);
  if (Math.abs(aStab - bStab) > 0.001) return aStab - bStab;

  const aReps = toFiniteNumber(a.reps, 0) + toFiniteNumber(a.knowStreak ?? a.streak, 0);
  const bReps = toFiniteNumber(b.reps, 0) + toFiniteNumber(b.knowStreak ?? b.streak, 0);
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
      target.level = toFiniteNumber(sourceCard.level, 1);
      target.state = sourceCard.state || 'new';
      target.stability = toFiniteNumber(sourceCard.stability, 0);
      target.difficulty = toFiniteNumber(sourceCard.difficulty, 5.5);
      target.reps = toFiniteNumber(sourceCard.reps, 0);
      target.lapses = toFiniteNumber(sourceCard.lapses, 0);
      target.knowStreak = toFiniteNumber(sourceCard.knowStreak, 0);
      target.lastReview = toFiniteNumber(sourceCard.lastReview, 0);
      target.nextReview = toFiniteNumber(sourceCard.nextReview, 0);
      target.freeLevel = toFiniteNumber(sourceCard.freeLevel, 1);
      target.freeStreak = toFiniteNumber(sourceCard.freeStreak, 0);
      target.updatedAt = toFiniteNumber(sourceCard.updatedAt, Date.now());
      syncedCount++;
    }
  }
  return syncedCount;
}

const StorageEngine = {
  LOCAL_DECKS_KEY: 'flashcards_decks',
  LOCAL_APIKEY_KEY: 'flashcard_gemini_key_v1',
  LOCAL_DIRTY_KEY: 'lzhcard_dirty_sync',
  LOCAL_DELETED_KEY: 'lzhcard_deleted_keys',
  LOCAL_QUIZ_SCORE_KEY: 'lzhcard_quiz_score',
  CHUNK_TARGET_BYTES: 350000, // 每個雲端分片上限約 350 KB（遠低於 Firestore 1MB 限制）
  _cloudSaveTimer: null,
  _retryTimer: null,
  _retryCount: 0,
  _inFlightLoad: null,
  _isFlushing: false,
  _hasPendingFlush: false,
  _lastSyncErrorToastAt: 0,
  _lastKnownDecks: null,
  _deletedKeysCache: null,

  getCurrentUid() {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      return firebase.auth().currentUser.uid;
    }
    if (typeof auth !== 'undefined' && auth && auth.currentUser) {
      return auth.currentUser.uid;
    }
    return null;
  },

  buildCardCompositeKey(card, defaultCatName = getStorageDefaultCatName()) {
    if (!card || typeof card !== 'object') return null;
    const norm = (card.word || '').trim().toLowerCase();
    if (!norm) return null;
    const cat = (card.category || defaultCatName).trim();
    return `${cat}::${norm}`;
  },

  updateLastKnownDecksSnapshot(decks) {
    if (!Array.isArray(decks)) {
      this._lastKnownDecks = [];
      return;
    }
    this._lastKnownDecks = decks.map(c => ({
      id: c.id,
      word: c.word,
      category: c.category
    }));
  },

  /**
   * 📥 從 IndexedDB 讀取本機單字庫（若舊版 localStorage 尚有資料則自動無痛遷移並釋放 5MB 空間）
   */
  async getLocalDecks() {
    try {
      const idbDecks = await LocalIDB.get(this.LOCAL_DECKS_KEY);
      if (Array.isArray(idbDecks)) {
        if (localStorage.getItem(this.LOCAL_DECKS_KEY) !== null) {
          localStorage.removeItem(this.LOCAL_DECKS_KEY);
        }
        return idbDecks;
      }

      // 首次升級：從舊版 localStorage 遷移進 IndexedDB
      const rawLegacy = localStorage.getItem(this.LOCAL_DECKS_KEY);
      if (rawLegacy) {
        const parsed = JSON.parse(rawLegacy);
        if (Array.isArray(parsed)) {
          await LocalIDB.set(this.LOCAL_DECKS_KEY, parsed);
          localStorage.removeItem(this.LOCAL_DECKS_KEY);
          return parsed;
        }
      }
      return [];
    } catch (e) {
      console.warn("IndexedDB 讀取單字失敗，降級使用 LocalStorage:", e);
      try {
        const rawLocal = localStorage.getItem(this.LOCAL_DECKS_KEY);
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (err) {}
      return [];
    }
  },

  /**
   * 💾 寫入本機單字庫至 IndexedDB（直接儲存 JS 物件陣列，無 5MB 限制）
   */
  async setLocalDecks(decks) {
    const safeArray = Array.isArray(decks) ? decks : [];
    try {
      await LocalIDB.set(this.LOCAL_DECKS_KEY, safeArray);
      if (localStorage.getItem(this.LOCAL_DECKS_KEY) !== null) {
        localStorage.removeItem(this.LOCAL_DECKS_KEY);
      }
    } catch (e) {
      console.warn("IndexedDB 寫入單字失敗，降級使用 LocalStorage:", e);
      try {
        localStorage.setItem(this.LOCAL_DECKS_KEY, JSON.stringify(safeArray));
      } catch (quotaErr) {
        console.error("本機儲存空間已滿:", quotaErr);
      }
    }
  },

  async getDeletedKeysSet() {
    if (this._deletedKeysCache instanceof Set) {
      return this._deletedKeysCache;
    }

    try {
      const idbDeleted = await LocalIDB.get(this.LOCAL_DELETED_KEY);
      if (Array.isArray(idbDeleted)) {
        if (localStorage.getItem(this.LOCAL_DELETED_KEY) !== null) {
          localStorage.removeItem(this.LOCAL_DELETED_KEY);
        }
        this._deletedKeysCache = new Set(idbDeleted);
        return this._deletedKeysCache;
      }

      const rawLegacy = localStorage.getItem(this.LOCAL_DELETED_KEY);
      if (rawLegacy) {
        const parsed = JSON.parse(rawLegacy);
        if (Array.isArray(parsed)) {
          await LocalIDB.set(this.LOCAL_DELETED_KEY, parsed);
          localStorage.removeItem(this.LOCAL_DELETED_KEY);
          this._deletedKeysCache = new Set(parsed);
          return this._deletedKeysCache;
        }
      }
    } catch (e) {
      try {
        const raw = localStorage.getItem(this.LOCAL_DELETED_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this._deletedKeysCache = new Set(parsed);
            return this._deletedKeysCache;
          }
        }
      } catch (err) {}
    }

    this._deletedKeysCache = new Set();
    return this._deletedKeysCache;
  },

  async saveDeletedKeysSet(deletedSet) {
    const normalizedSet = deletedSet instanceof Set ? deletedSet : new Set();
    this._deletedKeysCache = normalizedSet;

    if (normalizedSet.size === 0) {
      try { await LocalIDB.remove(this.LOCAL_DELETED_KEY); } catch (e) {}
      localStorage.removeItem(this.LOCAL_DELETED_KEY);
      return;
    }

    const arr = Array.from(normalizedSet);
    try {
      await LocalIDB.set(this.LOCAL_DELETED_KEY, arr);
      if (localStorage.getItem(this.LOCAL_DELETED_KEY) !== null) {
        localStorage.removeItem(this.LOCAL_DELETED_KEY);
      }
    } catch (e) {
      try {
        localStorage.setItem(this.LOCAL_DELETED_KEY, JSON.stringify(arr));
      } catch (err) {}
    }
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
        !Number.isFinite(card.stability) ||
        !Number.isFinite(card.difficulty) ||
        !Number.isFinite(card.nextReview) ||
        !card.state
      );

      if (typeof migrateCardFSRS === 'function') {
        migrateCardFSRS(card);
      }

      card.level = toFiniteNumber(card.level, 1);
      card.knowStreak = toFiniteNumber(card.knowStreak, 0);
      card.stability = toFiniteNumber(card.stability, 0);
      card.difficulty = toFiniteNumber(card.difficulty, 5.5);
      card.reps = toFiniteNumber(card.reps, 0);
      card.lapses = toFiniteNumber(card.lapses, 0);
      card.lastReview = toFiniteNumber(card.lastReview, 0);
      card.nextReview = toFiniteNumber(card.nextReview, 0);
      card.freeLevel = toFiniteNumber(card.freeLevel, 1);
      card.freeStreak = toFiniteNumber(card.freeStreak, 0);
      card.updatedAt = toFiniteNumber(card.updatedAt, Date.now());

      if (neededMigration) {
        hasMigrated = true;
      }
    }

    return hasMigrated;
  },

  /**
   * 🧱 還原完整欄位結構（供記憶體與 UI 使用）
   */
  sanitizeDecksForStorage(decks) {
    if (!Array.isArray(decks)) return [];
    const seenIds = new Set();
    const defaultCat = getStorageDefaultCatName();

    return decks
      .filter(card => card && typeof card === 'object')
      .map((card, idx) => {
        if (typeof migrateCardFSRS === 'function') {
          migrateCardFSRS(card);
        }

        let safeId = card.id !== undefined && card.id !== null ? String(card.id).trim() : '';
        if (!safeId || seenIds.has(safeId)) {
          safeId = `w_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`;
        }
        seenIds.add(safeId);

        const normalized = {
          id: safeId,
          category: String(card.category || defaultCat).trim() || defaultCat,
          word: String(card.word || '').trim(),
          pos: String(card.pos || '').trim(),
          phonetic: String(card.phonetic || '').trim(),
          meaning: String(card.meaning || '').trim(),
          sentence: String(card.sentence || '').trim(),
          translation: String(card.translation || '').trim(),
          level: toFiniteNumber(card.level, 1),
          knowStreak: toFiniteNumber(card.knowStreak, 0),
          state: typeof card.state === 'string' && card.state ? card.state : 'new',
          stability: toFiniteNumber(card.stability, 0),
          difficulty: toFiniteNumber(card.difficulty, 5.5),
          reps: toFiniteNumber(card.reps, 0),
          lapses: toFiniteNumber(card.lapses, 0),
          lastReview: toFiniteNumber(card.lastReview, 0),
          nextReview: toFiniteNumber(card.nextReview, 0),
          freeLevel: toFiniteNumber(card.freeLevel, 1),
          freeStreak: toFiniteNumber(card.freeStreak, 0),
          updatedAt: toFiniteNumber(card.updatedAt, Date.now())
        };

        return deepSanitizeForFirestore(normalized);
      });
  },

  /**
   * 🗜️ 精簡雲端傳輸負載（省略空字串與預設初期值，大幅減少約 40%~50% 容量）
   */
  compactDecksForCloud(sanitizedDecks) {
    return sanitizedDecks.map(c => {
      const out = {
        id: c.id,
        category: c.category,
        word: c.word,
        updatedAt: c.updatedAt
      };
      if (c.pos) out.pos = c.pos;
      if (c.phonetic) out.phonetic = c.phonetic;
      if (c.meaning) out.meaning = c.meaning;
      if (c.sentence) out.sentence = c.sentence;
      if (c.translation) out.translation = c.translation;
      if (c.level !== 1) out.level = c.level;
      if (c.knowStreak !== 0) out.knowStreak = c.knowStreak;
      if (c.state && c.state !== 'new') out.state = c.state;
      if (c.stability !== 0) out.stability = c.stability;
      if (Math.abs(c.difficulty - 5.5) > 0.001) out.difficulty = c.difficulty;
      if (c.reps !== 0) out.reps = c.reps;
      if (c.lapses !== 0) out.lapses = c.lapses;
      if (c.lastReview !== 0) out.lastReview = c.lastReview;
      if (c.nextReview !== 0) out.nextReview = c.nextReview;
      if (c.freeLevel !== 1) out.freeLevel = c.freeLevel;
      if (c.freeStreak !== 0) out.freeStreak = c.freeStreak;
      return out;
    });
  },

  /**
   * 📦 將單字陣列依位元組大小切分為多個安全分片（每片 <= 350 KB）
   */
  splitIntoChunks(compactDecks, maxChunkBytes = this.CHUNK_TARGET_BYTES) {
    if (!Array.isArray(compactDecks) || compactDecks.length === 0) return [];
    const chunks = [];
    let currentChunk = [];
    let currentBytes = 64;

    for (let i = 0; i < compactDecks.length; i++) {
      const item = compactDecks[i];
      const itemBytes = new Blob([JSON.stringify(item)]).size + 2;

      if (currentChunk.length > 0 && currentBytes + itemBytes > maxChunkBytes) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentBytes = 64;
      }

      currentChunk.push(item);
      currentBytes += itemBytes;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  },

  /**
   * 🔀 合併雲端與本機單字進度（確保尚未同步至雲端的本機單字不會在重新整理後被洗掉）
   */
  async mergeRemoteAndLocalDecks(remoteDecks, localDecks, isLocalDirty) {
    const defaultCatName = getStorageDefaultCatName();
    const deletedSet = await this.getDeletedKeysSet();
    const hasPendingDeletions = deletedSet.size > 0;

    if (isLocalDirty && Array.isArray(localDecks) && localDecks.length === 0) {
      return { decks: [], needsCloudSync: true };
    }

    if ((!Array.isArray(localDecks) || localDecks.length === 0) && !hasPendingDeletions) {
      return { decks: Array.isArray(remoteDecks) ? remoteDecks : [], needsCloudSync: false };
    }

    if (!Array.isArray(remoteDecks) || remoteDecks.length === 0) {
      return { decks: Array.isArray(localDecks) ? localDecks : [], needsCloudSync: true };
    }

    const localById = new Map();
    const localByKey = new Map();

    (localDecks || []).forEach(c => {
      if (!c || typeof c !== 'object') return;
      if (c.id) localById.set(c.id, c);
      const compositeKey = this.buildCardCompositeKey(c, defaultCatName);
      if (compositeKey) localByKey.set(compositeKey, c);
    });

    let needsCloudSync = Boolean(isLocalDirty || hasPendingDeletions);
    const seenIds = new Set();
    const seenKeys = new Set();
    const merged = [];

    remoteDecks.forEach(remoteCard => {
      if (!remoteCard || typeof remoteCard !== 'object') return;
      const compositeKey = this.buildCardCompositeKey(remoteCard, defaultCatName);

      if ((remoteCard.id && deletedSet.has(remoteCard.id)) || (compositeKey && deletedSet.has(compositeKey))) {
        needsCloudSync = true;
        return;
      }

      if (remoteCard.id) seenIds.add(remoteCard.id);
      if (compositeKey) seenKeys.add(compositeKey);

      const localCard = (remoteCard.id && localById.get(remoteCard.id))
        || (compositeKey && localByKey.get(compositeKey));

      if (localCard) {
        const localTs = toFiniteNumber(localCard.updatedAt, 0);
        const remoteTs = toFiniteNumber(remoteCard.updatedAt, 0);

        if (localTs > remoteTs) {
          needsCloudSync = true;
          merged.push({ ...remoteCard, ...localCard });
          return;
        }
      }

      merged.push(remoteCard);
    });

    // 保留所有尚未同步到雲端的本機單字（避免雲端寫入曾失敗時，重整網頁導致本機新匯入的單字消失）
    if (Array.isArray(localDecks)) {
      localDecks.forEach(localCard => {
        if (!localCard || typeof localCard !== 'object') return;
        const compositeKey = this.buildCardCompositeKey(localCard, defaultCatName);

        if ((localCard.id && deletedSet.has(localCard.id)) || (compositeKey && deletedSet.has(compositeKey))) {
          return;
        }

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
          return {
            correct: toFiniteNumber(parsed.correct, 0),
            total: toFiniteNumber(parsed.total, 0),
            updatedAt: toFiniteNumber(parsed.updatedAt, 0)
          };
        }
      }
    } catch (e) {}
    return { correct: 0, total: 0, updatedAt: 0 };
  },

  applyQuizScoreState(scoreObj) {
    if (!scoreObj || typeof scoreObj.correct !== 'number' || typeof scoreObj.total !== 'number') return;
    const cleanScore = {
      correct: toFiniteNumber(scoreObj.correct, 0),
      total: toFiniteNumber(scoreObj.total, 0),
      updatedAt: toFiniteNumber(scoreObj.updatedAt, 0)
    };
    localStorage.setItem(this.LOCAL_QUIZ_SCORE_KEY, JSON.stringify(cleanScore));
    if (typeof window.syncQuizScoreFromStorage === 'function') {
      window.syncQuizScoreFromStorage(cleanScore);
    } else {
      const scoreElem = document.getElementById('quizScore');
      if (scoreElem) scoreElem.innerText = `${cleanScore.correct}/${cleanScore.total}`;
    }
  },

  getLocalSettings() {
    return deepSanitizeForFirestore({
      nativeLang: localStorage.getItem('lzhcard_native_lang') || 'zh-TW',
      targetLang: localStorage.getItem('lzhcard_target_lang') || 'en',
      customNative: localStorage.getItem('lzhcard_custom_native') || '',
      customTarget: localStorage.getItem('lzhcard_custom_target') || '',
      displayMode: localStorage.getItem('lzhcard_display_mode') || 'target_front',
      phoneticPos: localStorage.getItem('lzhcard_phonetic_pos') || 'front',
      theme: localStorage.getItem('theme_preference') || 'system',
      apiMode: localStorage.getItem('lzhcard_api_mode') || 'shared',
      onboardingCompleted: localStorage.getItem('lzhcard_onboarding_completed') === 'true'
    });
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

    if (this._inFlightLoad && this._inFlightLoad.key === loadKey) {
      return this._inFlightLoad.promise;
    }

    const runLoad = async () => {
      const localDecks = await this.getLocalDecks();
      const isLocalDirty = localStorage.getItem(this.LOCAL_DIRTY_KEY) === 'true';

      if (uid && typeof db !== 'undefined') {
        try {
          const docRef = db.collection('users').doc(uid);
          const doc = await docRef.get();

          if (doc.exists) {
            const data = doc.data();
            let remoteDecks = [];

            // 優先讀取分片子集合 deckChunks（支援突破 1MB 的大型字庫）
            if (typeof data.deckChunkCount === 'number' && data.deckChunkCount > 0) {
              try {
                const chunksSnap = await docRef.collection('deckChunks').get();
                const chunkDocs = chunksSnap.docs
                  .map(d => ({ id: d.id, ...d.data() }))
                  .sort((a, b) => {
                    const idxA = typeof a.index === 'number' ? a.index : parseInt(String(a.id).replace('chunk_', ''), 10) || 0;
                    const idxB = typeof b.index === 'number' ? b.index : parseInt(String(b.id).replace('chunk_', ''), 10) || 0;
                    return idxA - idxB;
                  });
                chunkDocs.forEach(cd => {
                  if (Array.isArray(cd.decks)) {
                    remoteDecks.push(...cd.decks);
                  }
                });
              } catch (chunkErr) {
                console.warn("讀取分片子集合失敗，嘗試讀取主文件 decks：", chunkErr);
              }
            }

            if (remoteDecks.length === 0) {
              if (data.decks && Array.isArray(data.decks)) {
                remoteDecks = data.decks;
              } else if (data.wordList && Array.isArray(data.wordList)) {
                remoteDecks = data.wordList;
              }
            }

            const { decks: mergedDecks, needsCloudSync } = await this.mergeRemoteAndLocalDecks(
              remoteDecks,
              localDecks,
              isLocalDirty
            );

            wordList = this.sanitizeDecksForStorage(mergedDecks);
            const migrated = this.migrateAllCardsFSRS(wordList);
            const deduped = this.deduplicateSameDeckWords(wordList);
            await this.setLocalDecks(wordList);
            this.updateLastKnownDecksSnapshot(wordList);

            const localQuiz = this.getLocalQuizScore();
            const remoteQuiz = data.quizScore || { correct: 0, total: 0, updatedAt: 0 };
            const bestQuiz = (localQuiz.updatedAt || 0) > (remoteQuiz.updatedAt || 0) ? localQuiz : remoteQuiz;
            this.applyQuizScoreState(bestQuiz);

            const hasLegacyWordListField = Array.isArray(data.wordList);
            if (migrated || deduped || needsCloudSync || hasLegacyWordListField || (localQuiz.updatedAt || 0) > (remoteQuiz.updatedAt || 0)) {
              await this.flushCloudSave();
            } else {
              localStorage.removeItem(this.LOCAL_DIRTY_KEY);
              await this.saveDeletedKeysSet(new Set());
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
            const initialDecks = Array.isArray(localDecks) ? localDecks : [];
            this.migrateAllCardsFSRS(initialDecks);
            this.deduplicateSameDeckWords(initialDecks);
            wordList = this.sanitizeDecksForStorage(initialDecks);
            await this.setLocalDecks(wordList);
            this.updateLastKnownDecksSnapshot(wordList);
            this.applyQuizScoreState(this.getLocalQuizScore());
            await this.flushCloudSave();

            if (typeof checkAndOpenOnboardingModal === 'function') {
              checkAndOpenOnboardingModal();
            }

            return wordList;
          }
        } catch (e) {
          console.warn("Firestore 讀取失敗，降級使用 IndexedDB 本機資料:", e);
          if (typeof checkAndOpenOnboardingModal === 'function') {
            checkAndOpenOnboardingModal();
          }
        }
      }

      wordList = this.sanitizeDecksForStorage(Array.isArray(localDecks) ? localDecks : []);
      const migratedLocal = this.migrateAllCardsFSRS(wordList);
      const dedupedLocal = this.deduplicateSameDeckWords(wordList);
      if (migratedLocal || dedupedLocal) {
        await this.setLocalDecks(wordList);
      }
      this.updateLastKnownDecksSnapshot(wordList);
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

    if (this._isFlushing) {
      this._hasPendingFlush = true;
      return;
    }

    const uid = this.getCurrentUid();
    if (!uid || typeof db === 'undefined') {
      return;
    }

    this._isFlushing = true;
    try {
      do {
        this._hasPendingFlush = false;

        const currentApiKey = String(localStorage.getItem(this.LOCAL_APIKEY_KEY) || '');
        const currentSettings = this.getLocalSettings();
        const sanitizedDecks = this.sanitizeDecksForStorage(wordList);
        const compactDecks = this.compactDecksForCloud(sanitizedDecks);
        const currentQuizScore = this.getLocalQuizScore();

        const userDocRef = db.collection('users').doc(uid);
        const chunksColRef = userDocRef.collection('deckChunks');

        const basePayload = deepSanitizeForFirestore({
          apiKey: currentApiKey,
          settings: currentSettings,
          quizScore: currentQuizScore
        });
        basePayload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

        const compactBytes = new Blob([JSON.stringify({
          decks: compactDecks,
          apiKey: currentApiKey,
          settings: currentSettings,
          quizScore: currentQuizScore
        })]).size;

        // 策略 1：精簡後若在 750 KB 以內，直接存入主文件並清理舊分片
        if (compactBytes <= 750000) {
          try {
            const oldChunksSnap = await chunksColRef.get();
            if (!oldChunksSnap.empty) {
              const delBatch = db.batch();
              oldChunksSnap.docs.forEach(d => delBatch.delete(d.ref));
              await delBatch.commit();
            }
          } catch (cleanErr) {}

          await userDocRef.set({
            ...basePayload,
            decks: compactDecks,
            deckChunkCount: 0
          }, { merge: true });
        } else {
          // 策略 2：資料超過 750 KB，自動切分為多個 350 KB 子集合分片寫入（支援無限容量）
          const chunks = this.splitIntoChunks(compactDecks, this.CHUNK_TARGET_BYTES);

          try {
            const existingSnap = await chunksColRef.get();
            const batch = db.batch();

            chunks.forEach((chunkItems, idx) => {
              const chunkRef = chunksColRef.doc(`chunk_${idx}`);
              batch.set(chunkRef, {
                index: idx,
                decks: chunkItems,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            });

            existingSnap.docs.forEach(docSnap => {
              const idx = parseInt(String(docSnap.id).replace('chunk_', ''), 10);
              if (Number.isNaN(idx) || idx >= chunks.length) {
                batch.delete(docSnap.ref);
              }
            });

            batch.set(userDocRef, {
              ...basePayload,
              decks: [],
              deckChunkCount: chunks.length
            }, { merge: true });

            await batch.commit();
          } catch (chunkWriteErr) {
            if (compactBytes <= 980000) {
              await userDocRef.set({
                ...basePayload,
                decks: compactDecks,
                deckChunkCount: 0
              }, { merge: true });
            } else {
              throw chunkWriteErr;
            }
          }
        }

        if (!this._hasPendingFlush) {
          this._retryCount = 0;
          localStorage.removeItem(this.LOCAL_DIRTY_KEY);
          await this.saveDeletedKeysSet(new Set());
        }
      } while (this._hasPendingFlush);
    } catch (e) {
      console.error("雲端同步失敗:", e && e.code, e && e.message, e);
      const now = Date.now();
      const isPermErr = e && e.code === 'permission-denied';

      if (typeof showToast === 'function' && now - this._lastSyncErrorToastAt > 5000) {
        this._lastSyncErrorToastAt = now;
        const hint = isPermErr
          ? '（Firestore 權限遭拒，目前僅保留於本機瀏覽器）'
          : (e && (e.code || e.message) ? ` (${e.code || e.message})` : '');
        showToast(`⚠️ 雲端同步失敗${hint}`, 'error');
      }

      // 若為權限錯誤（permission-denied），停止無限輪詢重試；僅針對暫時性網路錯誤做有限次數重試
      if (!isPermErr && this._retryCount < 3 && !this._retryTimer) {
        this._retryCount++;
        const delayMs = 5000 * this._retryCount;
        this._retryTimer = setTimeout(() => {
          this._retryTimer = null;
          this.flushCloudSave();
        }, delayMs);
      }
    } finally {
      this._isFlushing = false;
    }
  },

  async saveData(decks, immediate = false) {
    // 立即同步標記本機有未同步變更，避免快速重新整理時遺失狀態
    localStorage.setItem(this.LOCAL_DIRTY_KEY, 'true');
    this._retryCount = 0;

    const defaultCatName = getStorageDefaultCatName();
    const prevLocalDecks = Array.isArray(this._lastKnownDecks)
      ? this._lastKnownDecks
      : await this.getLocalDecks();

    if (Array.isArray(decks)) {
      this.deduplicateSameDeckWords(decks);
    }
    const sanitizedDecks = this.sanitizeDecksForStorage(decks);

    if (Array.isArray(wordList)) {
      wordList.length = 0;
      wordList.push(...sanitizedDecks);
    }

    // 立即更新記憶體快照，並優先寫入本機 IndexedDB
    this.updateLastKnownDecksSnapshot(sanitizedDecks);
    await this.setLocalDecks(sanitizedDecks);

    const nextIds = new Set();
    const nextKeys = new Set();
    sanitizedDecks.forEach(c => {
      if (!c || typeof c !== 'object') return;
      if (c.id) nextIds.add(c.id);
      const compKey = this.buildCardCompositeKey(c, defaultCatName);
      if (compKey) nextKeys.add(compKey);
    });

    const deletedSet = await this.getDeletedKeysSet();
    nextIds.forEach(id => deletedSet.delete(id));
    nextKeys.forEach(key => deletedSet.delete(key));

    let hasNewDeletion = false;
    if (Array.isArray(prevLocalDecks)) {
      prevLocalDecks.forEach(prevCard => {
        if (!prevCard || typeof prevCard !== 'object') return;
        const compKey = this.buildCardCompositeKey(prevCard, defaultCatName);
        const stillExists = (prevCard.id && nextIds.has(prevCard.id))
          || (compKey && nextKeys.has(compKey));

        if (!stillExists) {
          hasNewDeletion = true;
          if (prevCard.id) deletedSet.add(prevCard.id);
          if (compKey) deletedSet.add(compKey);
        }
      });
    }

    await this.saveDeletedKeysSet(deletedSet);

    if (this._cloudSaveTimer) {
      clearTimeout(this._cloudSaveTimer);
      this._cloudSaveTimer = null;
    }

    if (immediate || hasNewDeletion) {
      await this.flushCloudSave();
    } else {
      this._cloudSaveTimer = setTimeout(() => {
        this.flushCloudSave();
      }, 400);
    }
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

async function saveStorage(immediate = false) {
  await StorageEngine.saveData(wordList, immediate);
}
