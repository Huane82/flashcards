/**
 * LZHCard - 社群字庫商店系統模組 (store.js - 雲端交易與金幣入帳版)
 */

window.storeDecks = [];

/**
 * 🔒 判斷當前是否為訪客身分
 */
function isGuestUser() {
    const isGuestMode = localStorage.getItem('lzhcard_guest_mode') === 'true';
    const isFirebaseUser = typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser;
    return isGuestMode || !isFirebaseUser;
}

/**
 * 🛍️ 渲染商店清單 (點擊字庫標題或預覽按鈕可即時查看詳細單字)
 */
async function renderStore() {
    const container = document.getElementById('storeContainer');
    if (!container) return;

    const query = (document.getElementById('storeSearchInput')?.value || '').trim().toLowerCase();
    
    // 取得當前登入者身分與權限
    const currentUser = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
    const currentUid = currentUser ? currentUser.uid : '';
    const isAdmin = window.userData ? window.userData.role === 'admin' : false;

    try {
        // 從 Firestore 讀取所有發布的商店字庫
        if (typeof db !== 'undefined') {
            const snapshot = await db.collection('storeDecks').orderBy('createdAt', 'desc').get();
            window.storeDecks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        }
    } catch (err) {
        console.warn("無法從雲端拉取商店資料，嘗試讀取快取：", err);
    }

    // 關鍵字過濾
    const filtered = window.storeDecks.filter(deck => 
        (deck.title || '').toLowerCase().includes(query) ||
        (deck.desc || '').toLowerCase().includes(query) ||
        (deck.category || '').toLowerCase().includes(query) ||
        (deck.author || '').toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center text-slate-400 py-10 text-xs">未找到符合的字庫作品</div>`;
        return;
    }

    container.innerHTML = filtered.map(deck => {
        const isAuthor = currentUid && deck.authorId === currentUid;
        const canDelete = (isAuthor || isAdmin) && !isGuestUser();
        const wordCount = Array.isArray(deck.words) ? deck.words.length : 0;

        return `
            <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-4 hover:border-brand-300 dark:hover:border-brand-700 transition">
                <div class="space-y-2">
                    <div class="flex justify-between items-start">
                        <span class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
                            ${deck.category || '通用'}
                        </span>
                        ${deck.badge ? `<span class="px-2 py-0.5 text-[10px] font-extrabold bg-amber-500 text-white rounded-full">${deck.badge}</span>` : ''}
                    </div>

                    <!-- 🔍 點擊字庫標題觸發內容預覽 Modal -->
                    <h3 onclick="openStoreDeckPreview('${deck.id}')" class="font-bold text-slate-900 dark:text-white text-base hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer transition flex items-center justify-between group">
                        <span>${deck.title}</span>
                        <i class="fa-solid fa-eye text-xs text-slate-400 group-hover:text-brand-500 transition"></i>
                    </h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">${deck.desc || '無簡介'}</p>
                </div>
                
                <div class="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <!-- 👤 點擊作者頭像/名稱 -->
                    <button type="button" onclick="openAuthorProfile('${encodeURIComponent(deck.author || '匿名')}')" class="flex items-center space-x-2 text-left group">
                        <img src="${deck.authorAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(deck.author || 'user')}`}" class="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 object-cover">
                        <span class="text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-brand-600 transition">${deck.author || '匿名'}</span>
                    </button>

                    <div class="flex items-center space-x-1.5">
                        <!-- 👁️ 瀏覽內容按鈕 -->
                        <button type="button" onclick="openStoreDeckPreview('${deck.id}')" title="預覽字庫內容" class="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                            <i class="fa-solid fa-list text-sm"></i>
                        </button>

                        <!-- 🗑️ 下架按鈕 -->
                        ${canDelete ? `
                            <button type="button" onclick="deleteStoreDeck('${deck.id}')" title="${isAdmin && !isAuthor ? '管理員強制下架' : '下架自己的字庫'}" class="p-1.5 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition">
                                <i class="fa-solid fa-trash-can text-sm"></i>
                            </button>
                        ` : ''}

                        <!-- 🔗 複製分享連結 -->
                        <button type="button" onclick="shareDeck('${deck.id}')" title="複製分享連結" class="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                            <i class="fa-solid fa-share-nodes text-sm"></i>
                        </button>

                        <!-- 📥 下載匯入字庫 / 花費金幣購買 -->
                        <button type="button" onclick="${deck.price > 0 ? `purchaseStoreDeck('${deck.id}')` : `importStoreDeck('${deck.id}')`}" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center space-x-1">
                            <i class="fa-solid fa-download"></i>
                            <span>${deck.price > 0 ? `${deck.price} 金幣` : `取得 (${wordCount})`}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * 👁️ 開啟字庫單字內容預覽 Modal
 */
function openStoreDeckPreview(deckId) {
    const deck = window.storeDecks.find(d => d.id === deckId);
    if (!deck) return;

    const titleEl = document.getElementById('previewDeckTitle');
    const subEl = document.getElementById('previewDeckSub');
    const container = document.getElementById('previewWordsContainer');
    const actionBtn = document.getElementById('previewActionBtn');

    if (titleEl) titleEl.textContent = deck.title;
    if (subEl) subEl.textContent = `作者：${deck.author || '匿名'} · 共 ${deck.words ? deck.words.length : 0} 個單字`;

    if (container) {
        if (!deck.words || deck.words.length === 0) {
            container.innerHTML = `<div class="text-center text-slate-400 py-8">此字庫暫無單字內容</div>`;
        } else {
            container.innerHTML = deck.words.map((w, idx) => `
                <div class="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-700 space-y-1">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center space-x-2">
                            <span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">${w.word}</span>
                            ${w.pos ? `<span class="px-1.5 py-0.2 rounded bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400 font-bold text-[10px]">${w.pos}</span>` : ''}
                            ${w.phonetic ? `<span class="text-[11px] text-slate-400 font-mono">${w.phonetic}</span>` : ''}
                        </div>
                    </div>
                    <p class="text-xs text-amber-600 dark:text-amber-400 font-semibold">${w.meaning || '無中文釋義'}</p>
                    ${w.sentence ? `<p class="text-[11px] text-slate-500 italic mt-1">"${w.sentence}" ${w.translation ? `(${w.translation})` : ''}</p>` : ''}
                </div>
            `).join('');
        }
    }

    if (actionBtn) {
        actionBtn.onclick = () => {
            if (typeof closeModal === 'function') closeModal('storePreviewModal');
            if (deck.price > 0) purchaseStoreDeck(deck.id);
            else importStoreDeck(deck.id);
        };
    }

    if (typeof openModal === 'function') openModal('storePreviewModal');
}

/**
 * 🚀 打開發布 Modal (強制顯示固定暱稱)
 */
function openPublishModal() {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能使用商城功能！', 'warning');
        return;
    }

    const select = document.getElementById('pubCategorySelect');
    if (!select) return;

    const categories = Array.from(new Set((typeof wordList !== 'undefined' ? wordList : []).map(w => w.category).filter(Boolean)));
    if (categories.length === 0) {
        if (typeof showToast === 'function') showToast('您目前沒有建立任何單字分類！', 'warning');
        return;
    }

    select.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    
    // 顯示鎖定的個人固定暱稱
    const pubAuthorDisplay = document.getElementById('pubAuthorDisplay');
    const fixedNickname = (window.userData && window.userData.nickname) 
        ? window.userData.nickname 
        : (auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email.split('@')[0]) : '匿名使用者');
    
    if (pubAuthorDisplay) {
        pubAuthorDisplay.textContent = fixedNickname;
    }

    if (typeof openModal === 'function') openModal('publishModal');
}

