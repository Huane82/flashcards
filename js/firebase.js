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

// 🌐 解決 WebChannel 串流連線失敗 (404 Not Found) 問題
try {
  db.settings({
    experimentalForceLongPolling: true,
    useFetchStreams: false
  });
} catch (e) {
  console.warn("Firestore settings 已初始化過：", e);
}

// 1. Google 一鍵登入 (加入強制帳號選擇選單與自動載入雲端資料)
async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  // 🌟 強制 Google 每次彈出帳號選擇畫面，解決無法切換帳號的問題
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await auth.signInWithPopup(provider);
    console.log("Google 登入成功:", result.user);

    // 登入成功後即時拉取該帳號在雲端的字庫與 API Key
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
    // 登出後重新載入本機快取的字庫
    if (typeof loadStorage === 'function') {
      await loadStorage();
    }
    if (typeof showToast === 'function') showToast("已成功登出帳號！", "info");
  } catch (error) {
    console.error("登出失敗:", error);
  }
}

// 4. 🏷️ 儲存固定個人暱稱至 Firestore (綁定 User ID 防止冒用)
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

    if (typeof showToast === 'function') showToast(`固定暱稱已成功更新為「${newNickname}」！`, 'success');
  } catch (err) {
    console.error("更新暱稱失敗:", err);
    if (typeof showToast === 'function') showToast("更新暱稱失敗：" + err.message, "error");
  }
}

// 5. 監聽帳號狀態切換，自動更新設定 UI 與載入對應帳號資料與個人暱稱
auth.onAuthStateChanged(async (user) => {
  const emailEl = document.getElementById('settings-email');
  const subtextEl = document.getElementById('settings-subtext');
  const avatarEl = document.getElementById('settings-avatar');
  const navAvatarEl = document.getElementById('nav-avatar');
  const loggedOutEl = document.getElementById('settings-logged-out');
  const loggedInEl = document.getElementById('settings-logged-in');

  if (user) {
    // 預設名稱
    let userNickname = user.displayName || (user.email ? user.email.split('@')[0] : '使用者');
    
    try {
      // 從 Firestore users 集合拉取雲端儲存的固定暱稱
      const userDoc = await db.collection('users').doc(user.uid).get();
      if (userDoc.exists && userDoc.data().nickname) {
        userNickname = userDoc.data().nickname;
      }
    } catch (e) {
      console.warn("無法從雲端讀取暱稱資料：", e);
    }

    if (!window.userData) window.userData = {};
    window.userData.nickname = userNickname;
    window.userData.username = userNickname;

    const nicknameInput = document.getElementById('settingsNicknameInput');
    if (nicknameInput) nicknameInput.value = userNickname;

    if (emailEl) emailEl.innerText = userNickname;
    if (subtextEl) subtextEl.innerText = user.email ? `已連結：${user.email}` : "已連結 Google 帳號";
    if (avatarEl) avatarEl.src = user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.uid)}`;
    if (navAvatarEl) navAvatarEl.src = user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.uid)}`;
    if (loggedOutEl) loggedOutEl.style.display = 'none';
    if (loggedInEl) loggedInEl.style.display = 'block';
  } else {
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

  if (typeof renderStore === 'function') {
    renderStore();
  }
});