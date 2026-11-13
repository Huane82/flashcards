/**
 * LZHCard - 社群字庫商店系統模組 (store.js)
 */

window.storeDecks = [];

// 避免覆蓋 chat.js 中較完整的全域 isGuestUser()
if (typeof window.isGuestUser !== 'function') {
    window.isGuestUser = function () {
        const isGuestMode = localStorage.getItem('lzhcard_guest_mode') === 'true';
        const isFirebaseUser = typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser;
        return isGuestMode || !isFirebaseUser;
    };
}

function getStoreCurrentUser() {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        return firebase.auth().currentUser;
    }
    if (typeof auth !== 'undefined' && auth.currentUser) {
        return auth.currentUser;
    }
    return null;
}

async function renderStore() {
    const container = document.getElementById('storeContainer');
    if (!container) return;

    const query = (document.getElementById('storeSearchInput')?.value || '').trim().toLowerCase();
    const currentUser = getStoreCurrentUser();
    const currentUid = currentUser ? currentUser.uid : '';
    const isAdmin = window.userData ? window.userData.role === 'admin' : false;

    try {
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

                    <h3 onclick="openStoreDeckPreview('${deck.id}')" class="font-bold text-slate-900 dark:text-white text-base hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer transition flex items-center justify-between group">
                        <span>${deck.title}</span>
                        <i class="fa-solid fa-eye text-xs text-slate-400 group-hover:text-brand-500 transition"></i>
                    </h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">${deck.desc || '無簡介'}</p>
                </div>
                
                <div class="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <button type="button" onclick="openAuthorProfile('${encodeURIComponent(deck.author || '匿名')}')" class="flex items-center space-x-2 text-left group">
                        <img src="${deck.authorAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(deck.author || 'user')}`}" class="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 object-cover">
                        <span class="text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-brand-600 transition">${deck.author || '匿名'}</span>
                    </button>

                    <div class="flex items-center space-x-1.5">
                        <button type="button" onclick="openStoreDeckPreview('${deck.id}')" title="預覽字庫內容" class="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                            <i class="fa-solid fa-list text-sm"></i>
                        </button>

                        ${canDelete ? `
                            <button type="button" onclick="deleteStoreDeck('${deck.id}')" title="${isAdmin && !isAuthor ? '管理員強制下架' : '下架自己的字庫'}" class="p-1.5 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition">
                                <i class="fa-solid fa-trash-can text-sm"></i>
                            </button>
                        ` : ''}

                        <button type="button" onclick="shareDeck('${deck.id}')" title="複製分享連結" class="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                            <i class="fa-solid fa-share-nodes text-sm"></i>
                        </button>

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
            container.innerHTML = deck.words.map((w) => `
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
    
    const currentUser = getStoreCurrentUser();
    const pubAuthorDisplay = document.getElementById('pubAuthorDisplay');
    const fixedNickname = (window.userData && window.userData.nickname) 
        ? window.userData.nickname 
        : (currentUser ? (currentUser.displayName || currentUser.email.split('@')[0]) : '匿名使用者');
    
    if (pubAuthorDisplay) {
        pubAuthorDisplay.textContent = fixedNickname;
    }

    if (typeof openModal === 'function') openModal('publishModal');
}

async function submitPublishDeck() {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能使用商城功能！', 'warning');
        return;
    }

    const categoryName = document.getElementById('pubCategorySelect').value;
    const title = (document.getElementById('pubTitle').value || '').trim();
    const desc = (document.getElementById('pubDesc').value || '').trim();

    const priceInput = document.getElementById('pubPrice');
    const price = Math.max(0, parseInt(priceInput?.value, 10) || 0);

    if (!title) {
        if (typeof showToast === 'function') showToast('請填寫字庫名稱！', 'warning');
        return;
    }

    const currentUser = getStoreCurrentUser();
    if (!currentUser) return;

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

function importStoreDeck(deckId) {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能使用商城功能！', 'warning');
        return;
    }

    const deck = window.storeDecks.find(d => d.id === deckId);
    if (!deck) return;

    let addedCount = 0;
    (deck.words || []).forEach(w => {
        if (!w || !w.word) return;
        const cleanWord = w.word.trim();
        const exists = wordList.some(item => item.word.trim().toLowerCase() === cleanWord.toLowerCase() && item.category === deck.title);
        if (!exists) {
            wordList.push({
                id: 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                category: deck.title,
                word: cleanWord,
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
    if (typeof updateUI === 'function') updateUI();
    if (typeof showToast === 'function') showToast(`成功匯入「${deck.title}」（共 ${addedCount} 個單字）`, 'success');
}

async function purchaseStoreDeck(deckId) {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能使用商城功能！', 'warning');
        return;
    }

    const deck = window.storeDecks.find(d => d.id === deckId);
    if (!deck) return;

    const price = deck.price || 0;
    const currentUser = getStoreCurrentUser();
    if (!currentUser) return;

    // 1. 自己發布的字庫免費取得
    if (deck.authorId && deck.authorId === currentUser.uid) {
        if (typeof showToast === 'function') showToast('這是您發布的字庫，無需花費金幣即可直接取得！', 'info');
        importStoreDeck(deckId);
        return;
    }

    const backendUrl = typeof SHARED_BACKEND_URL !== 'undefined'
        ? SHARED_BACKEND_URL
        : 'https://lzhcard.tomlin980415.workers.dev';

    if (confirm(`確認花費 ${price} 金幣購買「${deck.title}」？`)) {
        try {
            // 2. 取得 Firebase 簽發的個人 ID Token（防偽造身分憑證）
            const idToken = await currentUser.getIdToken();

            // 3. 發送交易請求給 Cloudflare Worker 後端進行真實扣款
            const res = await fetch(`${backendUrl}/buy-deck`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ 
                    deckId: deckId,
                    price: price,
                    authorId: deck.authorId || ''
                })
            });

            const result = await res.json();

            if (!res.ok || !result.success) {
                throw new Error(result.error || '交易失敗');
            }

            // 4. 後端驗證扣款成功後，同步更新前端金幣顯示並匯入字庫
            if (window.userData) window.userData.coins = result.newCoins;
            
            importStoreDeck(deckId);

            if (typeof updateUserCoinsUI === 'function') updateUserCoinsUI();
            if (typeof showToast === 'function') showToast(`成功花費 ${price} 金幣購買「${deck.title}」！剩餘金幣：${result.newCoins}`, 'success');

        } catch (err) {
            console.error("交易失敗:", err);
            if (typeof showToast === 'function') showToast('交易失敗：' + err.message, 'error');
        }
    }
}

async function deleteStoreDeck(deckId) {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能使用商城功能！', 'warning');
        return;
    }

    const deck = window.storeDecks.find(d => d.id === deckId);
    if (!deck) return;

    const currentUser = getStoreCurrentUser();
    const currentUid = currentUser ? currentUser.uid : '';
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

document.addEventListener('DOMContentLoaded', async () => {
    await renderStore();

    if (window.location.hash.startsWith('#share=')) {
        const deckId = decodeURIComponent(window.location.hash.replace('#share=', ''));
        const targetDeck = window.storeDecks.find(d => d.id === deckId);
        if (targetDeck) {
            if (typeof switchTab === 'function') switchTab('store');
            openStoreDeckPreview(targetDeck.id);
        }
    }
});
