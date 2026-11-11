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