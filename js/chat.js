/**
 * LZHCard - 聊天、好友、群組、公告、在線狀態、已讀與隱私控制模組 (chat.js)
 */

if (!window.userData) window.userData = {};
if (!window.userData.friends) window.userData.friends = [];

let currentActiveChatId = null;
let currentActiveChatData = null;
let chatSearchQuery = '';

// RTDB 監聽器引用
let activeChatListener = null;
let activeChatReadListener = null;
let friendRequestsListener = null;
let groupInvitesListener = null;
let chatsListListener = null;
let announcementsListener = null;
let presenceStatusListener = null;
let connectedStateListener = null;
let onlineCountObserver = null;
let _isRenderingOnlineCount = false;

let pendingRequestsList = [];
let pendingGroupInvitesList = [];
let userChatThreads = [];
let cloudAnnouncements = [];
let onlineUsersMap = {}; // 記錄全站線上使用者狀態
let chatReadByMap = {};   // 記錄當前聊天室各成員最後已讀時間
let currentChatMessages = []; // 快取當前聊天室訊息，避免已讀狀態變更時重複向 Firebase 下載

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

    const adminOnlinePanel = document.getElementById('adminOnlineMonitorPanel');
    if (adminOnlinePanel) adminOnlinePanel.classList.toggle('hidden', !isAdmin);
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
 * 🟢 寫入目前使用者的線上狀態資料
 */
function writeCurrentUserOnlineStatus() {
    if (isGuestUser()) return;
    const currentUser = firebase.auth()?.currentUser;
    const rtdb = getRtdb();
    if (!rtdb || !currentUser) return;

    const currentUid = currentUser.uid;
    const userStatusRef = rtdb.ref(`status/${currentUid}`);
    const resolvedNickname = (window.userData && window.userData.nickname)
        || currentUser.displayName
        || (currentUser.email ? currentUser.email.split('@')[0] : '')
        || (typeof t === 'function' ? t('defaultPlayerName') : '玩家');

    userStatusRef.set({
        state: 'online',
        nickname: resolvedNickname,
        email: currentUser.email || '',
        hidePrivacy: !!(window.userData && window.userData.privacyHideStatus),
        last_changed: firebase.database.ServerValue.TIMESTAMP
    }).catch(() => {});
}

/**
 * 🟢 1. 在線狀態 Presence 綁定與自動離線偵測
 */
function initUserPresenceTracker() {
    if (isGuestUser()) return;
    const currentUid = firebase.auth()?.currentUser?.uid;
    const rtdb = getRtdb();
    if (!rtdb || !currentUid) return;

    const userStatusRef = rtdb.ref(`status/${currentUid}`);
    const connectedRef = rtdb.ref('.info/connected');

    if (connectedStateListener) {
        connectedRef.off('value', connectedStateListener);
    }

    connectedStateListener = connectedRef.on('value', snapshot => {
        if (snapshot.val() === false) return;

        userStatusRef.onDisconnect().set({
            state: 'offline',
            last_changed: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            writeCurrentUserOnlineStatus();
        }).catch(() => {});
    });
}

/**
 * 📡 2. 初始化 Realtime Database 全局即時監聽器
 */
