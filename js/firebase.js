// 你的 Firebase 設定資訊 (已補上東南亞區域 RTDB 網址)
const firebaseConfig = {
  apiKey: "AIzaSyCbAux_DnwsgYJn3tGwLPImcaIAzGkdiHE",
  authDomain: "flashcards-5f514.firebaseapp.com",
  databaseURL: "https://flashcards-5f514-default-rtdb.asia-southeast1.firebasedatabase.app", // 👈 補上這行連線設定
  projectId: "flashcards-5f514",
  storageBucket: "flashcards-5f514.firebasestorage.app",
  messagingSenderId: "471941628425",
  appId: "1:471941628425:web:0737bcaa210f2c4d9aaed8",
  measurementId: "G-8KNV18H30V"
};

// 初始化 Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

try {
  db.settings({
    experimentalForceLongPolling: true,
    useFetchStreams: false
  });
} catch (e) {
  console.warn("Firestore settings 已初始化過：", e);
}

// 1. Google 一鍵登入
async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await auth.signInWithPopup(provider);
    console.log("Google 登入成功:", result.user);

    if (typeof loadStorage === 'function') {
      await loadStorage();
    }
    if (typeof showToast === 'function') {
      showToast(`歡迎回來，${result.user.displayName || '使用者'}！`, "success");
    }
    return result.user;
  } catch (error) {
    if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
      console.warn("登入視窗已關閉或重新觸發");
      return;
    }
    console.error("Google 登入失敗:", error);
    if (typeof showToast === 'function') showToast("登入失敗：" + error.message, "error");
  }
}

// 2. Email 登入與註冊
async function loginWithEmail(email, password) {
  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    if (typeof loadStorage === 'function') await loadStorage();
    return result.user;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      try {
        const newResult = await auth.createUserWithEmailAndPassword(email, password);
        if (typeof showToast === 'function') showToast("已自動為您註冊新帳號並登入！", "success");
        if (typeof loadStorage === 'function') await loadStorage();
        return newResult.user;
      } catch (regError) {
        if (typeof showToast === 'function') showToast("註冊失敗：" + regError.message, "error");
      }
    } else {
      if (typeof showToast === 'function') showToast("登入失敗：" + error.message, "error");
    }
  }
}

// 3. 登出
async function logoutUser() {
  try {
    await auth.signOut();
    console.log("已成功登出");
    if (typeof loadStorage === 'function') {
      await loadStorage();
    }
    if (typeof showToast === 'function') showToast("已成功登出帳號！", "info");
  } catch (error) {
    console.error("登出失敗:", error);
  }
}

