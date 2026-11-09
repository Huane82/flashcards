// 你的 Firebase 設定資訊
const firebaseConfig = {
  apiKey: "AIzaSyCbAux_DnwsgYJn3tGwLPImcaIAzGkdiHE",
  authDomain: "flashcards-5f514.firebaseapp.com",
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

// 6. 監聽帳號狀態切換，同步雲端資料與字庫記憶
auth.onAuthStateChanged(async (user) => {
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
    
    try {
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        if (data.nickname) userNickname = data.nickname;
        if (data.role) userRole = data.role;
        if (typeof data.coins === 'number') userCoins = data.coins;
        
        // 自動載入帳號上記錄的多選字庫
        if (Array.isArray(data.selectedCategories) && data.selectedCategories.length > 0) {
          window.selectedCategories = data.selectedCategories;
          localStorage.setItem('lzhcard_selected_categories', JSON.stringify(data.selectedCategories));
        }

        // 自動載入好友列表
        if (Array.isArray(data.friends)) {
          if (!window.userData) window.userData = {};
          window.userData.friends = data.friends;
        }
      }
    } catch (e) {
      console.warn("無法從雲端讀取使用者資料：", e);
    }

    if (!window.userData) window.userData = {};
    window.userData.nickname = userNickname;
    window.userData.username = userNickname;
    window.userData.role = userRole;
    window.userData.coins = userCoins;

    const nicknameInput = document.getElementById('settingsNicknameInput');
    if (nicknameInput) nicknameInput.value = userNickname;

    if (emailEl) emailEl.innerText = userNickname;
    if (subtextEl) subtextEl.innerText = user.email ? `已連結：${user.email}` : "已連結 Google 帳號";
    if (avatarEl) avatarEl.src = user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.uid)}`;
    if (navAvatarEl) navAvatarEl.src = user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.uid)}`;
    if (loggedOutEl) loggedOutEl.style.display = 'none';
    if (loggedInEl) loggedInEl.style.display = 'block';

    // 🌟 初始化聊天與好友申請即時監聽器
    if (typeof initChatRealtimeListeners === 'function') {
      initChatRealtimeListeners();
    }
  } else {
    if (!window.userData) window.userData = {};
    window.userData.username = '訪客玩家';
    window.userData.role = 'user';
    window.userData.coins = 0;

    if (emailEl) emailEl.innerText = "訪客模式";
    if (subtextEl) subtextEl.innerText = "目前未連結 Google 帳號";
    if (avatarEl) avatarEl.src = "https://api.dicebear.com/7.x/bottts/svg?seed=user";
    if (navAvatarEl) navAvatarEl.src = "https://api.dicebear.com/7.x/bottts/svg?seed=user";
    if (loggedOutEl) loggedOutEl.style.display = 'block';
    if (loggedInEl) loggedInEl.style.display = 'none';
  }

  if (typeof loadStorage === 'function') {
    await loadStorage();
  }

  if (typeof updateUI === 'function') {
    updateUI();
  }

  if (typeof renderStore === 'function') {
    renderStore();
  }

  if (typeof updateUserCoinsUI === 'function') {
    updateUserCoinsUI();
  }

  if (typeof checkAdminPermissions === 'function') {
    checkAdminPermissions();
  }
});