function initChatRealtimeListeners() {
    const rtdb = getRtdb();
    if (!rtdb || !firebase.auth || !firebase.auth().currentUser) return;
    const currentUid = firebase.auth().currentUser.uid;

    initUserPresenceTracker();

    if (presenceStatusListener) rtdb.ref('status').off('value', presenceStatusListener);
    presenceStatusListener = rtdb.ref('status').on('value', snapshot => {
        onlineUsersMap = snapshot.val() || {};
        renderOnlineStatusUI();
    });

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

/**
 * 🛡️ 保護線上人數標籤不被 i18n 重新渲染時意外覆蓋回 0 人
 */
function ensureOnlineCountObserver(onlineCountEl) {
    if (!onlineCountEl || onlineCountObserver || typeof MutationObserver === 'undefined') return;
    onlineCountObserver = new MutationObserver(() => {
        if (!_isRenderingOnlineCount) {
            renderOnlineStatusUI();
        }
    });
    onlineCountObserver.observe(onlineCountEl, { childList: true, characterData: true, subtree: true });
}

/**
 * 👁️ 3. 渲染線上人數、線上名單與管理員透視面板 (支援 i18n)
 */
function renderOnlineStatusUI() {
    const onlineCountEl = document.getElementById('onlineUserCountText');
    const onlineListContainer = document.getElementById('onlineUsersListContainer');
    const adminMonitorContainer = document.getElementById('adminOnlineMonitorList');

    ensureOnlineCountObserver(onlineCountEl);

    const isAdmin = window.userData && window.userData.role === 'admin';
    const myPrivacyHide = !isAdmin && !!(window.userData && window.userData.privacyHideStatus);

    let visibleOnlineUsers = [];
    let allOnlineUsersForAdmin = [];

    Object.keys(onlineUsersMap).forEach(uid => {
        const userStatus = onlineUsersMap[uid];
        if (userStatus && userStatus.state === 'online') {
            allOnlineUsersForAdmin.push({ uid, ...userStatus });

            const targetUserIsHidden = !!userStatus.hidePrivacy;

            if (isAdmin) {
                visibleOnlineUsers.push({ uid, ...userStatus });
            } else if (!myPrivacyHide && !targetUserIsHidden) {
                visibleOnlineUsers.push({ uid, ...userStatus });
            }
        }
    });

    if (onlineCountEl) {
        _isRenderingOnlineCount = true;
        try {
            if (myPrivacyHide) {
                const hiddenText = (typeof t === 'function' && t('onlineUserHidden') !== 'onlineUserHidden')
                    ? t('onlineUserHidden')
                    : '線上人數：已隱藏 (隱私模式開啟中)';
                onlineCountEl.innerHTML = `<span class="w-2 h-2 bg-slate-400 rounded-full inline-block"></span> ${hiddenText}`;
            } else {
                const countText = (typeof t === 'function' && t('onlineUserCount', { count: visibleOnlineUsers.length }) !== 'onlineUserCount')
                    ? t('onlineUserCount', { count: visibleOnlineUsers.length })
                    : `線上人數：${visibleOnlineUsers.length} 人`;
                onlineCountEl.innerHTML = `<span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse inline-block"></span> ${countText}`;
            }
        } finally {
            _isRenderingOnlineCount = false;
        }
    }

    if (onlineListContainer) {
        if (myPrivacyHide) {
            onlineListContainer.innerHTML = `<div class="p-2 text-center text-slate-400 text-xs">${typeof t === 'function' ? t('privacyListNotice') : '您已開啟隱私模式（無法查看他人狀態，他人亦無法查看您）'}</div>`;
        } else if (visibleOnlineUsers.length === 0) {
            onlineListContainer.innerHTML = `<div class="p-2 text-center text-slate-400 text-xs">${typeof t === 'function' ? t('onlineListEmpty') : '目前沒有其他在線使用者'}</div>`;
        } else {
            onlineListContainer.innerHTML = visibleOnlineUsers.map(u => `
                <div class="flex items-center space-x-2 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs">
                    <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span class="font-bold text-slate-700 dark:text-slate-200">${escapeHTML(u.nickname)}</span>
                </div>
            `).join('');
        }
    }

    if (adminMonitorContainer && isAdmin) {
        adminMonitorContainer.innerHTML = allOnlineUsersForAdmin.map(u => `
            <div class="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs my-1">
                <div class="flex items-center space-x-2">
                    <span class="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                    <div>
                        <div class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <span>${escapeHTML(u.nickname)}</span>
                            ${u.hidePrivacy ? `<span class="px-1.5 py-0.2 bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 text-[9px] rounded-full font-semibold">${typeof t === 'function' ? t('badgeStealth') : '開隱身'}</span>` : ''}
                        </div>
                        <p class="text-[10px] text-slate-400 font-mono">UID: ${u.uid}</p>
                    </div>
                </div>
                <span class="text-[10px] text-slate-400">${u.email || (typeof t === 'function' ? t('noEmail') : '無 Email')}</span>
            </div>
        `).join('');
    }
}

// 手機瀏覽器從背景切回前台時，立即刷新上線狀態與人數
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            writeCurrentUserOnlineStatus();
            renderOnlineStatusUI();
        }
    });
}

/**
 * ⚙️ 4. 隱私控制：開關顯示線上狀態與已讀
 */
