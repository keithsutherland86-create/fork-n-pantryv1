export async function POST(req) {
  const contentType = req.headers.get("content-type") || "";
  let input = "", imageBase64 = "", imageMediaType = "";

  if (contentType.includes("application/json")) {
    const body = await req.json();
    input = body.input || "";
    imageBase64 = body.imageBase64 || "";
    imageMediaType = body.imageMediaType || "image/jpeg";
  }

  const isUrl = input.trim().startsWith("http");
  let pageText = "", ogImage = "", ogTitle = "";

  if (isUrl) {
    const agents = [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
      "Mozilla/5.0 (compatible; Googlebot/2.1)",
      "facebookexternalhit/1.1",
    ];
    let html = "";
    for (const ua of agents) {
      try {
        const r = await fetch(input, { headers: { "User-Agent": ua, "Accept": "text/html,*/*" }, signal: AbortSignal.timeout(6000) });
        if (r.ok) { html = await r.text(); break; }
      } catch {}
    }
    if (html) {
      const patterns = [
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
        /"thumbnailUrl"\s*:\s*"([^"]+)"/i,
        /"image"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m?.[1]?.startsWith("http")) { ogImage = m[1]; break; }
      }
      const t = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
      if (t) ogTitle = t[1];
      pageText = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi,"").replace(/<script[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,5000);
    }
  }

  const schema = `{
  "title": "",
  "source": "",
  "description": "",
  "servings": 4,
  "prepTime": "",
  "cookTime": "",
  "ingredients": [{ "amount": 2, "unit": "cup", "name": "plain flour" }],
  "steps": [],
  "tags": [],
  "emoji": "",
  "imageSearch": "",
  "nutrition": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }
}`;

  const rules = `Rules:
- nutrition: estimate per serving (calories as integer, protein/carbs/fat in grams as integers)
- servings: integer
- prepTime/cookTime: "15 mins" style, omit if unknown
- ingredients: amount (number), unit (abbrev or null), name
- tags: 2-5 lowercase: chicken,dinner,pasta,vegan,quick,vegetarian,dessert,breakfast,soup,salad,beef,fish
- emoji: one dish emoji
- source: site/platform name
- imageSearch: 2-3 word food photography term for this dish`;

  // Build message content
  const msgContent = imageBase64
    ? [
        { type: "image", source: { type: "base64", media_type: imageMediaType, data: imageBase64 } },
        { type: "text", text: `Extract recipe details from this image. Return ONLY raw JSON, no markdown:\n\n${schema}\n\n${rules}` }
      ]
    : [{ type: "text", text: `Extract recipe details from this content. Return ONLY raw JSON, no markdown:\n\n${
        isUrl && pageText
          ? `URL: ${input}${ogTitle?`\nTitle: ${ogTitle}`:""}\n\nPage content:\n${pageText}`
          : isUrl ? `URL: ${input}` : input
      }\n\n${schema}\n\n${rules}` }];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1400, messages: [{ role: "user", content: msgContent }] }),
  });

  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
    let finalImage = ogImage;
    if (!finalImage && parsed.imageSearch) {
      finalImage = `https://source.unsplash.com/600x400/?${encodeURIComponent(parsed.imageSearch + " food photography")}`;
    }
    // If image was uploaded, use it directly
    if (imageBase64 && !finalImage) {
      finalImage = `data:${imageMediaType};base64,${imageBase64}`;
    }
    return Response.json({ ok: true, recipe: parsed, ogImage: finalImage });
  } catch {
    return Response.json({ ok: false, error: "Parse failed" }, { status: 422 });
  }
}
