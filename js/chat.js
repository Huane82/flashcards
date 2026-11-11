/**
 * LZHCard - 聊天、好友申請、群組管理與系統公告模組 (chat.js - Realtime Database 100% 重構加固版)
 */

if (!window.userData) window.userData = {};
if (!window.userData.friends) window.userData.friends = [];

let currentActiveChatId = null;
let currentActiveChatData = null;
let chatSearchQuery = '';

// RTDB 監聽器引用
let activeChatListener = null;
let friendRequestsListener = null;
let groupInvitesListener = null;
let chatsListListener = null;
let announcementsListener = null;

let pendingRequestsList = [];
let pendingGroupInvitesList = [];
let userChatThreads = [];
let cloudAnnouncements = [];

// 取得 RTDB 實例
function getRtdb() {
    if (typeof firebase !== 'undefined' && firebase.database) {
        return firebase.database();
    }
    return null;
}

/**
 * 🛡️ HTML 防注入工具 (防止 XSS 攻擊)
 */
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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

    const hasUnreadRequests = pendingRequestsList.length > 0 || pendingGroupInvitesList.length > 0;

    let hasUnreadPrivateMsg = false;
    userChatThreads.forEach(chat => {
        if (chat.id !== 'chat_group_public' && chat.updatedAt) {
            const chatTime = typeof chat.updatedAt === 'number' ? chat.updatedAt : new Date(chat.updatedAt).getTime();
            const lastReadChat = parseInt(localStorage.getItem(`lzhcard_last_read_chat_${chat.id}`) || '0', 10);
            if (chatTime > lastReadChat && chat.lastSenderUid !== currentUid) {
                hasUnreadPrivateMsg = true;
            }
        }
    });

    let hasUnreadAnnounce = false;
    cloudAnnouncements.forEach(ann => {
        const annTime = typeof ann.createdAt === 'number' ? ann.createdAt : (ann.time ? new Date(ann.time).getTime() : 0);
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
 * 📡 初始化 Realtime Database 全局即時監聽器
 */
function initChatRealtimeListeners() {
    const rtdb = getRtdb();
    if (!rtdb || !firebase.auth || !firebase.auth().currentUser) return;
    const currentUid = firebase.auth().currentUser.uid;

    // A. 監聽好友申請
    if (friendRequestsListener) rtdb.ref('friendRequests').off('value', friendRequestsListener);
    friendRequestsListener = rtdb.ref('friendRequests').on('value', snapshot => {
        const data = snapshot.val() || {};
        pendingRequestsList = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            .filter(req => req.toUid === currentUid && req.status === 'pending');
        updateUnreadBadgeUI();
        const friendsView = document.getElementById('friendsView');
        if (friendsView && !friendsView.classList.contains('hidden')) {
            renderFriendsList();
        }
    });

    // B. 監聽群組邀請
    if (groupInvitesListener) rtdb.ref('groupInvites').off('value', groupInvitesListener);
    groupInvitesListener = rtdb.ref('groupInvites').on('value', snapshot => {
        const data = snapshot.val() || {};
        pendingGroupInvitesList = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            .filter(inv => inv.toUid === currentUid && inv.status === 'pending');
        updateUnreadBadgeUI();
        const friendsView = document.getElementById('friendsView');
        if (friendsView && !friendsView.classList.contains('hidden')) {
            renderFriendsList();
        }
    });

    // C. 監聽包含自己的所有聊天頻道
    if (chatsListListener) rtdb.ref('chats').off('value', chatsListListener);
    chatsListListener = rtdb.ref('chats').on('value', snapshot => {
        const data = snapshot.val() || {};
        userChatThreads = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            .filter(chat => chat.members && (Array.isArray(chat.members) ? chat.members.includes(currentUid) : chat.members[currentUid]));
        updateUnreadBadgeUI();
        const chatsView = document.getElementById('chatsView');
        if (chatsView && !chatsView.classList.contains('hidden')) {
            renderChatThreads(false);
        }
    });

    // D. 監聽系統公告
    if (announcementsListener) rtdb.ref('announcements').off('value', announcementsListener);
    announcementsListener = rtdb.ref('announcements').on('value', snapshot => {
        const data = snapshot.val() || {};
        cloudAnnouncements = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        window.appAnnouncements = cloudAnnouncements;
        updateUnreadBadgeUI();
        const noticeView = document.getElementById('noticeView');
        if (noticeView && !noticeView.classList.contains('hidden')) {
            renderAnnouncements();
        }
    });
}

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

function closeChatDrawer() {
    const rtdb = getRtdb();
    if (activeChatListener && currentActiveChatId && rtdb) {
        rtdb.ref(`chats/${currentActiveChatId}/messages`).off('value', activeChatListener);
        activeChatListener = null;
    }
    const drawer = document.getElementById('chatDrawer');
    if (drawer) drawer.classList.add('hidden');
}

function switchChatTab(tab) {
    const rtdb = getRtdb();
    if (activeChatListener && currentActiveChatId && rtdb) {
        rtdb.ref(`chats/${currentActiveChatId}/messages`).off('value', activeChatListener);
        activeChatListener = null;
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

async function renderFriendsList() {
    const container = document.getElementById('friendsListContainer');
    if (!container) return;

    const friends = (window.userData && window.userData.friends) ? window.userData.friends : [];
    const query = chatSearchQuery;

    let html = '';

    if (pendingRequestsList.length > 0) {
        html += `
            <div class="mb-3 p-3 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <i class="fa-solid fa-user-clock text-amber-600"></i>
                        <span>${t('pendingRequests')} (${pendingRequestsList.length})</span>
                    </span>
                </div>
                <div class="space-y-2">
        `;
        html += pendingRequestsList.map(req => `
            <div class="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                    <img src="${req.fromAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(req.fromNickname)}`}" class="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover">
                    <div>
                        <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${escapeHTML(req.fromNickname)}</h4>
                        <p class="text-[10px] text-slate-400 font-mono">${escapeHTML(req.fromEmail || '')}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-1.5">
                    <button type="button" onclick="handleAcceptFriendRequest('${req.id}', '${req.fromUid}', '${encodeURIComponent(req.fromNickname)}', '${req.fromEmail || ''}', '${encodeURIComponent(req.fromAvatar || '')}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition shadow-2xs">
                        ${t('btnAccept')}
                    </button>
                    <button type="button" onclick="handleRejectFriendRequest('${req.id}')" class="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 text-[11px] font-bold rounded-lg transition">
                        ${t('btnReject')}
                    </button>
                </div>
            </div>
        `).join('');
        html += `</div></div>`;
    }

    if (pendingGroupInvitesList.length > 0) {
        html += `
            <div class="mb-3 p-3 bg-purple-50/80 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                        <i class="fa-solid fa-users-rectangle text-purple-600"></i>
                        <span>${t('pendingGroupInvites')} (${pendingGroupInvitesList.length})</span>
                    </span>
                </div>
                <div class="space-y-2">
        `;
        html += pendingGroupInvitesList.map(inv => `
            <div class="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                    <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1">
                        <i class="fa-solid fa-users text-purple-500 text-[10px]"></i>
                        <span>${escapeHTML(inv.groupName)}</span>
                    </h4>
                    <p class="text-[10px] text-slate-400 mt-0.5">${t('inviter')}<span class="font-semibold text-slate-600 dark:text-slate-300">${escapeHTML(inv.inviterNickname)}</span></p>
                </div>
                <div class="flex items-center space-x-1.5">
                    <button type="button" onclick="handleAcceptGroupInvite('${inv.id}', '${inv.groupId}', '${encodeURIComponent(inv.groupName)}')" class="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg transition shadow-2xs">
                        ${t('btnJoin')}
                    </button>
                    <button type="button" onclick="handleRejectGroupInvite('${inv.id}')" class="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 text-[11px] font-bold rounded-lg transition">
                        ${t('btnReject')}
                    </button>
                </div>
            </div>
        `).join('');
        html += `</div></div>`;
    }

    if (query.includes('@') && !friends.some(f => f.email && f.email.toLowerCase() === query)) {
        html += `
            <div onclick="sendFriendRequestByEmail('${escapeHTML(query)}', this)" class="p-3 bg-brand-50 dark:bg-brand-950/40 rounded-xl border border-brand-200 dark:border-brand-800 hover:bg-brand-100 transition cursor-pointer flex items-center justify-between mb-3">
                <div class="flex items-center space-x-2 text-brand-700 dark:text-brand-300">
                    <i class="fa-solid fa-paper-plane text-sm"></i>
                    <span class="text-xs font-bold">${t('sendFriendReqTo', { query: escapeHTML(query) })}</span>
                </div>
                <span class="text-xs font-bold bg-brand-600 text-white px-2 py-0.5 rounded-lg">${t('btnSendReq')}</span>
            </div>
        `;
    }

    const filteredFriends = friends.filter(f => 
        (f.nickname || f.username || '').toLowerCase().includes(query) || 
        (f.email && f.email.toLowerCase().includes(query))
    );

    if (filteredFriends.length === 0 && !html) {
        container.innerHTML = `<div class="text-center text-slate-400 py-8 text-xs">${t('emptyFriendSearchResult', { query: escapeHTML(query) })}</div>`;
        return;
    }

    if (filteredFriends.length > 0) {
        html += `<div class="text-[11px] font-bold text-slate-500 mb-1">${t('myFriendsList')}</div>`;
        html += filteredFriends.map(f => {
            const displayName = f.nickname || f.username;
            return `
                <div class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-brand-300 transition flex justify-between items-center mb-2">
                    <div class="flex items-center space-x-3">
                        <img src="${f.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`}" class="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 object-cover">
                        <div>
                            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${escapeHTML(displayName)}</h4>
                            <p class="text-[10px] text-slate-400 font-mono">${escapeHTML(f.email || '')}</p>
                        </div>
                    </div>
                    <button type="button" onclick="startPrivateChat('${encodeURIComponent(displayName)}', '${f.uid || ''}')" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center space-x-1">
                        <i class="fa-solid fa-comment-dots"></i>
                        <span>${t('typePrivate')}</span>
                    </button>
                </div>
            `;
        }).join('');
    }

    container.innerHTML = html;
}

async function sendFriendRequestByEmail(emailInput = null, btnElem = null) {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能發送好友申請！', 'warning');
        return;
    }

    const rtdb = getRtdb();
    if (!rtdb) return;

    try {
        const targetEmail = (emailInput || prompt('請輸入對方的電子郵件 (Email)：') || '').trim().toLowerCase();
        if (!targetEmail || !targetEmail.includes('@')) {
            if (targetEmail && typeof showToast === 'function') showToast('請輸入有效的電子郵件格式！', 'warning');
            return;
        }

        const currentUid = auth.currentUser.uid;
        const myName = (window.userData && window.userData.nickname) ? window.userData.nickname : (auth.currentUser?.displayName || '使用者');
        const myEmail = auth.currentUser.email;

        const newReqRef = rtdb.ref('friendRequests').push();
        await newReqRef.set({
            fromUid: currentUid,
            fromNickname: myName,
            fromEmail: myEmail,
            fromAvatar: auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUid)}`,
            toEmail: targetEmail,
            toUid: '',
            status: 'pending',
            createdAt: Date.now()
        });

        if (typeof showToast === 'function') showToast(`🎉 已成功發送好友申請！`, 'success');
    } catch (e) {
        console.error("發送好友申請失敗:", e);
    }
}

async function handleAcceptFriendRequest(reqId, fromUid, encodedNickname, fromEmail, encodedAvatar) {
    const fromNickname = decodeURIComponent(encodedNickname);
    const fromAvatar = decodeURIComponent(encodedAvatar);
    const currentUid = auth.currentUser ? auth.currentUser.uid : '';
    const rtdb = getRtdb();
    if (!rtdb) return;

    try {
        await rtdb.ref(`friendRequests/${reqId}`).update({ status: 'accepted' });

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
        }

        const chatId = [currentUid, fromUid].sort().join('_');
        const membersMap = {};
        membersMap[currentUid] = true;
        membersMap[fromUid] = true;

        await rtdb.ref(`chats/${chatId}`).update({
            type: 'private',
            name: fromNickname,
            members: membersMap,
            updatedAt: Date.now()
        });

        if (typeof showToast === 'function') showToast(`🤝 已同意「${fromNickname}」的好友申請！`, 'success');
        renderFriendsList();
    } catch (e) {
        console.error("同意好友申請失敗:", e);
    }
}

async function handleRejectFriendRequest(reqId) {
    const rtdb = getRtdb();
    if (!rtdb) return;
    try {
        await rtdb.ref(`friendRequests/${reqId}`).update({ status: 'rejected' });
        if (typeof showToast === 'function') showToast('已拒絕該好友申請', 'info');
        renderFriendsList();
    } catch (e) {
        console.error("拒絕好友申請失敗:", e);
    }
}

async function createGroupPrompt() {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能建立群組！', 'warning');
        return;
    }

    const groupName = (prompt('請輸入新群組名稱：') || '').trim();
    if (!groupName) return;

    const currentUid = auth.currentUser.uid;
    const myName = (window.userData && window.userData.nickname) ? window.userData.nickname : '玩家';
    const rtdb = getRtdb();
    if (!rtdb) return;

    try {
        const newChatRef = rtdb.ref('chats').push();
        const membersMap = {};
        membersMap[currentUid] = true;

        await newChatRef.set({
            type: 'group',
            name: groupName,
            ownerUid: currentUid,
            members: membersMap,
            lastMessage: `${myName} 建立了群組「${groupName}」`,
            lastSenderUid: currentUid,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        if (typeof showToast === 'function') showToast(`🎉 已成功建立群組「${groupName}」！`, 'success');
        openChatWindow(newChatRef.key, groupName);
    } catch (e) {
        console.error("建立群組失敗:", e);
    }
}

async function startPrivateChat(encodedTargetUsername, targetUid = '') {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast('請先登入帳號才能使用私聊！', 'warning');
        return;
    }

    const targetUser = decodeURIComponent(encodedTargetUsername);
    const currentUid = auth.currentUser ? auth.currentUser.uid : '';
    const rtdb = getRtdb();
    if (!rtdb) return;

    if (!targetUid && window.userData && window.userData.friends) {
        const found = window.userData.friends.find(f => (f.nickname || f.username) === targetUser);
        if (found && found.uid) targetUid = found.uid;
    }

    const chatId = (currentUid && targetUid) 
        ? [currentUid, targetUid].sort().join('_') 
        : 'chat_private_' + encodeURIComponent(targetUser);

    const membersMap = {};
    if (currentUid) membersMap[currentUid] = true;
    if (targetUid) membersMap[targetUid] = true;

    try {
        await rtdb.ref(`chats/${chatId}`).update({
            type: 'private',
            name: targetUser,
            members: membersMap,
            updatedAt: Date.now()
        });
    } catch (e) {
        console.warn("初始化 RTDB 對話失敗:", e);
    }

    openChatWindow(chatId, targetUser);
}

async function renderChatThreads(isAdminInspector = false) {
    const container = document.getElementById('chatThreadsList');
    if (!container) return;

    const currentUid = auth.currentUser ? auth.currentUser.uid : '';
    const isAdmin = window.userData && window.userData.role === 'admin';
    const query = chatSearchQuery;

    let threads = [...userChatThreads];

    if (!threads.some(t => t.id === 'chat_group_public')) {
        threads.unshift({
            id: 'chat_group_public',
            type: 'group',
            name: '全站公開討論區'
        });
    }

    if (query) {
        threads = threads.filter(c => (c.name || '').toLowerCase().includes(query));
    }

    let html = `
        <div class="mb-3">
            <button type="button" onclick="createGroupPrompt()" class="w-full py-2 bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5">
                <i class="fa-solid fa-users-rectangle text-sm"></i>
                <span>${t('btnCreateGroup')}</span>
            </button>
        </div>
    `;

    if (threads.length === 0) {
        html += `<div class="text-center text-slate-400 py-8 text-xs">${t('emptyChatThreads')}</div>`;
        container.innerHTML = html;
        return;
    }

    html += threads.map(c => {
        const isGroup = c.type === 'group';
        const icon = isGroup ? 'fa-users text-purple-500' : 'fa-user-lock text-emerald-500';
        const displayName = c.name || '對話';

        const chatTime = typeof c.updatedAt === 'number' ? c.updatedAt : new Date(c.updatedAt).getTime();
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
                            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${escapeHTML(displayName)}</h4>
                            <span class="text-[9px] px-1.5 py-0.2 rounded font-semibold ${isGroup ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'}">${isGroup ? t('typeGroup') : t('typePrivate')}</span>
                        </div>
                        <p class="text-[11px] text-slate-400 line-clamp-1 mt-0.5">${escapeHTML(c.lastMessage || t('clickToStartChat'))}</p>
                    </div>
                </div>

                ${isAdmin ? `
                    <button type="button" onclick="event.stopPropagation(); deleteChatThread('${c.id}')" title="刪除" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition ml-2">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

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

    const rtdb = getRtdb();
    if (!rtdb || !chatId) return;

    if (activeChatListener) {
        rtdb.ref(`chats/${currentActiveChatId}/messages`).off('value', activeChatListener);
        activeChatListener = null;
    }

    activeChatListener = rtdb.ref(`chats/${chatId}/messages`).on('value', snapshot => {
        const data = snapshot.val() || {};
        const messages = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        renderMessagesList(messages);
    });
}

function backToChatThreads() {
    const rtdb = getRtdb();
    if (activeChatListener && currentActiveChatId && rtdb) {
        rtdb.ref(`chats/${currentActiveChatId}/messages`).off('value', activeChatListener);
        activeChatListener = null;
    }
    document.getElementById('activeChatWindow')?.classList.add('hidden');
    document.getElementById('chatsView')?.classList.remove('hidden');
    
    const isAdmin = window.userData && window.userData.role === 'admin';
    const tabAdminBtn = document.getElementById('tabAdminBtn');
    const isInspectorMode = isAdmin && tabAdminBtn && tabAdminBtn.className.includes('border-rose-600');
    renderChatThreads(isInspectorMode);
}

function renderMessagesList(messages = []) {
    const container = document.getElementById('chatMessagesBox');
    if (!container) return;

    const currentUid = (auth && auth.currentUser) ? auth.currentUser.uid : '';
    const isAdmin = window.userData && window.userData.role === 'admin';

    if (messages.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-6 text-xs">${t('noMessages')}</div>`;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isSystem = msg.sender === '系統提示';
        if (isSystem) {
            return `
                <div class="flex justify-center my-2">
                    <span class="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">${escapeHTML(msg.text)}</span>
                </div>
            `;
        }

        const isMe = msg.senderUid ? (msg.senderUid === currentUid) : (msg.sender === (window.userData?.username || ''));

        return `
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 my-1.5">
                <div class="flex items-center space-x-1">
                    <span class="text-[10px] text-slate-400 px-1">${escapeHTML(msg.sender || '匿名')}</span>
                    ${isAdmin && msg.id ? `
                        <button type="button" onclick="deleteChatMessage('${currentActiveChatId}', '${msg.id}')" title="刪除此訊息" class="text-rose-500 hover:text-rose-700 text-[10px] p-0.5 transition">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    ` : ''}
                </div>
                <div class="max-w-[80%] px-3 py-2 rounded-2xl text-xs ${isMe ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-tl-none'} shadow-2xs">
                    ${escapeHTML(msg.text)}
                </div>
                <span class="text-[9px] text-slate-400 px-1">${escapeHTML(msg.time || '')}</span>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

/**
 * 📤 發送訊息至 RTDB
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

    const rtdb = getRtdb();
    if (!rtdb) return;

    const currentUser = (window.userData && window.userData.nickname) 
        ? window.userData.nickname 
        : (auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || '使用者');
    
    const currentUid = auth.currentUser ? auth.currentUser.uid : '';
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (input) input.value = '';

    const newMsgRef = rtdb.ref(`chats/${currentActiveChatId}/messages`).push();

    try {
        await newMsgRef.set({
            sender: currentUser,
            senderUid: currentUid,
            text: text,
            time: timeStr,
            createdAt: Date.now()
        });

        await rtdb.ref(`chats/${currentActiveChatId}`).update({
            lastMessage: `${currentUser}: ${text}`,
            lastSenderUid: currentUid,
            updatedAt: Date.now()
        });

    } catch (err) {
        console.error("RTDB 發送訊息失敗:", err);
        if (typeof showToast === 'function') showToast('發送失敗：' + err.message, 'error');
    }
}

async function renderAnnouncements() {
    const container = document.getElementById('noticeList');
    if (!container) return;

    const isAdmin = window.userData ? window.userData.role === 'admin' : false;
    let annList = window.appAnnouncements || [];

    if (annList.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-8 text-xs">${t('noAnnouncements')}</div>`;
        return;
    }

    container.innerHTML = annList.map(ann => `
        <div class="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-2xs space-y-1.5 relative">
            <div class="flex justify-between items-center">
                <span class="font-bold text-xs text-brand-600 dark:text-brand-400">${escapeHTML(ann.title)}</span>
                <div class="flex items-center space-x-2">
                    <span class="text-[10px] text-slate-400">${escapeHTML(ann.time || '')}</span>
                    ${isAdmin ? `
                        <button type="button" onclick="deleteAnnouncement('${ann.id}')" title="刪除" class="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 p-1 rounded transition">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${escapeHTML(ann.content)}</p>
            <div class="text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-50 dark:border-slate-800">${t('authorLabel')}${escapeHTML(ann.author || '管理員')}</div>
        </div>
    `).join('');
}

async function deleteAnnouncement(annId) {
    if (!window.userData || window.userData.role !== 'admin') {
        if (typeof showToast === 'function') showToast('只有管理員可以刪除公告！', 'error');
        return;
    }

    const rtdb = getRtdb();
    if (confirm('👑 管理員警告：確定要刪除該公告嗎？') && rtdb) {
        try {
            await rtdb.ref(`announcements/${annId}`).remove();
            if (typeof showToast === 'function') showToast('已成功刪除該公告！', 'info');
        } catch (e) {
            console.error("刪除公告失敗：", e);
        }
    }
}

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

    const rtdb = getRtdb();
    if (!rtdb) {
        if (typeof showToast === 'function') showToast('資料庫未成功連線！', 'error');
        return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const newRef = rtdb.ref('announcements').push();
    try {
        await newRef.set({
            title: title,
            content: content,
            author: window.userData.nickname || auth.currentUser?.displayName || '管理員',
            time: dateStr,
            createdAt: Date.now()
        });

        if (titleInput) titleInput.value = '';
        if (contentInput) contentInput.value = '';

        if (typeof closeModal === 'function') closeModal('announceModal');
        if (typeof showToast === 'function') showToast('官方公告已成功發布！', 'success');
    } catch (e) {
        console.error("發布公告失敗：", e);
        if (typeof showToast === 'function') showToast('發布公告失敗：' + e.message, 'error');
    }
}