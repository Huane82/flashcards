/**
 * LZHCard - 外跳手機預設瀏覽器檢測模組 (Chrome / Safari Force Open)
 */
(function forceExternalBrowser() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const currentUrl = window.location.href;

    // 1. LINE 內建瀏覽器：附加 openExternalBrowser=1 參數觸發外跳
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

    // 3. iOS 裝置 (iPhone 的 IG / FB)：跳出引導遮罩
    if (/iPhone|iPad|iPod/i.test(ua) && (ua.includes("Instagram") || ua.includes("FB") || ua.includes("FBAV"))) {
        showIosGuideModal();
    }
})();

function showIosGuideModal() {
    document.addEventListener("DOMContentLoaded", () => {
        if (document.getElementById("ios-browser-guide")) return;

        const modal = document.createElement("div");
        modal.id = "ios-browser-guide";
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.88); color: #fff; z-index: 999999;
            display: flex; flex-direction: column; align-items: flex-end;
            padding: 24px; box-sizing: border-box; font-family: -apple-system, sans-serif;
        `;
        modal.innerHTML = `
            <div style="font-size: 22px; font-weight: bold; margin-bottom: 12px;">↗️ 點擊右上角「...」</div>
            <div style="font-size: 16px; line-height: 1.5; text-align: right;">
                選擇 <b>「在 Safari 中開啟」</b><br>以獲得完整功能與最佳體驗
            </div>
        `;
        document.body.appendChild(modal);
    });
}