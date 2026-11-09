/**
 * LZHCard - 聊天、好友申請、群組管理與系統公告模組 (chat.js - 完整升級版)
 */

if (!window.userData) window.userData = {};
if (!window.userData.friends) window.userData.friends = [];

let currentActiveChatId = null;
let currentActiveChatData = null;
let chatSearchQuery = '';
let activeChatUnsubscribe = null; // 當前開啟視窗之訊息監聽器

// 即時監聽退訂器與數據記錄
let friendRequestsUnsubscribe = null;
let groupInvitesUnsubscribe = null;
let chatsListUnsubscribe = null;
let announcementsUnsubscribe = null;

let pendingRequestsList = [];
let pendingGroupInvitesList = [];
let userChatThreads = [];
let cloudAnnouncements = [];

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
 * 🔴🟡 即時更新全站未讀提示（紅點與黃點）
 */
function updateUnreadBadgeUI() {
    const dot = document.getElementById('chatUnreadDot');
    if (!dot) return;

    if (isGuestUser() || typeof firebase === 'undefined' || !firebase.auth || !firebase.auth().currentUser) {
        dot.classList.add('hidden');
        return;
    }

    const currentUid = firebase.auth().currentUser.uid;
    const lastReadNotice = parseInt(localStorage.getItem('lzhcard_last_read_announcements') || '0', 10);

    // 1. 檢查是否有未讀好友申請或群組邀請 (觸發紅點)
    const hasUnreadRequests = pendingRequestsList.length > 0 || pendingGroupInvitesList.length > 0;

    // 2. 檢查是否有未讀私聊或群組訊息 (排除全站公開討論區 chat_group_public，觸發紅點)
    let hasUnreadPrivateMsg = false;
    userChatThreads.forEach(chat => {
        if (chat.id !== 'chat_group_public' && chat.updatedAt) {
            const chatTime = chat.updatedAt.seconds ? chat.updatedAt.seconds * 1000 : new Date(chat.updatedAt).getTime();
            const lastReadChat = parseInt(localStorage.getItem(`lzhcard_last_read_chat_${chat.id}`) || '0', 10);
            if (chatTime > lastReadChat && chat.lastSenderUid !== currentUid) {
                hasUnreadPrivateMsg = true;
            }
        }
    });

    // 3. 檢查是否有未讀公告 (觸發黃點)
    let hasUnreadAnnounce = false;
    cloudAnnouncements.forEach(ann => {
        const annTime = ann.createdAt?.seconds ? ann.createdAt.seconds * 1000 : (ann.time ? new Date(ann.time).getTime() : 0);
        if (annTime > lastReadNotice) {
            hasUnreadAnnounce = true;
        }
    });

    const hasRedDot = hasUnreadRequests || hasUnreadPrivateMsg;
    const hasYellowDot = hasUnreadAnnounce;

    if (hasRedDot) {
        dot.className = "absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-800";
        dot.classList.remove('hidden');
    } else if (hasYellowDot) {
        dot.className = "absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white dark:ring-slate-800";
        dot.classList.remove('hidden');
    } else {
        dot.classList.add('hidden');
    }
}

/**
 * 📡 初始化 Firestore 全局即時監聽器 (好友申請、群組邀請、聊天頻道與公告)
 */
