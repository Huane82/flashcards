/**
 * LZHCard - 聊天、好友與系統公告模組 (chat.js - 含管理員刪除對話與訊息功能)
 */

if (!window.userData) window.userData = {};
if (!window.userData.friends) window.userData.friends = [];

let currentActiveChatId = null;
let chatSearchQuery = '';
let activeChatUnsubscribe = null; // Firestore 即時監聽解鎖器

/**
 * 🔒 判斷當前是否為訪客身分
 */
function isGuestUser() {
    const isGuestMode = localStorage.getItem('lzhcard_guest_mode') === 'true';
    const currentUser = window.userData ? (window.userData.username || '') : '';
    const isFirebaseUser = typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser;
    return isGuestMode || currentUser === '訪客玩家' || !isFirebaseUser;
}

/**
 * 👑 檢查管理員身分並即時切換 UI 顯示狀態
 */
function checkAdminPermissions() {
    const isAdmin = window.userData && window.userData.role === 'admin';

    const adminBtn = document.getElementById('tabAdminBtn');
    if (adminBtn) adminBtn.classList.toggle('hidden', !isAdmin);

    const noticeAction = document.getElementById('adminNoticeAction');
    if (noticeAction) noticeAction.classList.toggle('hidden', !isAdmin);

    const adminBadge = document.getElementById('adminBadge');
    if (adminBadge) adminBadge.classList.toggle('hidden', !isAdmin);
}

/**
 * 💬 開啟聊天抽屜/視窗
 */
function openChatDrawer() {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能使用聊天功能！', 'warning');
        return;
    }

    const drawer = document.getElementById('chatDrawer');
    if (drawer) {
        drawer.classList.remove('hidden');
        if (typeof updateUserCoinsUI === 'function') updateUserCoinsUI();
        checkAdminPermissions();
        switchChatTab('chats');
    }
}

/**
 * ❌ 關閉聊天抽屜
 */
function closeChatDrawer() {
    if (activeChatUnsubscribe) {
        activeChatUnsubscribe();
        activeChatUnsubscribe = null;
    }
    const drawer = document.getElementById('chatDrawer');
    if (drawer) drawer.classList.add('hidden');
}

/**
 * 🔄 切換聊天側欄 Tab
 */
function switchChatTab(tab) {
    if (activeChatUnsubscribe) {
        activeChatUnsubscribe();
        activeChatUnsubscribe = null;
    }

    const noticeView = document.getElementById('noticeView');
    const chatsView = document.getElementById('chatsView');
    const friendsView = document.getElementById('friendsView');
    const activeChatWindow = document.getElementById('activeChatWindow');

    const tabNoticeBtn = document.getElementById('tabNoticeBtn');
    const tabChatsBtn = document.getElementById('tabChatsBtn');
    const tabFriendsBtn = document.getElementById('tabFriendsBtn');
    const tabAdminBtn = document.getElementById('tabAdminBtn');

    [noticeView, chatsView, friendsView, activeChatWindow].forEach(el => el && el.classList.add('hidden'));

    const defaultBtnClass = "flex-1 py-3 text-center text-slate-400 border-b-2 border-transparent font-bold text-xs transition";
    if (tabNoticeBtn) tabNoticeBtn.className = defaultBtnClass;
    if (tabChatsBtn) tabChatsBtn.className = defaultBtnClass;
    if (tabFriendsBtn) tabFriendsBtn.className = defaultBtnClass;

    checkAdminPermissions();
    const isAdmin = window.userData && window.userData.role === 'admin';

    if (tab === 'notice') {
        if (noticeView) noticeView.classList.remove('hidden');
        if (tabNoticeBtn) tabNoticeBtn.className = "flex-1 py-3 text-center border-b-2 border-brand-600 text-brand-600 font-bold text-xs";
        renderAnnouncements();
    } else if (tab === 'chats') {
        if (chatsView) chatsView.classList.remove('hidden');
        if (tabChatsBtn) tabChatsBtn.className = "flex-1 py-3 text-center border-b-2 border-brand-600 text-brand-600 font-bold text-xs";
        renderChatThreads(false);
    } else if (tab === 'friends') {
        if (friendsView) friendsView.classList.remove('hidden');
        if (tabFriendsBtn) tabFriendsBtn.className = "flex-1 py-3 text-center border-b-2 border-brand-600 text-brand-600 font-bold text-xs";
        renderFriendsList();
    } else if (tab === 'admin') {
        if (isAdmin) {
            if (chatsView) chatsView.classList.remove('hidden');
            if (tabAdminBtn) tabAdminBtn.className = "flex-1 py-3 text-center border-b-2 border-rose-600 text-rose-600 font-bold text-xs";
            renderChatThreads(true);
        } else {
            switchChatTab('chats');
        }
    }
}

