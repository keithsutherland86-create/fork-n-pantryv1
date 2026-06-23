export async function POST(req) {
  const { input } = await req.json();
  const isUrl = input.trim().startsWith("http");

  let pageText = "", ogImage = "", ogTitle = "";

  if (isUrl) {
    try {
      const res = await fetch(input, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
        signal: AbortSignal.timeout(8000),
      });
      const html = await res.text();

      // OG image — try multiple patterns
      const ogImgMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      if (ogImgMatch) ogImage = ogImgMatch[1];

      // OG title
      const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
      if (ogTitleMatch) ogTitle = ogTitleMatch[1];

      pageText = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 5000);
    } catch {}
  }

  const context = isUrl
    ? (pageText
        ? `URL: ${input}${ogTitle ? `\nPage title: ${ogTitle}` : ""}\n\nPage content:\n${pageText}`
        : `URL: ${input}\n\n(Could not fetch page — infer from URL slug.)`)
    : input;

  const prompt = `Extract recipe details from this content. Return ONLY raw JSON, no markdown, no backticks:

${context}

Schema:
{
  "title": "",
  "source": "",
  "description": "",
  "servings": 4,
  "prepTime": "",
  "cookTime": "",
  "ingredients": [{ "amount": 2, "unit": "cup", "name": "plain flour" }],
  "steps": [],
  "tags": [],
  "emoji": ""
}

Rules:
- servings: integer
- prepTime / cookTime: strings like "15 mins", "1 hour" — omit if unknown
- ingredients: amount (number, 0 if none), unit (standard abbrev or null for countable), name (stripped of amount/unit)
- tags: 2-5 lowercase single words: "chicken","dinner","pasta","vegan","quick","vegetarian","dessert","breakfast","soup","salad"
- emoji: one emoji for the dish
- source: site name or platform`;

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