function initChatRealtimeListeners() {
    if (typeof db === 'undefined' || !firebase.auth || !firebase.auth().currentUser) return;
    const currentUid = firebase.auth().currentUser.uid;

    // A. 監聽好友申請
    if (friendRequestsUnsubscribe) friendRequestsUnsubscribe();
    friendRequestsUnsubscribe = db.collection('friendRequests')
        .where('toUid', '==', currentUid)
        .where('status', '==', 'pending')
        .onSnapshot(snapshot => {
            pendingRequestsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateUnreadBadgeUI();
            const friendsView = document.getElementById('friendsView');
            if (friendsView && !friendsView.classList.contains('hidden')) {
                renderFriendsList();
            }
        }, err => console.warn("好友申請監聽異常:", err));

    // B. 監聽傳給自己的群組邀請
    if (groupInvitesUnsubscribe) groupInvitesUnsubscribe();
    groupInvitesUnsubscribe = db.collection('groupInvites')
        .where('toUid', '==', currentUid)
        .where('status', '==', 'pending')
        .onSnapshot(snapshot => {
            pendingGroupInvitesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateUnreadBadgeUI();
            const friendsView = document.getElementById('friendsView');
            if (friendsView && !friendsView.classList.contains('hidden')) {
                renderFriendsList();
            }
        }, err => console.warn("群組邀請監聽異常:", err));

    // C. 監聽包含自己的所有聊天頻道
    if (chatsListUnsubscribe) chatsListUnsubscribe();
    chatsListUnsubscribe = db.collection('chats')
        .where('members', 'array-contains', currentUid)
        .onSnapshot(snapshot => {
            userChatThreads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateUnreadBadgeUI();
            const chatsView = document.getElementById('chatsView');
            if (chatsView && !chatsView.classList.contains('hidden')) {
                renderChatThreads(false);
            }
        }, err => console.warn("對話列表監聽異常:", err));

    // D. 監聽系統公告
    if (announcementsUnsubscribe) announcementsUnsubscribe();
    announcementsUnsubscribe = db.collection('announcements')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            cloudAnnouncements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            window.appAnnouncements = cloudAnnouncements;
            updateUnreadBadgeUI();
            const noticeView = document.getElementById('noticeView');
            if (noticeView && !noticeView.classList.contains('hidden')) {
                renderAnnouncements();
            }
        }, err => console.warn("公告監聽異常:", err));
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
        localStorage.setItem('lzhcard_last_read_announcements', Date.now().toString());
        updateUnreadBadgeUI();
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
 * 👥 渲染好友頁面欄位（包含「待處理好友申請」、「待處理群組邀請」與「已確認好友列表」）
 */
