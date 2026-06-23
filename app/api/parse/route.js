export async function POST(req) {
  const { input } = await req.json();
  const isUrl = input.trim().startsWith("http");

  let pageText = "", ogImage = "", ogTitle = "";

  if (isUrl) {
    try {
      // Try multiple user agents — some sites block bots but allow browsers
      const agents = [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      ];
      let html = "";
      for (const ua of agents) {
        try {
          const r = await fetch(input, {
            headers: { "User-Agent": ua, "Accept": "text/html,application/xhtml+xml,*/*" },
            signal: AbortSignal.timeout(6000),
          });
          if (r.ok) { html = await r.text(); break; }
        } catch {}
      }

      if (html) {
        // OG image — multiple patterns including JSON-LD
        const patterns = [
          /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
          /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
          /"thumbnailUrl"\s*:\s*"([^"]+)"/i,
          /"image"\s*:\s*\{\s*"@type"\s*:\s*"ImageObject"\s*,\s*"url"\s*:\s*"([^"]+)"/i,
          /"image"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i,
        ];
        for (const p of patterns) {
          const m = html.match(p);
          if (m && m[1] && m[1].startsWith("http")) { ogImage = m[1]; break; }
        }

        const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
        if (ogTitleMatch) ogTitle = ogTitleMatch[1];

        pageText = html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 5000);
      }
    } catch {}
  }

  // If still no image, try Unsplash source as a food photo fallback
  // (free, no API key needed, returns a relevant food photo)
  let fallbackImage = "";
  // We'll generate this after we know the dish title

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
  "emoji": "",
  "imageSearch": ""
}

Rules:
- servings: integer
- prepTime / cookTime: strings like "15 mins", "1 hour"
- ingredients: amount (number, 0 if none), unit (abbrev or null), name
- tags: 2-5 lowercase: "chicken","dinner","pasta","vegan","quick","vegetarian","dessert","breakfast","soup","salad"
- emoji: one emoji for the dish
- source: site name or platform
- imageSearch: 2-3 word food photography search term for this dish (e.g. "spaghetti carbonara", "chocolate lava cake", "green curry") — used to find a photo if none available`;

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

    // If no OG image found, use Unsplash source with the dish search term
    // This is a free CDN-style URL — no API key needed
    if (!ogImage && parsed.imageSearch) {
      const q = encodeURIComponent(parsed.imageSearch + " food");
      fallbackImage = `https://source.unsplash.com/600x400/?${q}`;
    }

    return Response.json({
      ok: true,
      recipe: parsed,
      ogImage: ogImage || fallbackImage,
    });
  } catch {
    return Response.json({ ok: false, error: "Parse failed" }, { status: 422 });
  }
}