async function togglePrivacyHideStatus(enableHide) {
    if (!window.userData) window.userData = {};
    window.userData.privacyHideStatus = enableHide;

    if (typeof saveUserData === 'function') saveUserData();

    const currentUid = firebase.auth()?.currentUser?.uid;
    const rtdb = getRtdb();
    if (rtdb && currentUid) {
        try {
            await rtdb.ref(`status/${currentUid}/hidePrivacy`).set(enableHide);
            renderOnlineStatusUI();
            if (typeof showToast === 'function') {
                showToast(enableHide ? (typeof t === 'function' ? t('toastPrivacyOn') : '🔒 已開啟隱私模式：已隱藏您的線上狀態與已讀標記') : (typeof t === 'function' ? t('toastPrivacyOff') : '🌐 已關閉隱私模式：恢復公開線上狀態與已讀'), 'info');
            }
        } catch (e) {
            console.error("更新隱私設定失敗:", e);
        }
    }
}

function openChatDrawer() {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastLoginRequiredChat') : '請先登入帳號才能使用聊天功能！', 'warning');
        return;
    }

    const drawer = document.getElementById('chatDrawer');
    if (drawer) {
        drawer.classList.remove('hidden');
        if (typeof updateUserCoinsUI === 'function') updateUserCoinsUI();
        checkAdminPermissions();
        writeCurrentUserOnlineStatus();
        renderOnlineStatusUI();
        switchChatTab('chats');
    }
}

function closeChatDrawer() {
    const rtdb = getRtdb();
    if (activeChatListener && currentActiveChatId && rtdb) {
        rtdb.ref(`chats/${currentActiveChatId}/messages`).off('value', activeChatListener);
        if (activeChatReadListener) rtdb.ref(`chats/${currentActiveChatId}/readBy`).off('value', activeChatReadListener);
        activeChatListener = null;
        activeChatReadListener = null;
    }
    currentChatMessages = [];
    const drawer = document.getElementById('chatDrawer');
    if (drawer) drawer.classList.add('hidden');
}

function switchChatTab(tab) {
    const rtdb = getRtdb();
    if (activeChatListener && currentActiveChatId && rtdb) {
        rtdb.ref(`chats/${currentActiveChatId}/messages`).off('value', activeChatListener);
        if (activeChatReadListener) rtdb.ref(`chats/${currentActiveChatId}/readBy`).off('value', activeChatReadListener);
        activeChatListener = null;
        activeChatReadListener = null;
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
                        <span>${typeof t === 'function' ? t('pendingRequests') : '好友申請'} (${pendingRequestsList.length})</span>
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
                        ${typeof t === 'function' ? t('btnAccept') : '接受'}
                    </button>
                    <button type="button" onclick="handleRejectFriendRequest('${req.id}')" class="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 text-[11px] font-bold rounded-lg transition">
                        ${typeof t === 'function' ? t('btnReject') : '拒絕'}
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
                        <span>${typeof t === 'function' ? t('pendingGroupInvites') : '群組邀請'} (${pendingGroupInvitesList.length})</span>
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
                    <p class="text-[10px] text-slate-400 mt-0.5">${typeof t === 'function' ? t('inviter') : '邀請者：'}<span class="font-semibold text-slate-600 dark:text-slate-300">${escapeHTML(inv.inviterNickname)}</span></p>
                </div>
                <div class="flex items-center space-x-1.5">
                    <button type="button" onclick="handleAcceptGroupInvite('${inv.id}', '${inv.groupId}', '${encodeURIComponent(inv.groupName)}')" class="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg transition shadow-2xs">
                        ${typeof t === 'function' ? t('btnJoin') : '加入'}
                    </button>
                    <button type="button" onclick="handleRejectGroupInvite('${inv.id}')" class="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 text-[11px] font-bold rounded-lg transition">
                        ${typeof t === 'function' ? t('btnReject') : '拒絕'}
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
                    <span class="text-xs font-bold">${typeof t === 'function' ? t('sendFriendReqTo') : '發送好友申請給：'}${escapeHTML(query)}</span>
                </div>
                <span class="text-xs font-bold bg-brand-600 text-white px-2 py-0.5 rounded-lg">${typeof t === 'function' ? t('btnSendReq') : '發送申請'}</span>
            </div>
        `;
    }

    const filteredFriends = friends.filter(f => 
        (f.nickname || f.username || '').toLowerCase().includes(query) || 
        (f.email && f.email.toLowerCase().includes(query))
    );

    if (filteredFriends.length === 0 && !html) {
        container.innerHTML = `<div class="text-center text-slate-400 py-8 text-xs">${typeof t === 'function' ? t('noFriendsFound', { query: escapeHTML(query) }) : `查無符合「${escapeHTML(query)}」的好友`}</div>`;
        return;
    }

    if (filteredFriends.length > 0) {
        html += `<div class="text-[11px] font-bold text-slate-500 mb-1">${typeof t === 'function' ? t('lblMyFriends') : '我的好友列表'}</div>`;
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
                        <span>${typeof t === 'function' ? t('btnSendPrivateMsg') : '發送私訊'}</span>
                    </button>
                </div>
            `;
        }).join('');
    }

    container.innerHTML = html;
}