async function renderFriendsList() {
    const container = document.getElementById('friendsListContainer');
    if (!container) return;

    const friends = (window.userData && window.userData.friends) ? window.userData.friends : [];
    const query = chatSearchQuery;

    let html = '';

    // 1. 📩 渲染待處理的好友申請
    if (pendingRequestsList.length > 0) {
        html += `
            <div class="mb-3 p-3 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <i class="fa-solid fa-user-clock text-amber-600"></i>
                        <span>待處理的好友申請 (${pendingRequestsList.length})</span>
                    </span>
                </div>
                <div class="space-y-2">
        `;
        html += pendingRequestsList.map(req => `
            <div class="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                    <img src="${req.fromAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(req.fromNickname)}`}" class="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover">
                    <div>
                        <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${req.fromNickname}</h4>
                        <p class="text-[10px] text-slate-400 font-mono">${req.fromEmail || ''}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-1.5">
                    <button type="button" onclick="handleAcceptFriendRequest('${req.id}', '${req.fromUid}', '${encodeURIComponent(req.fromNickname)}', '${req.fromEmail || ''}', '${encodeURIComponent(req.fromAvatar || '')}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition shadow-2xs">
                        同意
                    </button>
                    <button type="button" onclick="handleRejectFriendRequest('${req.id}')" class="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 text-[11px] font-bold rounded-lg transition">
                        拒絕
                    </button>
                </div>
            </div>
        `).join('');
        html += `</div></div>`;
    }

    // 2. 👥 渲染待處理的群組邀請
    if (pendingGroupInvitesList.length > 0) {
        html += `
            <div class="mb-3 p-3 bg-purple-50/80 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                        <i class="fa-solid fa-users-rectangle text-purple-600"></i>
                        <span>待處理的群組邀請 (${pendingGroupInvitesList.length})</span>
                    </span>
                </div>
                <div class="space-y-2">
        `;
        html += pendingGroupInvitesList.map(inv => `
            <div class="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                    <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1">
                        <i class="fa-solid fa-users text-purple-500 text-[10px]"></i>
                        <span>${inv.groupName}</span>
                    </h4>
                    <p class="text-[10px] text-slate-400 mt-0.5">邀請者：<span class="font-semibold text-slate-600 dark:text-slate-300">${inv.inviterNickname}</span></p>
                </div>
                <div class="flex items-center space-x-1.5">
                    <button type="button" onclick="handleAcceptGroupInvite('${inv.id}', '${inv.groupId}', '${encodeURIComponent(inv.groupName)}')" class="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg transition shadow-2xs">
                        加入
                    </button>
                    <button type="button" onclick="handleRejectGroupInvite('${inv.id}')" class="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 text-[11px] font-bold rounded-lg transition">
                        拒絕
                    </button>
                </div>
            </div>
        `).join('');
        html += `</div></div>`;
    }

    // 3. 🔍 按 Email 發送好友申請
    if (query.includes('@') && !friends.some(f => f.email && f.email.toLowerCase() === query)) {
        html += `
            <div onclick="sendFriendRequestByEmail('${query}', this)" class="p-3 bg-brand-50 dark:bg-brand-950/40 rounded-xl border border-brand-200 dark:border-brand-800 hover:bg-brand-100 transition cursor-pointer flex items-center justify-between mb-3">
                <div class="flex items-center space-x-2 text-brand-700 dark:text-brand-300">
                    <i class="fa-solid fa-paper-plane text-sm"></i>
                    <span class="text-xs font-bold">發送好友申請給：「${query}」</span>
                </div>
                <span class="text-xs font-bold bg-brand-600 text-white px-2 py-0.5 rounded-lg">送出申請</span>
            </div>
        `;
    }

    // 4. 雲端搜尋非好友用戶
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
                        <button type="button" onclick="sendFriendRequestByObject('${encodeURIComponent(JSON.stringify(u))}')" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1">
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

    // 5. 渲染已確認的好友列表
    const filteredFriends = friends.filter(f => 
        (f.nickname || f.username || '').toLowerCase().includes(query) || 
        (f.email && f.email.toLowerCase().includes(query))
    );

    if (filteredFriends.length === 0 && !html) {
        container.innerHTML = `<div class="text-center text-slate-400 py-8 text-xs">查無符合「${query}」的好友或搜尋結果</div>`;
        return;
    }

    if (filteredFriends.length > 0) {
        html += `<div class="text-[11px] font-bold text-slate-500 mb-1">我的好友列表：</div>`;
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
 * ➕ 發送好友申請 (從雲端物件)
 */
async function sendFriendRequestByObject(encodedUserObjStr) {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能發送好友申請！', 'warning');
        return;
    }

    try {
        const targetUser = JSON.parse(decodeURIComponent(encodedUserObjStr));
        await sendFriendRequestCore(targetUser.uid, targetUser.username, targetUser.email);
    } catch (e) {
        console.error("發送好友申請解析失敗:", e);
    }
}

/**
 * ➕ 發送好友申請 (從 Email)
 */
async function sendFriendRequestByEmail(emailInput = null, btnElem = null) {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能發送好友申請！', 'warning');
        return;
    }

    let originalBtnHtml = '';
    if (btnElem) {
        originalBtnHtml = btnElem.innerHTML;
        btnElem.disabled = true;
        btnElem.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>處理中...</span>`;
    }

    try {
        const targetEmail = (emailInput || prompt('請輸入對方的電子郵件 (Email)：') || '').trim().toLowerCase();
        if (!targetEmail || !targetEmail.includes('@')) {
            if (targetEmail && typeof showToast === 'function') showToast('請輸入有效的電子郵件格式！', 'warning');
            return;
        }

        let targetUid = '';
        let targetNickname = targetEmail.split('@')[0];

        if (typeof db !== 'undefined') {
            try {
                const snapshot = await db.collection('users').where('email', '==', targetEmail).get();
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    targetUid = doc.id;
                    if (doc.data().nickname) targetNickname = doc.data().nickname;
                }
            } catch (e) {
                console.warn("查詢 Email UID 失敗:", e);
            }
        }

        if (!targetUid) {
            if (typeof showToast === 'function') showToast('⚠️ 找不到該 Email 的使用者帳號！', 'error');
            return;
        }

        await sendFriendRequestCore(targetUid, targetNickname, targetEmail);
    } catch (err) {
        console.error("發送好友申請過程發生錯誤:", err);
    } finally {
        if (btnElem) {
            btnElem.disabled = false;
            btnElem.innerHTML = originalBtnHtml;
        }
    }
}