/**
 * 📤 提交發布上架 (使用帳號固定暱稱，防止偽造冒用)
 */
async function submitPublishDeck() {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能使用商城功能！', 'warning');
        return;
    }

    const categoryName = document.getElementById('pubCategorySelect').value;
    const title = (document.getElementById('pubTitle').value || '').trim();
    const desc = (document.getElementById('pubDesc').value || '').trim();

    // 🪙 讀取輸入的金幣價格
    const priceInput = document.getElementById('pubPrice');
    const price = Math.max(0, parseInt(priceInput?.value, 10) || 0);

    if (!title) {
        if (typeof showToast === 'function') showToast('請填寫字庫名稱！', 'warning');
        return;
    }

    const currentUser = auth.currentUser;
    // 強制帶入帳號固定暱稱
    const authorNickname = (window.userData && window.userData.nickname) 
        ? window.userData.nickname 
        : (currentUser.displayName || currentUser.email.split('@')[0]);

    const targetWords = (typeof wordList !== 'undefined' ? wordList : []).filter(w => w.category === categoryName);
    if (targetWords.length === 0) {
        if (typeof showToast === 'function') showToast('該分類下無單字，無法發布！', 'warning');
        return;
    }

    try {
        const newDeckData = {
            title: title,
            category: categoryName,
            desc: desc || '由社群使用者分享的實用字庫',
            author: authorNickname,
            authorId: currentUser.uid,
            authorAvatar: currentUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(authorNickname)}`,
            price: price,
            words: targetWords.map(w => ({
                word: w.word,
                pos: w.pos || '',
                phonetic: w.phonetic || '',
                meaning: w.meaning || '',
                sentence: w.sentence || '',
                translation: w.translation || ''
            })),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('storeDecks').add(newDeckData);
        await renderStore();

        if (typeof closeModal === 'function') closeModal('publishModal');
        if (typeof showToast === 'function') showToast(`「${title}」已成功發布至雲端商店！`, 'success');
    } catch (error) {
        console.error("發布字庫至雲端失敗:", error);
        if (typeof showToast === 'function') showToast('發布失敗：' + error.message, 'error');
    }
}

/**
 * 👤 開啟作者作品集 Modal
 */
function openAuthorProfile(encodedAuthor) {
    const authorName = decodeURIComponent(encodedAuthor);
    const authorDecks = window.storeDecks.filter(d => (d.author || '').toLowerCase() === authorName.toLowerCase());

    const nameEl = document.getElementById('authorModalName');
    const countEl = document.getElementById('authorModalCount');
    const avatarEl = document.getElementById('authorModalAvatar');
    const container = document.getElementById('authorDecksContainer');

    if (nameEl) nameEl.textContent = authorName;
    if (countEl) countEl.textContent = `共發布了 ${authorDecks.length} 個字庫作品`;
    if (avatarEl) avatarEl.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(authorName)}`;

    if (container) {
        container.innerHTML = authorDecks.map(deck => `
            <div class="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl flex justify-between items-center border border-slate-200 dark:border-slate-700">
                <div>
                    <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100">${deck.title}</h4>
                    <p class="text-xs text-slate-400 mt-0.5">${(deck.words || []).length} 個單字 · ${deck.category}</p>
                </div>
                <div class="flex space-x-1.5">
                    <button type="button" onclick="openStoreDeckPreview('${deck.id}')" class="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition">
                        預覽
                    </button>
                    <button type="button" onclick="${deck.price > 0 ? `purchaseStoreDeck('${deck.id}')` : `importStoreDeck('${deck.id}')`}" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg shadow-sm transition">
                        ${deck.price > 0 ? `${deck.price} 金幣` : '取得'}
                    </button>
                </div>
            </div>
        `).join('');
    }

    if (typeof openModal === 'function') openModal('authorModal');
}

