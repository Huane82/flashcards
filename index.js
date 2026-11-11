import { handleGeminiAi } from "./src/aiHandler.js";
import { handleBuyDeck } from "./src/shopHandler.js";

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 🌟 1. 檢測 User-Agent 與請求類型
    const ua = request.headers.get("user-agent") || "";
    const isIosInApp = /iPhone|iPad|iPod/i.test(ua) && (ua.includes("Instagram") || ua.includes("FB") || ua.includes("FBAV") || ua.includes("FBAN"));

    // 🌟 2. 僅針對 iOS 的 IG / FB「網頁開啟 (GET)」請求傳送下載標頭，觸發系統呼叫外部 Safari
    if (request.method === "GET" && isIosInApp) {
      return new Response("Redirecting to Safari...", {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="redirect.pdf"'
        }
      });
    }

    const url = new URL(request.url);

    try {
      // 🔀 路由 1：商店金幣交易
      if (url.pathname.endsWith("/buy-deck") && request.method === "POST") {
        return await handleBuyDeck(request, env, corsHeaders);
      }

      // 🔀 預設路由：Gemini AI 萬能解析
      return await handleGeminiAi(request, env, corsHeaders);

    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Worker 內部例外: " + err.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
};