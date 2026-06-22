export async function POST(req) {
  const { input } = await req.json();
  const isUrl = input.trim().startsWith("http");

  let pageText = "";
  let ogImage = "";
  if (isUrl) {
    try {
      const res = await fetch(input, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
        signal: AbortSignal.timeout(6000),
      });
      const html = await res.text();
      const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                   || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (ogMatch) ogImage = ogMatch[1];
      pageText = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                     .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                     .replace(/<[^>]+>/g, " ")
                     .replace(/\s+/g, " ")
                     .trim()
                     .slice(0, 4000);
    } catch {}
  }

  const context = isUrl
    ? (pageText ? `URL: ${input}\n\nPage content:\n${pageText}` : `URL: ${input}\n\n(Could not fetch page — infer from URL slug.)`)
    : input;

  const prompt = `Extract recipe details from this content and return ONLY raw JSON (no markdown, no backticks):

${context}

JSON schema:
{
  "title": "",
  "source": "",
  "description": "",
  "servings": 4,
  "ingredients": [
    { "amount": 2, "unit": "cup", "name": "plain flour" }
  ],
  "steps": [],
  "tags": [],
  "emoji": ""
}

Rules:
- servings: integer, the number of servings the recipe makes as written
- ingredients: structured objects with:
    - amount: number (e.g. 1.5, 0.25, 2) — use 0 if there is truly no quantity (e.g. "salt to taste")
    - unit: the unit string exactly as written or a standard abbreviation. Use these standard forms: "g", "kg", "ml", "L", "tsp", "tbsp", "cup", "oz", "lb", "bunch", "clove", "slice", "piece", "pinch" — or null if the ingredient is just counted (e.g. "2 eggs")
    - name: the ingredient name, stripped of the amount/unit
- tags: 2-5 lowercase single-word tags like "chicken", "dinner", "pasta", "vegan", "quick"
- emoji: single emoji representing this dish
- source: website name or platform
- steps: plain sentence strings`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return Response.json({ ok: true, recipe: parsed, ogImage });
  } catch {
    return Response.json({ ok: false, error: "Parse failed" }, { status: 422 });
  }
}