/**
 * 🔗 複製分享連結
 */
function shareDeck(deckId) {
    const shareUrl = `${window.location.origin}${window.location.pathname}#share=${encodeURIComponent(deckId)}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            if (typeof showToast === 'function') showToast('已複製字庫分享連結！', 'success');
        }).catch(() => {
            prompt('請手動複製分享連結：', shareUrl);
        });
    } else {
        prompt('請手動複製分享連結：', shareUrl);
    }
}

/**
 * 📥 下載/匯入免費商店字庫 (訪客禁止使用)
 */
function importStoreDeck(deckId) {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能使用商城功能！', 'warning');
        return;
    }

    const deck = window.storeDecks.find(d => d.id === deckId);
    if (!deck) return;

    let addedCount = 0;
    (deck.words || []).forEach(w => {
        const exists = wordList.some(item => item.word.toLowerCase() === w.word.toLowerCase() && item.category === deck.title);
        if (!exists) {
            wordList.push({
                id: 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                category: deck.title,
                word: w.word,
                pos: w.pos || '',
                phonetic: w.phonetic || '',
                meaning: w.meaning || '',
                sentence: w.sentence || '',
                translation: w.translation || '',
                level: 1,
                knowStreak: 0,
                updatedAt: Date.now()
            });
            addedCount++;
        }
    });

    if (typeof saveStorage === 'function') saveStorage();
    if (typeof updateCategorySelects === 'function') updateCategorySelects();
    if (typeof showToast === 'function') showToast(`成功匯入「${deck.title}」（共 ${addedCount} 個單字）`, 'success');
}

/**
 * 🪙 花費金幣購買商店字庫 (含買家扣款與賣家雲端自動入帳)
 */
/**
 * 🪙 花費金幣購買商店字庫 (含買家扣款、平台 30% 抽成與賣家 70% 入帳)
 */
async function purchaseStoreDeck(deckId) {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能使用商城功能！', 'warning');
        return;
    }

    const deck = window.storeDecks.find(d => d.id === deckId);
    if (!deck) return;

    const price = deck.price || 0;
    const buyerUid = auth.currentUser ? auth.currentUser.uid : '';
    const userCoins = window.userData ? (window.userData.coins || 0) : 0;

    // 防止重複購買自己的作品
    if (deck.authorId && deck.authorId === buyerUid) {
        if (typeof showToast === 'function') showToast('這是您發布的字庫，無需花費金幣即可直接取得！', 'info');
        importStoreDeck(deckId);
        return;
    }

    if (userCoins < price) {
        if (typeof showToast === 'function') showToast(`金幣不足！需要 ${price} 金幣，您目前有 ${userCoins} 金幣`, 'error');
        return;
    }

    // 🪙 計算 30% 平台抽成，賣家實得 70%
    const sellerEarnings = Math.floor(price * 0.7);

    if (confirm(`確認花費 ${price} 金幣購買「${deck.title}」？`)) {
        try {
            // 1. 買家扣除全額金幣 (本地 + 雲端同步)
            if (window.userData) window.userData.coins -= price;
            if (typeof db !== 'undefined' && buyerUid) {
                await db.collection('users').doc(buyerUid).set({
                    coins: firebase.firestore.FieldValue.increment(-price)
                }, { merge: true });
            }

            // 2. 賣家雲端自動進帳 70% (扣除 30% 平台手續費)
            if (typeof db !== 'undefined' && deck.authorId && sellerEarnings > 0) {
                await db.collection('users').doc(deck.authorId).set({
                    coins: firebase.firestore.FieldValue.increment(sellerEarnings)
                }, { merge: true });
            }

            // 3. 自動匯入單字至買家字庫
            let addedCount = 0;
            (deck.words || []).forEach(w => {
                const exists = wordList.some(item => item.word.toLowerCase() === w.word.toLowerCase() && item.category === deck.title);
                if (!exists) {
                    wordList.push({
                        id: 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                        category: deck.title,
                        word: w.word,
                        pos: w.pos || '',
                        phonetic: w.phonetic || '',
                        meaning: w.meaning || '',
                        sentence: w.sentence || '',
                        translation: w.translation || '',
                        level: 1,
                        knowStreak: 0,
                        updatedAt: Date.now()
                    });
                    addedCount++;
                }
            });

            if (typeof saveUserData === 'function') saveUserData();
            if (typeof saveStorage === 'function') saveStorage();
            if (typeof updateCategorySelects === 'function') updateCategorySelects();
            renderStore();

            if (typeof showToast === 'function') showToast(`成功花費 ${price} 金幣購買「${deck.title}」！賣家已收到 ${sellerEarnings} 金幣 (已扣除 30% 手續費)。`, 'success');
        } catch (err) {
            console.error("交易失敗:", err);
            if (typeof showToast === 'function') showToast('交易失敗：' + err.message, 'error');
        }
    }
}

/**
 * 🗑️ 下架商店字庫 (從 Firebase Firestore 刪除)
 */
async function deleteStoreDeck(deckId) {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能使用商城功能！', 'warning');
        return;
    }

    const deck = window.storeDecks.find(d => d.id === deckId);
    if (!deck) return;

    const currentUid = auth.currentUser ? auth.currentUser.uid : '';
    const userRole = window.userData ? window.userData.role : 'user';

    const isAuthor = currentUid && deck.authorId === currentUid;
    const isAdmin = userRole === 'admin';

    if (!isAuthor && !isAdmin) {
        if (typeof showToast === 'function') showToast('您沒有權限下架此字庫！', 'error');
        return;
    }

    const confirmMsg = (isAdmin && !isAuthor) 
        ? `👑 管理員警告：確定強制下架「${deck.title}」？`
        : `確定要將您的作品「${deck.title}」從商店下架嗎？`;

    if (confirm(confirmMsg)) {
        try {
            await db.collection('storeDecks').doc(deckId).delete();
            await renderStore();
            if (typeof showToast === 'function') showToast(`已成功將「${deck.title}」下架！`, 'info');
        } catch (error) {
            console.error("下架字庫失敗:", error);
            if (typeof showToast === 'function') showToast('下架失敗：' + error.message, 'error');
        }
    }
}

/**
 * 🌐 開頁與 URL Hash 自動觸發監聽
 */
document.addEventListener('DOMContentLoaded', () => {
    renderStore();

    if (window.location.hash.startsWith('#share=')) {
        const deckId = decodeURIComponent(window.location.hash.replace('#share=', ''));
        const targetDeck = window.storeDecks.find(d => d.id === deckId);
        if (targetDeck) {
            if (typeof switchTab === 'function') switchTab('store');
            openStoreDeckPreview(targetDeck.id);
        }
    }
});