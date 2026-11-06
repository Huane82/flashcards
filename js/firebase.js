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
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// 1. Google 一鍵登入
async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    console.log("Google 登入成功:", result.user);
    return result.user;
  } catch (error) {
    // 忽略被重複開啟視窗取消的正常過程，不彈出擾民警告
    if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
      console.warn("登入視窗已關閉或重新觸發");
      return;
    }
    console.error("Google 登入失敗:", error);
    alert("登入失敗：" + error.message);
  }
}

// 2. Email 登入與註冊
async function loginWithEmail(email, password) {
  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    return result.user;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      try {
        const newResult = await auth.createUserWithEmailAndPassword(email, password);
        alert("已自動為您註冊新帳號並登入！");
        return newResult.user;
      } catch (regError) {
        alert("註冊失敗：" + regError.message);
      }
    } else {
      alert("登入失敗：" + error.message);
    }
  }
}

// 3. 登出
async function logoutUser() {
  try {
    await auth.signOut();
    console.log("已成功登出");
  } catch (error) {
    console.error("登出失敗:", error);
  }
}