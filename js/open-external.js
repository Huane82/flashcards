/**
 * LZHCard - 外跳手機預設瀏覽器檢測與引導遮罩模組
 */
(function forceExternalBrowser() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const currentUrl = window.location.href;

    // 1. LINE 內建瀏覽器：自動帶參數觸發外跳
    if (ua.includes("LINE")) {
        if (!location.search.includes("openExternalBrowser=1")) {
            const separator = location.search ? "&" : "?";
            window.location.href = currentUrl + separator + "openExternalBrowser=1";
        }
        return;
    }

    // 2. Android 裝置 (IG / FB / 微信等 App)：利用 Android Intent 喚醒 Chrome
    if (/android/i.test(ua) && (ua.includes("Instagram") || ua.includes("FB") || ua.includes("FBAV"))) {
        const cleanUrl = currentUrl.replace(/^https?:\/\//, '');
        const intentUrl = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end;`;
        window.location.href = intentUrl;
        return;
    }

    // 3. iOS 裝置 (iPhone 的 IG / FB)：跳出精美引導遮罩
    if (/iPhone|iPad|iPod/i.test(ua) && (ua.includes("Instagram") || ua.includes("FB") || ua.includes("FBAV") || ua.includes("FBAN"))) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", showIosGuideModal);
        } else {
            showIosGuideModal();
        }
    }
})();

/**
 * 🎨 渲染高顏值遮罩 (掛載至 window 物件)
 */
function showIosGuideModal() {
    if (document.getElementById("ios-browser-guide-mask")) return;

    const mask = document.createElement("div");
    mask.id = "ios-browser-guide-mask";
    mask.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.88);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        padding: 16px 20px;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #ffffff;
        animation: fadeIn 0.25s ease-out;
    `;

    mask.innerHTML = `
        <div style="margin-right: 12px; margin-top: 4px; animation: bounce 1.2s infinite alternate;">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 17L17 7"></path>
                <path d="M7 7h10v10"></path>
            </svg>
        </div>

        <div style="
            background: rgba(255, 255, 255, 0.12);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 16px;
            padding: 20px;
            width: 100%;
            max-width: 320px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
            margin-top: 8px;
        ">
            <div style="font-size: 18px; font-weight: 700; color: #60A5FA; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                <span>💡 建議使用 Safari 開啟</span>
            </div>
            
            <ol style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.6; color: #E5E7EB;">
                <li style="margin-bottom: 8px;">點擊右上角點點選單 <b style="color: #fff; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">···</b></li>
                <li>選擇 <b style="color: #60A5FA;">「使用外部瀏覽器開啟」</b></li>
            </ol>

            <div style="margin-top: 16px; font-size: 13px; color: #9CA3AF; text-align: center;">
                即可獲得完整功能與最佳體驗
            </div>
        </div>

        <button id="close-guide-btn" style="
            margin-top: 24px;
            align-self: center;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: #9CA3AF;
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 14px;
            cursor: pointer;
        ">
            先繼續留在 App 內
        </button>

        <style>
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes bounce { from { transform: translate(0, 0); } to { transform: translate(6px, -6px); } }
        </style>
    `;

    document.body.appendChild(mask);

    document.getElementById("close-guide-btn").addEventListener("click", () => {
        mask.remove();
    });
}

// 🌟 核心修正：明確將函式綁定至 window 全域
window.showIosGuideModal = showIosGuideModal;