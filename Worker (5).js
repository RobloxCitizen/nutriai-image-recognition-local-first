const MODEL = "gemini-2.5-flash";
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function reply(body, status, cors) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, ...JSON_HEADERS } });
}

function corsFor(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "*").split(",").map(x => x.trim());
  const value = allowed.includes("*") || allowed.includes(origin) ? (origin || "*") : allowed[0];
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Cache-Control": "no-store"
  };
}

function analysisPrompt(context = "") {
  return `You are a careful nutrition estimation assistant. Analyze the meal and return JSON only.
Use visible plate, cutlery, packaging and hand-size references to estimate portions. Never claim exactness. If food is fried, glossy, restaurant-made, dressed, or likely cooked with fat, include a reasonable oil or sauce estimate instead of silently undercounting. ${context}
Schema:
{"meal_name":"string","portion_g":0,"portion_estimate":"string","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0,"meal_type":"Breakfast|Lunch|Dinner|Snack","confidence":"low|medium|high","health_score":0,"highlights":["string"],"tips":["string"]}`;
}

function planPrompt(profile) {
  return `Create a practical one-day meal plan as JSON only. Target ${profile.calories} kcal, protein ${profile.protein}g, carbs ${profile.carbs}g, fat ${profile.fat}g. Diet: ${profile.diet}. Keep total calories within 5% and respect restrictions: ${profile.restrictions || "none"}.
Schema: {"breakfast":{"name":"string","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"instructions":"string"},"lunch":{},"dinner":{},"snack":{}}. Every meal object must use the full breakfast schema.`;
}

export default {
  async fetch(request, env) {
    const cors = corsFor(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405, cors);
    if (!env.GEMINI_API_KEY) return reply({ error: "Worker is not configured" }, 500, cors);

    try {
      const body = await request.json();
      const action = body.action || "analyze";
      let parts;

      if (action === "plan") {
        const p = body.profile || {};
        if (![p.calories, p.protein, p.carbs, p.fat].every(Number.isFinite)) return reply({ error: "Invalid profile" }, 400, cors);
        parts = [{ text: planPrompt(p) }];
      } else if (body.imageBase64) {
        if (typeof body.imageBase64 !== "string" || body.imageBase64.length > 5_500_000) return reply({ error: "Invalid or oversized image" }, 400, cors);
        const hint = String(body.textHint || "").slice(0, 500);
        parts = [
          { inlineData: { mimeType: body.mimeType || "image/jpeg", data: body.imageBase64 } },
          { text: analysisPrompt(hint ? `User context: ${hint}` : "") }
        ];
      } else {
        const meal = String(body.meal || "").trim();
        if (!meal || meal.length > 700) return reply({ error: "Invalid meal description" }, 400, cors);
        parts = [{ text: `${analysisPrompt()}\nMeal description: ${meal}` }];
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: action === "plan" ? 0.55 : 0.2, response_mime_type: "application/json" } }),
        signal: controller.signal
      });
      clearTimeout(timer);

      const data = await response.json();
      if (!response.ok) {
        const status = response.status === 429 ? 429 : 502;
        return reply({ error: status === 429 ? "AI limit reached. Manual logging still works." : "AI service unavailable" }, status, cors);
      }
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
      let parsed;
      try { parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")); }
      catch { return reply({ error: "AI returned malformed data" }, 502, cors); }
      return reply(parsed, 200, cors);
    } catch (error) {
      return reply({ error: error.name === "AbortError" ? "AI request timed out" : "Request failed" }, 500, cors);
    }
  }
};