/**
 * 🔍 搜尋對話與好友處理
 */
function handleChatSearch() {
    const searchInput = document.getElementById('chatSearchInput');
    chatSearchQuery = (searchInput?.value || '').trim().toLowerCase();

    const friendsView = document.getElementById('friendsView');
    if (friendsView && !friendsView.classList.contains('hidden')) {
        renderFriendsList();
    } else {
        const isAdmin = window.userData && window.userData.role === 'admin';
        const tabAdminBtn = document.getElementById('tabAdminBtn');
        const isInspectorMode = isAdmin && tabAdminBtn && tabAdminBtn.className.includes('border-rose-600');
        renderChatThreads(isInspectorMode);
    }
}

/**
 * 👥 渲染好友列表
 */
async function renderFriendsList() {
    const container = document.getElementById('friendsListContainer');
    if (!container) return;

    const friends = (window.userData && window.userData.friends) ? window.userData.friends : [];
    const query = chatSearchQuery;

    const filteredFriends = friends.filter(f => 
        (f.nickname || f.username || '').toLowerCase().includes(query) || 
        (f.email && f.email.toLowerCase().includes(query))
    );

    let html = '';

    if (query.includes('@') && !friends.some(f => f.email && f.email.toLowerCase() === query)) {
        html += `
            <div onclick="addFriendByEmail('${query}')" class="p-3 bg-brand-50 dark:bg-brand-950/40 rounded-xl border border-brand-200 dark:border-brand-800 hover:bg-brand-100 transition cursor-pointer flex items-center justify-between mb-3">
                <div class="flex items-center space-x-2 text-brand-700 dark:text-brand-300">
                    <i class="fa-solid fa-user-plus text-sm"></i>
                    <span class="text-xs font-bold">按 Email 新增好友：「${query}」</span>
                </div>
                <span class="text-xs font-bold bg-brand-600 text-white px-2 py-0.5 rounded-lg">新增</span>
            </div>
        `;
    }

    if (query && typeof db !== 'undefined' && !isGuestUser()) {
        try {
            const currentUid = auth.currentUser ? auth.currentUser.uid : '';
            const snapshot = await db.collection('users').get();
            const cloudMatches = [];

            snapshot.forEach(doc => {
                if (doc.id === currentUid) return;
                const data = doc.data();
                const uNickname = (data.nickname || '').toLowerCase();
                const uEmail = (data.email || '').toLowerCase();

                if ((uNickname && uNickname.includes(query)) || (uEmail && uEmail.includes(query))) {
                    const isFriend = friends.some(f => (f.email && f.email.toLowerCase() === uEmail) || f.uid === doc.id);
                    if (!isFriend) {
                        cloudMatches.push({
                            uid: doc.id,
                            username: data.nickname || (data.email ? data.email.split('@')[0] : '使用者'),
                            nickname: data.nickname || '',
                            email: data.email || '',
                            avatar: data.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(doc.id)}`
                        });
                    }
                }
            });

            if (cloudMatches.length > 0) {
                html += `
                    <div class="text-[11px] font-bold text-brand-600 dark:text-brand-400 mb-1 flex items-center space-x-1">
                        <i class="fa-solid fa-cloud-bolt text-xs"></i>
                        <span>雲端搜尋結果 (${cloudMatches.length})：</span>
                    </div>
                `;
                html += cloudMatches.map(u => `
                    <div class="p-3 bg-brand-50/70 dark:bg-brand-950/40 rounded-xl border border-brand-200 dark:border-brand-800 hover:border-brand-300 transition flex justify-between items-center mb-2">
                        <div class="flex items-center space-x-3">
                            <img src="${u.avatar}" class="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 object-cover">
                            <div>
                                <div class="flex items-center space-x-1">
                                    <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${u.username}</h4>
                                    <span class="text-[9px] px-1.5 py-0.2 bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 rounded font-bold">雲端用戶</span>
                                </div>
                                <p class="text-[10px] text-slate-400 font-mono">${u.email || '無電子郵件'}</p>
                            </div>
                        </div>
                        <button type="button" onclick="addFriendByObject('${encodeURIComponent(JSON.stringify(u))}')" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1">
                            <i class="fa-solid fa-user-plus"></i>
                            <span>加好友</span>
                        </button>
                    </div>
                `).join('');
            }
        } catch (e) {
            console.warn("搜尋雲端暱稱失敗:", e);
        }
    }

    if (filteredFriends.length === 0 && !html) {
        container.innerHTML = `<div class="text-center text-slate-400 py-8 text-xs">查無符合「${query}」的暱稱或好友</div>`;
        return;
    }

    if (filteredFriends.length > 0) {
        if (query) {
            html += `<div class="text-[11px] font-bold text-slate-500 mb-1">已新增的好友：</div>`;
        }
        html += filteredFriends.map(f => {
            const displayName = f.nickname || f.username;
            return `
                <div class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-brand-300 transition flex justify-between items-center mb-2">
                    <div class="flex items-center space-x-3">
                        <img src="${f.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`}" class="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 object-cover">
                        <div>
                            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${displayName}</h4>
                            <p class="text-[10px] text-slate-400 font-mono">${f.email || '無電子郵件'}</p>
                        </div>
                    </div>
                    <button type="button" onclick="startPrivateChat('${encodeURIComponent(displayName)}', '${f.uid || ''}')" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1">
                        <i class="fa-solid fa-comment-dots"></i>
                        <span>私聊</span>
                    </button>
                </div>
            `;
        }).join('');
    }

    container.innerHTML = html;
}

/**
 * ➕ 從搜尋結果一鍵新增雲端用戶為好友
 */
function addFriendByObject(encodedUserObjStr) {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能新增好友！', 'warning');
        return;
    }

    try {
        const userObj = JSON.parse(decodeURIComponent(encodedUserObjStr));
        if (!window.userData) window.userData = {};
        if (!window.userData.friends) window.userData.friends = [];

        const exists = window.userData.friends.some(f => (f.email && f.email.toLowerCase() === userObj.email.toLowerCase()) || (f.uid && f.uid === userObj.uid));
        if (exists) {
            if (typeof showToast === 'function') showToast('該使用者已經在您的好友列表中！', 'info');
            return;
        }

        window.userData.friends.push({
            username: userObj.username,
            nickname: userObj.nickname || userObj.username,
            email: userObj.email,
            avatar: userObj.avatar,
            uid: userObj.uid
        });

        if (typeof saveUserData === 'function') saveUserData();
        if (typeof saveStorage === 'function') saveStorage();
        renderFriendsList();
        if (typeof showToast === 'function') showToast(`成功新增固定暱稱好友「${userObj.username}」！`, 'success');
    } catch (e) {
        console.error("解析暱稱用戶資料失敗:", e);
    }
}

/**
 * ➕ 通過電子郵件搜尋並發送加入好友請求
 */
async function addFriendByEmail(emailInput) {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能新增好友！', 'warning');
        return;
    }

    const targetEmail = (emailInput || prompt('請輸入對方的電子郵件 (Email)：') || '').trim().toLowerCase();
    
    if (!targetEmail || !targetEmail.includes('@')) {
        if (targetEmail && typeof showToast === 'function') showToast('請輸入有效的電子郵件格式！', 'warning');
        return;
    }

    if (!window.userData) window.userData = {};
    if (!window.userData.friends) window.userData.friends = [];

    const exists = window.userData.friends.some(f => f.email && f.email.toLowerCase() === targetEmail);
    if (exists) {
        if (typeof showToast === 'function') showToast('該使用者已經在您的好友列表中！', 'info');
        return;
    }

    let targetUid = '';
    let targetNickname = targetEmail.split('@')[0];
    let targetAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(targetEmail)}`;

    if (typeof db !== 'undefined') {
        try {
            const snapshot = await db.collection('users').where('email', '==', targetEmail).get();
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                targetUid = doc.id;
                const data = doc.data();
                if (data.nickname) targetNickname = data.nickname;
                if (data.photoURL) targetAvatar = data.photoURL;
            }
        } catch (e) {
            console.warn("查詢雲端 Email 失敗:", e);
        }
    }

    const newFriend = {
        username: targetNickname,
        nickname: targetNickname,
        email: targetEmail,
        avatar: targetAvatar,
        uid: targetUid
    };

    window.userData.friends.push(newFriend);
    if (typeof saveUserData === 'function') saveUserData();
    if (typeof saveStorage === 'function') saveStorage();

    renderFriendsList();
    if (typeof showToast === 'function') showToast(`成功新增好友「${targetNickname}」！`, 'success');
}

/**
 * 💬 發起/開啟 1對1 雲端私聊
 */
async function startPrivateChat(encodedTargetUsername, targetUid = '') {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能使用私聊！', 'warning');
        return;
    }

    const targetUser = decodeURIComponent(encodedTargetUsername);
    const currentUid = auth.currentUser ? auth.currentUser.uid : '';

    if (!targetUid && window.userData && window.userData.friends) {
        const found = window.userData.friends.find(f => (f.nickname || f.username) === targetUser);
        if (found && found.uid) targetUid = found.uid;
    }
    
    const chatId = (currentUid && targetUid) 
        ? [currentUid, targetUid].sort().join('_') 
        : 'chat_private_' + encodeURIComponent(targetUser);

    if (typeof db !== 'undefined') {
        try {
            await db.collection('chats').doc(chatId).set({
                type: 'private',
                name: targetUser,
                members: [currentUid, targetUid].filter(Boolean),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.warn("初始化雲端對話失敗:", e);
        }
    }

    openChatWindow(chatId, targetUser);
}

/**
 * 🗑️ 👑 管理員刪除整個對話紀錄 (連同內部子訊息一併刪除)
 */
async function deleteChatThread(chatId) {
    const isAdmin = window.userData && window.userData.role === 'admin';
    if (!isAdmin) {
        if (typeof showToast === 'function') showToast('只有管理員可以刪除對話！', 'error');
        return;
    }

    if (confirm('👑 管理員警告：確定要刪除整個對話紀錄嗎？（這將永久清空所有歷史訊息）')) {
        try {
            const msgsSnap = await db.collection('chats').doc(chatId).collection('messages').get();
            const batch = db.batch();
            msgsSnap.forEach(doc => batch.delete(doc.ref));
            batch.delete(db.collection('chats').doc(chatId));
            await batch.commit();

            const tabAdminBtn = document.getElementById('tabAdminBtn');
            const isInspectorMode = tabAdminBtn && tabAdminBtn.className.includes('border-rose-600');
            renderChatThreads(isInspectorMode);
            if (typeof showToast === 'function') showToast('已成功刪除該對話！', 'info');
        } catch (e) {
            console.error("刪除對話失敗:", e);
            if (typeof showToast === 'function') showToast('刪除對話失敗：' + e.message, 'error');
        }
    }
}

/**
 * 🗑️ 👑 管理員刪除單一聊天訊息
 */
async function deleteChatMessage(chatId, msgId) {
    const isAdmin = window.userData && window.userData.role === 'admin';
    if (!isAdmin) {
        if (typeof showToast === 'function') showToast('只有管理員可以刪除訊息！', 'error');
        return;
    }

    if (confirm('👑 管理員警告：確定要刪除這條訊息嗎？')) {
        try {
            await db.collection('chats').doc(chatId).collection('messages').doc(msgId).delete();
            if (typeof showToast === 'function') showToast('已成功刪除該條訊息！', 'info');
        } catch (e) {
            console.error("刪除訊息失敗:", e);
            if (typeof showToast === 'function') showToast('刪除失敗：' + e.message, 'error');
        }
    }
}

/**
 * 💬 渲染對話列表 (管理員可看見一鍵刪除對話按鈕)
 */
async function renderChatThreads(isAdminInspector = false) {
    const container = document.getElementById('chatThreadsList');
    if (!container) return;

    const currentUid = auth.currentUser ? auth.currentUser.uid : '';
    const isAdmin = window.userData && window.userData.role === 'admin';
    const query = chatSearchQuery;

    let threads = [];

    if (typeof db !== 'undefined') {
        try {
            const snapshot = await db.collection('chats').get();
            threads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.warn("無法從雲端拉取對話列表：", e);
        }
    }

    if (!threads.some(t => t.id === 'chat_group_public')) {
        threads.unshift({
            id: 'chat_group_public',
            type: 'group',
            name: '全站公開討論區'
        });
    }

    if (!isAdminInspector) {
        threads = threads.filter(c => c.id === 'chat_group_public' || (c.members && c.members.includes(currentUid)));
    }

    if (query) {
        threads = threads.filter(c => (c.name || '').toLowerCase().includes(query));
    }

    if (threads.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-8 text-xs">沒有找到符合條件的對話紀錄</div>`;
        return;
    }

    container.innerHTML = threads.map(c => {
        const isGroup = c.type === 'group';
        const icon = isGroup ? 'fa-users text-purple-500' : 'fa-user-lock text-emerald-500';
        const displayName = c.name || '對話';

        return `
            <div onclick="openChatWindow('${c.id}', '${encodeURIComponent(displayName)}')" class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-brand-300 transition cursor-pointer flex justify-between items-center">
                <div class="flex items-center space-x-3">
                    <div class="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div>
                        <div class="flex items-center space-x-1.5">
                            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${displayName}</h4>
                            <span class="text-[9px] px-1.5 py-0.2 rounded font-semibold ${isGroup ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'}">${isGroup ? '群組' : '私聊'}</span>
                        </div>
                        <p class="text-[11px] text-slate-400 line-clamp-1 mt-0.5">${c.lastMessage || '點擊開啟即時對話'}</p>
                    </div>
                </div>

                <!-- 🗑️ 管理員專屬刪除整個對話按鈕 -->
                ${isAdmin ? `
                    <button type="button" onclick="event.stopPropagation(); deleteChatThread('${c.id}')" title="刪除整個對話紀錄" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition ml-2">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
}

/**
 * 📖 開啟對話視窗並啟動 Firestore 即時連線
 */
function openChatWindow(chatId, encodedName = '') {
    currentActiveChatId = chatId;

    const displayName = encodedName ? decodeURIComponent(encodedName) : '對話';

    document.getElementById('chatsView')?.classList.add('hidden');
    document.getElementById('friendsView')?.classList.add('hidden');
    
    const activeWindow = document.getElementById('activeChatWindow');
    if (activeWindow) activeWindow.classList.remove('hidden');

    const titleEl = document.getElementById('activeChatTitle');
    if (titleEl) titleEl.textContent = displayName;

    if (activeChatUnsubscribe) {
        activeChatUnsubscribe();
        activeChatUnsubscribe = null;
    }

    if (typeof db !== 'undefined' && chatId) {
        activeChatUnsubscribe = db.collection('chats').doc(chatId).collection('messages')
            .orderBy('createdAt', 'asc')
            .onSnapshot(snapshot => {
                const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                renderMessagesList(messages);
            }, err => {
                console.warn("即時監聽訊息失敗：", err);
            });
    }
}

/**
 * ⬅️ 返回對話列表
 */
function backToChatThreads() {
    if (activeChatUnsubscribe) {
        activeChatUnsubscribe();
        activeChatUnsubscribe = null;
    }
    document.getElementById('activeChatWindow')?.classList.add('hidden');
    document.getElementById('chatsView')?.classList.remove('hidden');
    
    const isAdmin = window.userData && window.userData.role === 'admin';
    const tabAdminBtn = document.getElementById('tabAdminBtn');
    const isInspectorMode = isAdmin && tabAdminBtn && tabAdminBtn.className.includes('border-rose-600');
    renderChatThreads(isInspectorMode);
}

/**
 * 📩 繪製雲端傳回的即時訊息列表 (管理員可在每條訊息旁看見刪除圖示)
 */
function renderMessagesList(messages = []) {
    const container = document.getElementById('chatMessagesBox');
    if (!container) return;

    const currentUser = (window.userData && window.userData.username) ? window.userData.username : '訪客玩家';
    const isAdmin = window.userData && window.userData.role === 'admin';

    if (messages.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-6 text-xs">目前暫無訊息，發送第一條訊息開始交談吧！</div>`;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isSystem = msg.sender === '系統提示';
        if (isSystem) {
            return `
                <div class="flex justify-center my-2">
                    <span class="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">${msg.text}</span>
                </div>
            `;
        }

        const isMe = msg.sender === currentUser;
        return `
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 my-1.5">
                <div class="flex items-center space-x-1">
                    <span class="text-[10px] text-slate-400 px-1">${msg.sender}</span>
                    <!-- 🗑️ 管理員可直接刪除單條訊息 -->
                    ${isAdmin && msg.id ? `
                        <button type="button" onclick="deleteChatMessage('${currentActiveChatId}', '${msg.id}')" title="刪除此訊息" class="text-rose-500 hover:text-rose-700 text-[10px] p-0.5 transition">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    ` : ''}
                </div>
                <div class="max-w-[80%] px-3 py-2 rounded-2xl text-xs ${isMe ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-tl-none'} shadow-2xs">
                    ${msg.text}
                </div>
                <span class="text-[9px] text-slate-400 px-1">${msg.time || ''}</span>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

/**
 * 📤 發送訊息至雲端 Firestore (對方會即時接收)
 */
async function handleSendMessage(e) {
    if (e) e.preventDefault();

    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能發送訊息！', 'warning');
        return;
    }

    const input = document.getElementById('chatInput');
    const text = (input?.value || '').trim();
    if (!text || !currentActiveChatId) return;

    const currentUser = (window.userData && window.userData.username) ? window.userData.username : '訪客玩家';
    const currentUid = auth.currentUser ? auth.currentUser.uid : '';
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (input) input.value = '';

    const newMsg = {
        sender: currentUser,
        senderUid: currentUid,
        text: text,
        time: timeStr,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('chats').doc(currentActiveChatId).collection('messages').add(newMsg);
        
        await db.collection('chats').doc(currentActiveChatId).set({
            lastMessage: `${currentUser}: ${text}`,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

    } catch (err) {
        console.error("雲端發送訊息失敗:", err);
        if (typeof showToast === 'function') showToast('發送失敗：' + err.message, 'error');
    }
}

/**
 * 📢 渲染公告列表
 */
function renderAnnouncements() {
    const container = document.getElementById('noticeList');
    if (!container) return;

    const annList = window.appAnnouncements || [];
    const isAdmin = window.userData ? window.userData.role === 'admin' : false;

    if (annList.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-8 text-xs">目前無系統公告</div>`;
        return;
    }

    container.innerHTML = annList.map(ann => `
        <div class="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-2xs space-y-1.5 relative">
            <div class="flex justify-between items-center">
                <span class="font-bold text-xs text-brand-600 dark:text-brand-400">${ann.title}</span>
                <div class="flex items-center space-x-2">
                    <span class="text-[10px] text-slate-400">${ann.time}</span>
                    ${isAdmin ? `
                        <button type="button" onclick="deleteAnnouncement('${ann.id}')" title="刪除公告" class="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 p-1 rounded transition">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${ann.content}</p>
            <div class="text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-50 dark:border-slate-800">發布者：${ann.author}</div>
        </div>
    `).join('');
}

/**
 * 🗑️ 管理員刪除公告
 */
function deleteAnnouncement(annId) {
    if (!window.userData || window.userData.role !== 'admin') {
        if (typeof showToast === 'function') showToast('只有管理員可以刪除公告！', 'error');
        return;
    }

    if (!window.appAnnouncements) window.appAnnouncements = [];
    const ann = window.appAnnouncements.find(a => a.id === annId);
    if (!ann) return;

    if (confirm(`👑 管理員警告：確定要刪除公告「${ann.title}」嗎？`)) {
        window.appAnnouncements = window.appAnnouncements.filter(a => a.id !== annId);
        if (typeof saveUserData === 'function') saveUserData();
        renderAnnouncements();
        if (typeof showToast === 'function') showToast('管理員已成功刪除該公告！', 'info');
    }
}

/**
 * 📢 管理員提交公告
 */
function submitAnnouncement() {
    if (!window.userData || window.userData.role !== 'admin') {
        if (typeof showToast === 'function') showToast('只有管理員可以發布公告！', 'error');
        return;
    }

    const title = (document.getElementById('annTitle')?.value || '').trim();
    const content = (document.getElementById('annContent')?.value || '').trim();

    if (!title || !content) {
        if (typeof showToast === 'function') showToast('請填寫完整公告內容！', 'warning');
        return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    if (!window.appAnnouncements) window.appAnnouncements = [];
    window.appAnnouncements.unshift({
        id: 'ann_' + Date.now(),
        title: title,
        content: content,
        author: window.userData.username || '管理員',
        time: dateStr
    });

    if (typeof saveUserData === 'function') saveUserData();
    if (typeof closeModal === 'function') closeModal('announceModal');
    renderAnnouncements();
    if (typeof showToast === 'function') showToast('官方公告已成功發布！', 'success');
}