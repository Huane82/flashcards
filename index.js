export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    };

    // 1. 優先處理 CORS OPTIONS 預檢請求
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // 2. 檢查 API Key 變數
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "伺服器未設定 GEMINI_API_KEY 環境變數" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3. 解析 Body
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(
          JSON.stringify({ error: "無效的 JSON 請求內容" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 🌟 指定的模型輪詢清單
      const GEMINI_MODELS = [
        "gemini-3.5-flash-lite",
        "Gemini 3.6 Flash",
        "Gemini 3.8 Flash"
      ];

      let lastErrorData = null;

      // 4. 依序嘗試呼叫指定模型
      for (const model of GEMINI_MODELS) {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
        
        try {
          const response = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: body.contents }),
          });

          const data = await response.json();

          if (response.ok) {
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          lastErrorData = data;
        } catch (e) {
          lastErrorData = { error: e.message };
        }
      }

      // 若所有指定模型皆回應失敗，回傳最後一次的錯誤訊息
      return new Response(
        JSON.stringify(lastErrorData || { error: "所有 Gemini 模型皆回應失敗" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Worker 執行例外: " + err.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
};