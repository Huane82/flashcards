export async function handleGeminiAi(request, env, corsHeaders) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "伺服器未設定 GEMINI_API_KEY 環境變數" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "無效的 JSON 請求內容" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const GEMINI_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.8-flash"
  ];

  let lastErrorData = null;

  for (const model of GEMINI_MODELS) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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

  return new Response(
    JSON.stringify(lastErrorData || { error: "所有 Gemini 模型皆回應失敗" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}