/**
 * 🔒 核心：向 Firestore 寫入好友申請（已加入不可重複發送機制）
 */
async function sendFriendRequestCore(targetUid, targetNickname, targetEmail) {
    const currentUid = auth.currentUser ? auth.currentUser.uid : '';
    const myName = (window.userData && window.userData.username) ? window.userData.username : '使用者';
    const myEmail = auth.currentUser ? auth.currentUser.email : '';
    const myAvatar = auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUid)}`;

    if (targetUid === currentUid) {
        if (typeof showToast === 'function') showToast('無法發送好友申請給自己！', 'warning');
        return;
    }

    // 1. 檢查是否已經是好友
    if (window.userData?.friends?.some(f => f.uid === targetUid)) {
        if (typeof showToast === 'function') showToast('該使用者已經在您的好友列表中！', 'info');
        return;
    }

    try {
        // 2. 檢查自己是否已發送過 pending 申請
        const sentSnap = await db.collection('friendRequests')
            .where('fromUid', '==', currentUid)
            .where('toUid', '==', targetUid)
            .where('status', '==', 'pending')
            .get();

        if (!sentSnap.empty) {
            if (typeof showToast === 'function') showToast('⚠️ 您已發送過好友申請，請勿重複發送！', 'warning');
            return;
        }

        // 3. 檢查對方是否已經發送過 pending 申請給我
        const recvSnap = await db.collection('friendRequests')
            .where('fromUid', '==', targetUid)
            .where('toUid', '==', currentUid)
            .where('status', '==', 'pending')
            .get();

        if (!recvSnap.empty) {
            if (typeof showToast === 'function') showToast('💡 對方已經發送好友申請給您囉，請至好友欄位查看並同意！', 'info');
            return;
        }

        await db.collection('friendRequests').add({
            fromUid: currentUid,
            fromNickname: myName,
            fromEmail: myEmail,
            fromAvatar: myAvatar,
            toUid: targetUid,
            toEmail: targetEmail,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (typeof showToast === 'function') showToast(`🎉 已成功發送好友申請給「${targetNickname}」！`, 'success');
    } catch (e) {
        console.error("發送好友申請失敗:", e);
        if (typeof showToast === 'function') showToast('發送失敗：' + e.message, 'error');
    }
}

/**
 * ✅ 同意好友申請
 */
async function handleAcceptFriendRequest(reqId, fromUid, encodedNickname, fromEmail, encodedAvatar) {
    const fromNickname = decodeURIComponent(encodedNickname);
    const fromAvatar = decodeURIComponent(encodedAvatar);
    const currentUid = auth.currentUser ? auth.currentUser.uid : '';

    try {
        await db.collection('friendRequests').doc(reqId).update({
            status: 'accepted',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (!window.userData) window.userData = {};
        if (!window.userData.friends) window.userData.friends = [];

        if (!window.userData.friends.some(f => f.uid === fromUid)) {
            window.userData.friends.push({
                username: fromNickname,
                nickname: fromNickname,
                email: fromEmail,
                avatar: fromAvatar,
                uid: fromUid
            });
            if (typeof saveUserData === 'function') saveUserData();
            if (typeof saveStorage === 'function') saveStorage();
        }

        const chatId = [currentUid, fromUid].sort().join('_');
        await db.collection('chats').doc(chatId).set({
            type: 'private',
            name: fromNickname,
            members: [currentUid, fromUid],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        if (typeof showToast === 'function') showToast(`🤝 已同意「${fromNickname}」的好友申請！`, 'success');
        renderFriendsList();
    } catch (e) {
        console.error("同意好友申請失敗:", e);
        if (typeof showToast === 'function') showToast('處理失敗：' + e.message, 'error');
    }
}

/**
 * ❌ 拒絕好友申請
 */
async function handleRejectFriendRequest(reqId) {
    try {
        await db.collection('friendRequests').doc(reqId).update({
            status: 'rejected',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (typeof showToast === 'function') showToast('已拒絕該好友申請', 'info');
        renderFriendsList();
    } catch (e) {
        console.error("拒絕好友申請失敗:", e);
    }
}

/**
 * ➕ 建立新群組功能 (只有創立者擁有管理員權限)
 */
async function createGroupPrompt() {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能建立群組！', 'warning');
        return;
    }

    const groupName = (prompt('請輸入新群組名稱：') || '').trim();
    if (!groupName) return;

    const currentUid = auth.currentUser.uid;
    const myName = (window.userData && window.userData.username) ? window.userData.username : '玩家';

    try {
        const docRef = await db.collection('chats').add({
            type: 'group',
            name: groupName,
            ownerUid: currentUid,
            members: [currentUid],
            lastMessage: `${myName} 建立了群組「${groupName}」`,
            lastSenderUid: currentUid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (typeof showToast === 'function') showToast(`🎉 已成功建立群組「${groupName}」！`, 'success');
        openChatWindow(docRef.id, groupName);
    } catch (e) {
        console.error("建立群組失敗:", e);
        if (typeof showToast === 'function') showToast('建立群組失敗：' + e.message, 'error');
    }
}

/**
 * 📩 邀請好友加入群組
 */
async function inviteFriendToGroupPrompt(groupId, groupName) {
    const friends = (window.userData && window.userData.friends) ? window.userData.friends : [];
    if (friends.length === 0) {
        if (typeof showToast === 'function') showToast('您目前沒有好友可邀請，請先在好友欄位新增好友！', 'warning');
        return;
    }

    const friendListStr = friends.map((f, i) => `${i + 1}. ${f.nickname || f.username} (${f.email || '無Email'})`).join('\n');
    const inputStr = prompt(`請輸入要邀請的好友編號 (1~${friends.length})：\n\n${friendListStr}`);
    if (!inputStr) return;

    const idx = parseInt(inputStr.trim(), 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= friends.length) {
        if (typeof showToast === 'function') showToast('無效的選擇！', 'error');
        return;
    }

    const targetFriend = friends[idx];
    const currentUid = auth.currentUser.uid;
    const myName = (window.userData && window.userData.username) ? window.userData.username : '玩家';

    try {
        // 1. 檢查是否已在群組中
        const chatDoc = await db.collection('chats').doc(groupId).get();
        if (chatDoc.exists && chatDoc.data().members.includes(targetFriend.uid)) {
            if (typeof showToast === 'function') showToast('該好友已經在此群組中！', 'info');
            return;
        }

        // 2. 檢查是否已送出邀請
        const inviteSnap = await db.collection('groupInvites')
            .where('groupId', '==', groupId)
            .where('toUid', '==', targetFriend.uid)
            .where('status', '==', 'pending')
            .get();

        if (!inviteSnap.empty) {
            if (typeof showToast === 'function') showToast('已發送過群組邀請，等待對方同意中！', 'info');
            return;
        }

        await db.collection('groupInvites').add({
            groupId: groupId,
            groupName: groupName,
            inviterUid: currentUid,
            inviterNickname: myName,
            toUid: targetFriend.uid,
            toNickname: targetFriend.nickname || targetFriend.username,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (typeof showToast === 'function') showToast(`🎉 已成功對「${targetFriend.nickname || targetFriend.username}」發送群組邀請！`, 'success');
    } catch (e) {
        console.error("發送群組邀請失敗:", e);
        if (typeof showToast === 'function') showToast('發送邀請失敗：' + e.message, 'error');
    }
}

/**
 * ✅ 受邀者同意加入群組
 */
async function handleAcceptGroupInvite(inviteId, groupId, encodedGroupName) {
    const groupName = decodeURIComponent(encodedGroupName);
    const currentUid = auth.currentUser.uid;

    try {
        await db.collection('groupInvites').doc(inviteId).update({
            status: 'accepted',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('chats').doc(groupId).update({
            members: firebase.firestore.FieldValue.arrayUnion(currentUid),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (typeof showToast === 'function') showToast(`🎉 已成功加入群組「${groupName}」！`, 'success');
        renderFriendsList();
    } catch (e) {
        console.error("加入群組失敗:", e);
        if (typeof showToast === 'function') showToast('加入失敗：' + e.message, 'error');
    }
}

/**
 * ❌ 受邀者拒絕群組邀請
 */
async function handleRejectGroupInvite(inviteId) {
    try {
        await db.collection('groupInvites').doc(inviteId).update({
            status: 'rejected',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (typeof showToast === 'function') showToast('已拒絕該群組邀請', 'info');
        renderFriendsList();
    } catch (e) {
        console.error("拒絕群組邀請失敗:", e);
    }
}

/**
 * 🚪 任何成員皆可點擊「退出群組」
 */
async function leaveGroup(groupId) {
    if (!confirm('確定要退出這個群組嗎？退出後需重新獲得邀請才能加入。')) return;

    const currentUid = auth.currentUser.uid;
    try {
        await db.collection('chats').doc(groupId).update({
            members: firebase.firestore.FieldValue.arrayRemove(currentUid),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (typeof showToast === 'function') showToast('已成功退出群組', 'info');
        backToChatThreads();
    } catch (e) {
        console.error("退出群組失敗:", e);
        if (typeof showToast === 'function') showToast('退出失敗：' + e.message, 'error');
    }
}

/**
 * 👢 👑 群主/管理者踢出成員
 */
async function kickGroupMember(groupId, memberUid, memberName) {
    if (!confirm(`👑 管理員確定要將「${memberName}」踢出群組嗎？`)) return;

    try {
        await db.collection('chats').doc(groupId).update({
            members: firebase.firestore.FieldValue.arrayRemove(memberUid),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (typeof showToast === 'function') showToast(`已將「${memberName}」踢出群組`, 'info');
        openChatWindow(groupId, encodeURIComponent(currentActiveChatData?.name || '群組'));
    } catch (e) {
        console.error("踢出成員失敗:", e);
        if (typeof showToast === 'function') showToast('操作失敗：' + e.message, 'error');
    }
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

    const membersList = [currentUid, targetUid].filter(Boolean);

    if (typeof db !== 'undefined') {
        try {
            await db.collection('chats').doc(chatId).set({
                type: 'private',
                name: targetUser,
                members: membersList,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.warn("初始化雲端對話失敗:", e);
        }
    }

    openChatWindow(chatId, targetUser);
}

/**
 * 🗑️ 👑 管理員刪除整個對話紀錄
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
 * 💬 渲染對話欄位 (Chats) 列表（包含「+ 建立群組」按鈕與各類對話頻道）
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
            let snapshot;
            if (isAdminInspector) {
                snapshot = await db.collection('chats').get();
            } else {
                snapshot = await db.collection('chats').where('members', 'array-contains', currentUid).get();
            }
            threads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.warn("無法從雲端拉取對話列表：", e);
        }
    }

    // 確保加入全站公開討論區
    if (!threads.some(t => t.id === 'chat_group_public')) {
        threads.unshift({
            id: 'chat_group_public',
            type: 'group',
            name: 'all'
        });
    }

    if (query) {
        threads = threads.filter(c => (c.name || '').toLowerCase().includes(query));
    }

    let html = `
        <div class="mb-3">
            <button type="button" onclick="createGroupPrompt()" class="w-full py-2 bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5">
                <i class="fa-solid fa-users-rectangle text-sm"></i>
                <span>+ 建立新群組</span>
            </button>
        </div>
    `;

    if (threads.length === 0) {
        html += `<div class="text-center text-slate-400 py-8 text-xs">沒有找到對話紀錄</div>`;
        container.innerHTML = html;
        return;
    }

    html += threads.map(c => {
        const isGroup = c.type === 'group';
        const icon = isGroup ? 'fa-users text-purple-500' : 'fa-user-lock text-emerald-500';
        const displayName = c.name || '對話';

        const chatTime = c.updatedAt?.seconds ? c.updatedAt.seconds * 1000 : (c.updatedAt ? new Date(c.updatedAt).getTime() : 0);
        const lastReadChat = parseInt(localStorage.getItem(`lzhcard_last_read_chat_${c.id}`) || '0', 10);
        const hasUnread = !isGroup && chatTime > lastReadChat && c.lastSenderUid !== currentUid;

        return `
            <div onclick="openChatWindow('${c.id}', '${encodeURIComponent(displayName)}')" class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-brand-300 transition cursor-pointer flex justify-between items-center relative mb-2">
                <div class="flex items-center space-x-3">
                    <div class="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm relative">
                        <i class="fa-solid ${icon}"></i>
                        ${hasUnread ? `<span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-800"></span>` : ''}
                    </div>
                    <div>
                        <div class="flex items-center space-x-1.5">
                            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${displayName}</h4>
                            <span class="text-[9px] px-1.5 py-0.2 rounded font-semibold ${isGroup ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'}">${isGroup ? '群組' : '私聊'}</span>
                        </div>
                        <p class="text-[11px] text-slate-400 line-clamp-1 mt-0.5">${c.lastMessage || '點擊開啟即時對話'}</p>
                    </div>
                </div>

                ${isAdmin ? `
                    <button type="button" onclick="event.stopPropagation(); deleteChatThread('${c.id}')" title="刪除整個對話紀錄" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition ml-2">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * 📖 開啟對話視窗（並即時載入群組管理與退出功能）
 */
async function openChatWindow(chatId, encodedName = '') {
    currentActiveChatId = chatId;
    localStorage.setItem(`lzhcard_last_read_chat_${chatId}`, Date.now().toString());
    updateUnreadBadgeUI();

    const displayName = encodedName ? decodeURIComponent(encodedName) : '對話';

    document.getElementById('chatsView')?.classList.add('hidden');
    document.getElementById('friendsView')?.classList.add('hidden');
    
    const activeWindow = document.getElementById('activeChatWindow');
    if (activeWindow) activeWindow.classList.remove('hidden');

    const titleEl = document.getElementById('activeChatTitle');
    if (titleEl) titleEl.textContent = displayName;

    // 載入當前對話詳細資訊
    currentActiveChatData = null;
    if (typeof db !== 'undefined' && chatId) {
        try {
            const chatDoc = await db.collection('chats').doc(chatId).get();
            if (chatDoc.exists) {
                currentActiveChatData = { id: chatDoc.id, ...chatDoc.data() };
            }
        } catch (e) {
            console.warn("取得頻道資料失敗:", e);
        }
    }

    // 動態更新頂部工具列（若為群組顯示「退出群組」與「邀請/成員」）
    const headerActions = document.getElementById('activeChatHeaderActions');
    if (headerActions) {
        if (currentActiveChatData && currentActiveChatData.type === 'group' && chatId !== 'chat_group_public') {
            const currentUid = auth.currentUser ? auth.currentUser.uid : '';
            const isOwner = currentActiveChatData.ownerUid === currentUid;
            headerActions.innerHTML = `
                ${isOwner ? `
                    <button type="button" onclick="inviteFriendToGroupPrompt('${chatId}', '${encodeURIComponent(displayName)}')" class="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[10px] font-bold rounded-lg hover:bg-purple-200 transition">
                        <i class="fa-solid fa-user-plus"></i> 邀請
                    </button>
                ` : ''}
                <button type="button" onclick="leaveGroup('${chatId}')" class="px-2 py-1 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 text-[10px] font-bold rounded-lg hover:bg-rose-200 transition">
                    <i class="fa-solid fa-right-from-bracket"></i> 退出群組
                </button>
            `;
        } else {
            headerActions.innerHTML = '';
        }
    }

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
 * 📩 繪製雲端傳回的即時訊息列表
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
 * 📤 發送訊息至雲端 Firestore
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
            lastSenderUid: currentUid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

    } catch (err) {
        console.error("雲端發送訊息失敗:", err);
        if (typeof showToast === 'function') showToast('發送失敗：' + err.message, 'error');
    }
}

/**
 * 📢 渲染公告列表 (即時從 Firestore 雲端讀取)
 */
async function renderAnnouncements() {
    const container = document.getElementById('noticeList');
    if (!container) return;

    const isAdmin = window.userData ? window.userData.role === 'admin' : false;
    let annList = window.appAnnouncements || [];

    if (annList.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-8 text-xs">目前無系統公告</div>`;
        return;
    }

    container.innerHTML = annList.map(ann => `
        <div class="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-2xs space-y-1.5 relative">
            <div class="flex justify-between items-center">
                <span class="font-bold text-xs text-brand-600 dark:text-brand-400">${ann.title}</span>
                <div class="flex items-center space-x-2">
                    <span class="text-[10px] text-slate-400">${ann.time || ''}</span>
                    ${isAdmin ? `
                        <button type="button" onclick="deleteAnnouncement('${ann.id}')" title="刪除公告" class="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 p-1 rounded transition">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${ann.content}</p>
            <div class="text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-50 dark:border-slate-800">發布者：${ann.author || '管理員'}</div>
        </div>
    `).join('');
}

/**
 * 🗑️ 管理員刪除公告
 */
async function deleteAnnouncement(annId) {
    if (!window.userData || window.userData.role !== 'admin') {
        if (typeof showToast === 'function') showToast('只有管理員可以刪除公告！', 'error');
        return;
    }

    if (confirm('👑 管理員警告：確定要刪除該公告嗎？')) {
        if (typeof db !== 'undefined' && annId) {
            try {
                await db.collection('announcements').doc(annId).delete();
            } catch (e) {
                console.warn("雲端刪除公告失敗：", e);
            }
        }
        if (window.appAnnouncements) {
            window.appAnnouncements = window.appAnnouncements.filter(a => a.id !== annId);
        }
        renderAnnouncements();
        if (typeof showToast === 'function') showToast('管理員已成功刪除該公告！', 'info');
    }
}

/**
 * 📢 管理員提交公告
 */
async function submitAnnouncement() {
    if (!window.userData || window.userData.role !== 'admin') {
        if (typeof showToast === 'function') showToast('只有管理員可以發布公告！', 'error');
        return;
    }

    const titleInput = document.getElementById('annTitle');
    const contentInput = document.getElementById('annContent');

    const title = (titleInput?.value || '').trim();
    const content = (contentInput?.value || '').trim();

    if (!title || !content) {
        if (typeof showToast === 'function') showToast('請填寫完整公告內容！', 'warning');
        return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const newAnn = {
        title: title,
        content: content,
        author: window.userData.username || '管理員',
        time: dateStr,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (typeof db !== 'undefined') {
        try {
            const docRef = await db.collection('announcements').add(newAnn);
            newAnn.id = docRef.id;
        } catch (e) {
            console.error("寫入雲端公告失敗：", e);
            newAnn.id = 'ann_' + Date.now();
        }
    } else {
        newAnn.id = 'ann_' + Date.now();
    }

    if (!window.appAnnouncements) window.appAnnouncements = [];
    window.appAnnouncements.unshift(newAnn);

    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';

    if (typeof closeModal === 'function') closeModal('announceModal');
    renderAnnouncements();
    if (typeof showToast === 'function') showToast('官方公告已成功發布並同步至雲端！', 'success');
}