// 4. 🏷️ 儲存固定個人暱稱至 Firestore
async function handleSaveNickname() {
  const input = document.getElementById('settingsNicknameInput');
  const newNickname = (input?.value || '').trim();

  if (!newNickname) {
    if (typeof showToast === 'function') showToast('暱稱不能為空！', 'warning');
    return;
  }

  if (!auth.currentUser) {
    if (typeof showToast === 'function') showToast('訪客模式無法設定固定暱稱，請先登入帳號！', 'warning');
    return;
  }

  try {
    await db.collection('users').doc(auth.currentUser.uid).set({
      nickname: newNickname,
      email: auth.currentUser.email,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    if (!window.userData) window.userData = {};
    window.userData.nickname = newNickname;
    window.userData.username = newNickname;

    const emailEl = document.getElementById('settings-email');
    if (emailEl) emailEl.innerText = newNickname;

    if (typeof showToast === 'function') showToast(`固定暱稱已成功更新為「${newNickname}」！`, 'success');
  } catch (err) {
    console.error("更新暱稱失敗:", err);
    if (typeof showToast === 'function') showToast("更新暱稱失敗：" + err.message, "error");
  }
}

// 🌐 5. 儲存多選字庫組合至雲端與 LocalStorage
async function saveSelectedCategoriesToCloud(categories) {
  if (!Array.isArray(categories)) return;
  
  localStorage.setItem('lzhcard_selected_categories', JSON.stringify(categories));
  window.selectedCategories = categories;

  if (auth.currentUser) {
    try {
      await db.collection('users').doc(auth.currentUser.uid).set({
        selectedCategories: categories,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("同步多選字庫至雲端失敗：", e);
    }
  }
}

// 🌐 6. 儲存好友列表至雲端 Firestore
async function saveFriendsToCloud(friends) {
  if (!Array.isArray(friends) || !auth.currentUser) return;
  try {
    await db.collection('users').doc(auth.currentUser.uid).set({
      friends: friends,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn("同步好友列表至雲端失敗：", e);
  }
}

// 7. 監聽帳號狀態切換，同步雲端資料與字庫記憶
auth.onAuthStateChanged(async (user) => {
  if (typeof setAppLoaderProgress === 'function') {
    setAppLoaderProgress(35, '驗證帳號狀態中...');
  }

  const emailEl = document.getElementById('settings-email');
  const subtextEl = document.getElementById('settings-subtext');
  const avatarEl = document.getElementById('settings-avatar');
  const navAvatarEl = document.getElementById('nav-avatar');
  const loggedOutEl = document.getElementById('settings-logged-out');
  const loggedInEl = document.getElementById('settings-logged-in');

  if (user) {
    let userNickname = user.displayName || (user.email ? user.email.split('@')[0] : '使用者');
    let userRole = 'user';
    let userCoins = 500;
    let userFriends = [];

    try {
      const userRef = db.collection('users').doc(user.uid);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        const data = userDoc.data();
        if (data.nickname) userNickname = data.nickname;
        if (data.role) userRole = data.role;
        if (typeof data.coins === 'number') userCoins = data.coins;
        if (Array.isArray(data.friends)) userFriends = data.friends;

        if (Array.isArray(data.selectedCategories) && data.selectedCategories.length > 0) {
          window.selectedCategories = data.selectedCategories;
          localStorage.setItem('lzhcard_selected_categories', JSON.stringify(data.selectedCategories));
        }
      }

      await userRef.set({
        email: user.email || '',
        photoURL: user.photoURL || '',
        nickname: userNickname,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    } catch (e) {
      console.warn("無法同步或讀取雲端使用者資料：", e);
    }

    if (!window.userData) window.userData = {};
    window.userData.nickname = userNickname;
    window.userData.username = userNickname;
    window.userData.role = userRole;
    window.userData.coins = userCoins;
    window.userData.friends = userFriends;

    const nicknameInput = document.getElementById('settingsNicknameInput');
    if (nicknameInput) nicknameInput.value = userNickname;

    if (emailEl) {
      emailEl.removeAttribute('data-i18n');
      emailEl.innerText = userNickname;
    }
    if (subtextEl) {
      subtextEl.removeAttribute('data-i18n');
      subtextEl.innerText = user.email ? `已連結：${user.email}` : "已連結 Google 帳號";
    }

    const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.uid)}`;
    const userPhoto = user.photoURL || defaultAvatar;

    if (avatarEl) avatarEl.src = userPhoto;
    if (navAvatarEl) navAvatarEl.src = userPhoto;
    if (loggedOutEl) loggedOutEl.style.display = 'none';
    if (loggedInEl) loggedInEl.style.display = 'block';

    if (typeof initChatRealtimeListeners === 'function') {
      initChatRealtimeListeners();
    }
  } else {
    if (!window.userData) window.userData = {};
    window.userData.username = '訪客玩家';
    window.userData.role = 'user';
    window.userData.coins = 0;
    window.userData.friends = [];

    if (emailEl) {
      emailEl.setAttribute('data-i18n', 'guestMode');
      emailEl.innerText = (typeof t === 'function') ? t('guestMode') : "訪客模式";
    }
    if (subtextEl) {
      subtextEl.setAttribute('data-i18n', 'notLinkedGoogle');
      subtextEl.innerText = (typeof t === 'function') ? t('notLinkedGoogle') : "目前未連結 Google 帳號";
    }

    const guestAvatar = "https://api.dicebear.com/7.x/bottts/svg?seed=user";
    if (avatarEl) avatarEl.src = guestAvatar;
    if (navAvatarEl) navAvatarEl.src = guestAvatar;
    if (loggedOutEl) loggedOutEl.style.display = 'block';
    if (loggedInEl) loggedInEl.style.display = 'none';
  }

  try {
    if (typeof setAppLoaderProgress === 'function') setAppLoaderProgress(60, '同步雲端字庫與設定...');
    if (typeof loadStorage === 'function') await loadStorage();

    if (typeof setAppLoaderProgress === 'function') setAppLoaderProgress(85, '載入畫面與權限中...');
    if (typeof updateUI === 'function') updateUI();
    if (typeof renderStore === 'function') renderStore();
    if (typeof updateUserCoinsUI === 'function') updateUserCoinsUI();
    if (typeof checkAdminPermissions === 'function') checkAdminPermissions();
  } finally {
    window.__appReadyToHideLoader = true;
    // ✅ 所有雲端資料、字庫與權限同步完成，自動關閉載入畫面
    if (typeof hideAppLoader === 'function') hideAppLoader();
  }

  const isTosAccepted = localStorage.getItem('lzhcard_tos_accepted') === 'true';
  const isCompleted = localStorage.getItem('lzhcard_onboarding_completed') === 'true';

  if (isTosAccepted && !isCompleted && typeof startOnboardingFlow === 'function') {
    setTimeout(() => {
      startOnboardingFlow();
    }, 200);
  }
});

// ==========================================
// 🔒 條款同意與新手引導流程控制 (welcomeModal)
// ==========================================

function toggleAuthButtons() {
  const checkbox = document.getElementById('tosCheckbox');
  const googleBtn = document.getElementById('welcomeGoogleBtn');
  const guestBtn = document.getElementById('welcomeGuestBtn');

  const isChecked = checkbox ? checkbox.checked : false;

  if (googleBtn) {
    googleBtn.disabled = !isChecked;
    if (isChecked) {
      googleBtn.className = "w-full py-3 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs";
    } else {
      googleBtn.className = "w-full py-3 bg-slate-200 dark:bg-slate-700 text-slate-400 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-not-allowed";
    }
  }

  if (guestBtn) {
    guestBtn.disabled = !isChecked;
    if (isChecked) {
      guestBtn.className = "w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs";
    } else {
      guestBtn.className = "w-full py-3 bg-slate-200 dark:bg-slate-700 text-slate-400 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-not-allowed";
    }
  }
}

async function handleWelcomeGoogleLogin() {
  localStorage.setItem('lzhcard_tos_accepted', 'true');

  const user = await loginWithGoogle();
  if (user) {
    if (typeof startOnboardingFlow === 'function') {
      startOnboardingFlow();
    } else {
      if (typeof closeModal === 'function') closeModal('welcomeModal');
    }
  }
}

function handleWelcomeGuestLogin() {
  localStorage.setItem('lzhcard_tos_accepted', 'true');
  
  if (typeof closeModal === 'function') {
    closeModal('welcomeModal');
  }

  setTimeout(() => {
    if (typeof startOnboardingFlow === 'function') {
      startOnboardingFlow();
    }
  }, 150);
}

function checkWelcomeModalState() {
  const isAccepted = localStorage.getItem('lzhcard_tos_accepted') === 'true';
  const welcomeModal = document.getElementById('welcomeModal');
  
  if (!isAccepted && welcomeModal) {
    welcomeModal.classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', checkWelcomeModalState);