async function sendFriendRequestByEmail(emailInput = null, btnElem = null) {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastLoginRequiredFriend') : '請先登入帳號才能發送好友申請！', 'warning');
        return;
    }

    const rtdb = getRtdb();
    if (!rtdb) return;

    try {
        const targetEmail = (emailInput || prompt(typeof t === 'function' ? t('promptEnterFriendEmail') : '請輸入對方的電子郵件 (Email)：') || '').trim().toLowerCase();
        if (!targetEmail || !targetEmail.includes('@')) {
            if (targetEmail && typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastInvalidEmail') : '請輸入有效的電子郵件格式！', 'warning');
            return;
        }

        const currentUid = firebase.auth().currentUser.uid;
        const myName = (window.userData && window.userData.nickname) ? window.userData.nickname : (firebase.auth().currentUser?.displayName || (typeof t === 'function' ? t('defaultPlayerName') : '使用者'));
        const myEmail = firebase.auth().currentUser.email;

        const newReqRef = rtdb.ref('friendRequests').push();
        await newReqRef.set({
            fromUid: currentUid,
            fromNickname: myName,
            fromEmail: myEmail,
            fromAvatar: firebase.auth().currentUser?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUid)}`,
            toEmail: targetEmail,
            toUid: '',
            status: 'pending',
            createdAt: Date.now()
        });

        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastFriendReqSent') : '🎉 已成功發送好友申請！', 'success');
    } catch (e) {
        console.error("發送好友申請失敗:", e);
    }
}

async function handleAcceptFriendRequest(reqId, fromUid, encodedNickname, fromEmail, encodedAvatar) {
    const fromNickname = decodeURIComponent(encodedNickname);
    const fromAvatar = decodeURIComponent(encodedAvatar);
    const currentUid = firebase.auth()?.currentUser ? firebase.auth().currentUser.uid : '';
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

        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastFriendAccepted', { name: fromNickname }) : `🤝 已同意「${fromNickname}」的好友申請！`, 'success');
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
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastFriendRejected') : '已拒絕該好友申請', 'info');
        renderFriendsList();
    } catch (e) {
        console.error("拒絕好友申請失敗:", e);
    }
}

async function createGroupPrompt() {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastLoginRequiredGroup') : '請先登入帳號才能建立群組！', 'warning');
        return;
    }

    const groupName = (prompt(typeof t === 'function' ? t('promptNewGroupName') : '請輸入新群組名稱：') || '').trim();
    if (!groupName) return;

    const currentUid = firebase.auth().currentUser.uid;
    const myName = (window.userData && window.userData.nickname) ? window.userData.nickname : (typeof t === 'function' ? t('defaultPlayerName') : '玩家');
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
            lastMessage: typeof t === 'function' ? t('msgGroupCreated', { name: myName, group: groupName }) : `${myName} 建立了群組「${groupName}」`,
            lastSenderUid: currentUid,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastGroupCreated', { name: groupName }) : `🎉 已成功建立群組「${groupName}」！`, 'success');
        openChatWindow(newChatRef.key, groupName);
    } catch (e) {
        console.error("建立群組失敗:", e);
    }
}

async function startPrivateChat(encodedTargetUsername, targetUid = '') {
    if (isGuestUser()) {
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastLoginRequiredChat') : '請先登入帳號才能使用私聊！', 'warning');
        return;
    }

    const targetUser = decodeURIComponent(encodedTargetUsername);
    const currentUid = firebase.auth()?.currentUser ? firebase.auth().currentUser.uid : '';
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

    const currentUid = firebase.auth()?.currentUser ? firebase.auth().currentUser.uid : '';
    const isAdmin = window.userData && window.userData.role === 'admin';
    const query = chatSearchQuery;

    let threads = [...userChatThreads];

    if (!threads.some(t => t.id === 'chat_group_public')) {
        threads.unshift({
            id: 'chat_group_public',
            type: 'group',
            name: typeof t === 'function' ? t('publicChatRoom') : '全站公開討論區'
        });
    }

    if (query) {
        threads = threads.filter(c => (c.name || '').toLowerCase().includes(query));
    }

    let html = `
        <div class="mb-3">
            <button type="button" onclick="createGroupPrompt()" class="w-full py-2 bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5">
                <i class="fa-solid fa-users-rectangle text-sm"></i>
                <span>${typeof t === 'function' ? t('btnCreateGroup') : '建立新群組'}</span>
            </button>
        </div>
    `;

    if (threads.length === 0) {
        html += `<div class="text-center text-slate-400 py-8 text-xs">${typeof t === 'function' ? t('noChatChannels') : '目前沒有可顯示的對話頻道'}</div>`;
        container.innerHTML = html;
        return;
    }

    html += threads.map(c => {
        const isGroup = c.type === 'group';
        const icon = isGroup ? 'fa-users text-purple-500' : 'fa-user-lock text-emerald-500';
        const displayName = c.name || (typeof t === 'function' ? t('defaultChatTitle') : '對話');

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
                            <span class="text-[9px] px-1.5 py-0.2 rounded font-semibold ${isGroup ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'}">${isGroup ? (typeof t === 'function' ? t('badgeGroup') : '群組') : (typeof t === 'function' ? t('badgePrivate') : '私訊')}</span>
                        </div>
                        <p class="text-[11px] text-slate-400 line-clamp-1 mt-0.5">${escapeHTML(c.lastMessage || (typeof t === 'function' ? t('clickToChat') : '點擊開始對話...'))}</p>
                    </div>
                </div>

                ${isAdmin ? `
                    <button type="button" onclick="event.stopPropagation(); deleteChatThread('${c.id}')" title="${typeof t === 'function' ? t('btnBatchDelete') : '刪除'}" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition ml-2">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * 💬 5. 開啟聊天視窗並記錄自己的最後已讀時間點
 */
async function openChatWindow(chatId, encodedName = '') {
    const rtdb = getRtdb();
    if (activeChatListener && currentActiveChatId && rtdb) {
        rtdb.ref(`chats/${currentActiveChatId}/messages`).off('value', activeChatListener);
    }
    if (activeChatReadListener && currentActiveChatId && rtdb) {
        rtdb.ref(`chats/${currentActiveChatId}/readBy`).off('value', activeChatReadListener);
    }

    currentActiveChatId = chatId;
    currentChatMessages = [];
    const currentUid = firebase.auth()?.currentUser?.uid;

    localStorage.setItem(`lzhcard_last_read_chat_${chatId}`, Date.now().toString());
    updateUnreadBadgeUI();

    const displayName = encodedName ? decodeURIComponent(encodedName) : (typeof t === 'function' ? t('defaultChatTitle') : '對話');

    document.getElementById('chatsView')?.classList.add('hidden');
    document.getElementById('friendsView')?.classList.add('hidden');
    
    const activeWindow = document.getElementById('activeChatWindow');
    if (activeWindow) activeWindow.classList.remove('hidden');

    const titleEl = document.getElementById('activeChatTitle');
    if (titleEl) titleEl.textContent = displayName;

    if (!rtdb || !chatId) return;

    if (currentUid) {
        rtdb.ref(`chats/${chatId}/readBy/${currentUid}`).set(Date.now());
    }

    activeChatListener = rtdb.ref(`chats/${chatId}/messages`).on('value', snapshot => {
        const data = snapshot.val() || {};
        currentChatMessages = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        renderMessagesList(currentChatMessages);
    });

    activeChatReadListener = rtdb.ref(`chats/${chatId}/readBy`).on('value', snapshot => {
        chatReadByMap = snapshot.val() || {};
        renderMessagesList(currentChatMessages);
    });
}

function backToChatThreads() {
    const rtdb = getRtdb();
    if (activeChatListener && currentActiveChatId && rtdb) {
        rtdb.ref(`chats/${currentActiveChatId}/messages`).off('value', activeChatListener);
        if (activeChatReadListener) rtdb.ref(`chats/${currentActiveChatId}/readBy`).off('value', activeChatReadListener);
        activeChatListener = null;
        activeChatReadListener = null;
    }
    currentChatMessages = [];
    document.getElementById('activeChatWindow')?.classList.add('hidden');
    document.getElementById('chatsView')?.classList.remove('hidden');
    
    const isAdmin = window.userData && window.userData.role === 'admin';
    const tabAdminBtn = document.getElementById('tabAdminBtn');
    const isInspectorMode = isAdmin && tabAdminBtn && tabAdminBtn.className.includes('border-rose-600');
    renderChatThreads(isInspectorMode);
}

/**
 * 📖 6. 渲染訊息與計算已讀狀態
 */
function renderMessagesList(messages = []) {
    const container = document.getElementById('chatMessagesBox');
    if (!container) return;

    const currentUid = firebase.auth()?.currentUser ? firebase.auth().currentUser.uid : '';
    const isAdmin = window.userData && window.userData.role === 'admin';
    const myPrivacyHide = !isAdmin && !!(window.userData && window.userData.privacyHideStatus);

    if (messages.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-6 text-xs">${typeof t === 'function' ? t('noChatMessages') : '尚無聊天訊息，輸入第一條訊息開始交流吧！'}</div>`;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isSystem = msg.sender === '系統提示' || msg.sender === (typeof t === 'function' ? t('systemNotice') : '系統提示');
        if (isSystem) {
            return `
                <div class="flex justify-center my-2">
                    <span class="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">${escapeHTML(msg.text)}</span>
                </div>
            `;
        }

        const isMe = msg.senderUid ? (msg.senderUid === currentUid) : (msg.sender === (window.userData?.username || ''));

        let isReadByOther = false;
        if (isMe) {
            Object.keys(chatReadByMap).forEach(memberUid => {
                if (memberUid !== currentUid) {
                    const readTime = chatReadByMap[memberUid] || 0;
                    const msgTime = msg.createdAt || 0;
                    const targetStatus = onlineUsersMap[memberUid] || {};
                    const targetPrivacyHide = !!targetStatus.hidePrivacy;

                    if (readTime >= msgTime) {
                        if (isAdmin) {
                            isReadByOther = true;
                        } else if (!myPrivacyHide && !targetPrivacyHide) {
                            isReadByOther = true;
                        }
                    }
                }
            });
        }

        return `
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 my-1.5">
                <div class="flex items-center space-x-1">
                    <span class="text-[10px] text-slate-400 px-1">${escapeHTML(msg.sender || (typeof t === 'function' ? t('anonymousUser') : '匿名'))}</span>
                    ${isAdmin && msg.id ? `
                        <button type="button" onclick="deleteChatMessage('${currentActiveChatId}', '${msg.id}')" title="${typeof t === 'function' ? t('btnBatchDelete') : '刪除'}" class="text-rose-500 hover:text-rose-700 text-[10px] p-0.5 transition">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    ` : ''}
                </div>
                <div class="max-w-[80%] px-3 py-2 rounded-2xl text-xs ${isMe ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-tl-none'} shadow-2xs">
                    ${escapeHTML(msg.text)}
                </div>
                <div class="flex items-center space-x-1 px-1">
                    ${isMe && isReadByOther ? `<span class="text-[9px] text-brand-500 dark:text-brand-400 font-bold">${typeof t === 'function' ? t('badgeRead') : '已讀'}</span>` : ''}
                    <span class="text-[9px] text-slate-400">${escapeHTML(msg.time || '')}</span>
                </div>
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
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastLoginRequiredMessage') : '請先登入帳號才能發送訊息！', 'warning');
        return;
    }

    const input = document.getElementById('chatInput');
    const text = (input?.value || '').trim();
    if (!text || !currentActiveChatId) return;

    const rtdb = getRtdb();
    if (!rtdb) return;

    const currentUser = (window.userData && window.userData.nickname) 
        ? window.userData.nickname 
        : (firebase.auth().currentUser?.displayName || firebase.auth().currentUser?.email?.split('@')[0] || (typeof t === 'function' ? t('defaultPlayerName') : '使用者'));
    
    const currentUid = firebase.auth().currentUser.uid;
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

        await rtdb.ref(`chats/${currentActiveChatId}/readBy/${currentUid}`).set(Date.now());

    } catch (err) {
        console.error("RTDB 發送訊息失敗:", err);
        if (typeof showToast === 'function') showToast((typeof t === 'function' ? t('toastSendFailed') : '發送失敗：') + err.message, 'error');
    }
}

async function renderAnnouncements() {
    const container = document.getElementById('noticeList');
    if (!container) return;

    const isAdmin = window.userData ? window.userData.role === 'admin' : false;
    let annList = window.appAnnouncements || [];

    if (annList.length === 0) {
        container.innerHTML = `<div class="text-center text-slate-400 py-8 text-xs">${typeof t === 'function' ? t('noAnnouncementsYet') : '目前尚無系統公告'}</div>`;
        return;
    }

    container.innerHTML = annList.map(ann => `
        <div class="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-2xs space-y-1.5 relative">
            <div class="flex justify-between items-center">
                <span class="font-bold text-xs text-brand-600 dark:text-brand-400">${escapeHTML(ann.title)}</span>
                <div class="flex items-center space-x-2">
                    <span class="text-[10px] text-slate-400">${escapeHTML(ann.time || '')}</span>
                    ${isAdmin ? `
                        <button type="button" onclick="deleteAnnouncement('${ann.id}')" title="${typeof t === 'function' ? t('btnBatchDelete') : '刪除'}" class="text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 p-1 rounded transition">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${escapeHTML(ann.content)}</p>
            <div class="text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-50 dark:border-slate-800">${typeof t === 'function' ? t('publisher') : '發布者：'}${escapeHTML(ann.author || (typeof t === 'function' ? t('defaultAdminAuthor') : '管理員'))}</div>
        </div>
    `).join('');
}

async function deleteAnnouncement(annId) {
    if (!window.userData || window.userData.role !== 'admin') {
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastAdminDeleteNoticeOnly') : '只有管理員可以刪除公告！', 'error');
        return;
    }

    const rtdb = getRtdb();
    if (confirm(typeof t === 'function' ? t('confirmDeleteNotice') : '👑 管理員警告：確定要刪除該公告嗎？') && rtdb) {
        try {
            await rtdb.ref(`announcements/${annId}`).remove();
            if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastNoticeDeleted') : '已成功刪除該公告！', 'info');
        } catch (e) {
            console.error("刪除公告失敗：", e);
            if (typeof showToast === 'function') showToast((typeof t === 'function' ? t('toastNoticeDeleteFailed') : '刪除失敗：') + e.message, 'error');
        }
    }
}

async function submitAnnouncement() {
    if (!window.userData || window.userData.role !== 'admin') {
        const currentRole = window.userData?.role || '訪客';
        if (typeof showToast === 'function') {
            showToast(typeof t === 'function' ? t('toastAdminPubNoticeOnly', { role: currentRole }) : `只有管理員可以發布公告！(目前前端身分：${currentRole})`, 'error');
        }
        return;
    }

    const titleInput = document.getElementById('annTitle');
    const contentInput = document.getElementById('annContent');

    const title = (titleInput?.value || '').trim();
    const content = (contentInput?.value || '').trim();

    if (!title || !content) {
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastFillNoticeFields') : '請填寫完整公告標題與內容！', 'warning');
        return;
    }

    const rtdb = getRtdb();
    if (!rtdb) {
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastRtdbUninit') : 'Realtime Database SDK 未成功初始化！', 'error');
        return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const newRef = rtdb.ref('announcements').push();
    try {
        await newRef.set({
            title: title,
            content: content,
            author: window.userData.nickname || firebase.auth()?.currentUser?.displayName || (typeof t === 'function' ? t('defaultAdminAuthor') : '官方管理員'),
            time: dateStr,
            createdAt: Date.now()
        });

        if (titleInput) titleInput.value = '';
        if (contentInput) contentInput.value = '';

        if (typeof closeModal === 'function') closeModal('announceModal');
        if (typeof showToast === 'function') showToast(typeof t === 'function' ? t('toastNoticePublished') : '🎉 官方公告已成功發布！', 'success');
    } catch (e) {
        console.error("發布公告失敗：", e);
        if (typeof showToast === 'function') {
            showToast(typeof t === 'function' ? t('toastNoticePubFailed', { code: e.code || 'PERMISSION_DENIED', msg: e.message }) : `發布公告失敗 (${e.code || 'PERMISSION_DENIED'}): ${e.message}`, 'error');
        }
    }
}
