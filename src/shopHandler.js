export async function handleBuyDeck(request, env, corsHeaders) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "未授權請求，缺少身份憑證 Token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const idToken = authHeader.split("Bearer ")[1];

  // 1. 驗證 Firebase Auth ID Token
  const tokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
  if (!tokenRes.ok) {
    return new Response(
      JSON.stringify({ error: "身份憑證無效或已過期，請重新登入" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const decodedToken = await tokenRes.json();
  const buyerUid = decodedToken.user_id;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "無效的 JSON 請求內容" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { price = 0, authorId = "" } = body;
  const projectId = "flashcards-5f514";

  const authHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${idToken}`
  };

  // 2. 讀取買家的真實金幣數
  const buyerUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${buyerUid}`;
  const buyerRes = await fetch(buyerUrl, { headers: authHeaders });

  if (!buyerRes.ok) {
    return new Response(
      JSON.stringify({ error: "找不到買家使用者資料" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const buyerData = await buyerRes.json();
  const rawCoins = buyerData.fields?.coins?.integerValue || buyerData.fields?.coins?.doubleValue || "0";
  const currentCoins = parseInt(rawCoins, 10) || 0;

  if (currentCoins < price) {
    return new Response(
      JSON.stringify({ error: `金幣不足！購買需要 ${price} 金幣，您目前只有 ${currentCoins} 金幣` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const newBuyerCoins = currentCoins - price;
  const sellerEarnings = Math.floor(price * 0.7);

  // 3. 扣款
  const updateBuyerRes = await fetch(`${buyerUrl}?updateMask.fieldPaths=coins`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({
      fields: { coins: { integerValue: newBuyerCoins.toString() } }
    })
  });

  if (!updateBuyerRes.ok) {
    return new Response(
      JSON.stringify({ error: "伺服器金幣扣款失敗，請稍後再試" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 4. 賣家收益劃轉 (70%)
  if (authorId && authorId !== buyerUid && sellerEarnings > 0) {
    try {
      const sellerUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${authorId}`;
      const sellerRes = await fetch(sellerUrl, { headers: authHeaders });

      if (sellerRes.ok) {
        const sellerData = await sellerRes.json();
        const sellerRawCoins = sellerData.fields?.coins?.integerValue || sellerData.fields?.coins?.doubleValue || "0";
        const sellerCurrentCoins = parseInt(sellerRawCoins, 10) || 0;
        const newSellerCoins = sellerCurrentCoins + sellerEarnings;

        await fetch(`${sellerUrl}?updateMask.fieldPaths=coins`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({
            fields: { coins: { integerValue: newSellerCoins.toString() } }
          })
        });
      }
    } catch (e) {
      console.warn("劃轉賣家收益失敗:", e);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      newCoins: newBuyerCoins,
      message: `交易成功！扣除 ${price} 金幣`
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}