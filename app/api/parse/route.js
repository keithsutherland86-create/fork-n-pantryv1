export async function POST(req) {
  const body = await req.json();
  const { input = "", imageBase64 = "", imageMediaType = "image/jpeg" } = body;
  const isUrl = input.trim().startsWith("http");
  let pageText = "", ogImage = "", ogTitle = "";

  if (isUrl) {
    // ── Step 1: Direct fetch for page content (needed for Claude to parse the recipe) ──
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
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
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

    // ── Step 2: If no image from direct fetch, try Microlink (headless browser, bypasses bot blocking) ──
    if (!ogImage) {
      try {
        const mlKey = process.env.MICROLINK_API_KEY;
        const mlUrl = `https://api.microlink.io?url=${encodeURIComponent(input)}${mlKey ? `&apiKey=${mlKey}` : ""}`;
        const mlRes = await fetch(mlUrl, { signal: AbortSignal.timeout(8000) });
        const mlData = await mlRes.json();
        if (mlData.status === "success") {
          if (mlData.data?.image?.url) ogImage = mlData.data.image.url;
          // If direct fetch got no page text either, use Microlink's metadata for Claude
          if (!pageText) {
            ogTitle = ogTitle || mlData.data?.title || "";
            pageText = [mlData.data?.title, mlData.data?.description].filter(Boolean).join(" ");
          }
        }
      } catch {}
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
- nutrition: estimate per serving (all integers)
- servings: integer
- prepTime/cookTime: "15 mins" style
- ingredients: amount (number), unit (abbrev or null for countable), name
- tags: 2-5 lowercase: chicken,dinner,pasta,vegan,quick,vegetarian,dessert,breakfast,soup,salad,beef,fish,seafood
- emoji: one dish emoji
- source: site/platform name
- imageSearch: 2-3 English words describing the dish for a food photo search e.g. "spaghetti carbonara pasta", "chocolate lava cake", "green thai curry"`;

  const context = imageBase64
    ? null
    : isUrl && pageText
      ? `URL: ${input}${ogTitle?`\nTitle: ${ogTitle}`:""}\n\nPage content:\n${pageText}`
      : isUrl ? `URL: ${input}` : input;

  const msgContent = imageBase64
    ? [
        { type:"image", source:{ type:"base64", media_type:imageMediaType, data:imageBase64 } },
        { type:"text", text:`Extract recipe details from this image. Return ONLY raw JSON, no markdown:\n\n${schema}\n\n${rules}` }
      ]
    : [{ type:"text", text:`Extract recipe details from this content. Return ONLY raw JSON, no markdown:\n\n${context}\n\n${schema}\n\n${rules}` }];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "x-api-key":process.env.ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01" },
    body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:1400, messages:[{ role:"user", content:msgContent }] }),
  });

  const data = await res.json();
  const text = data.content?.find(b=>b.type==="text")?.text || "{}";

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());

    let finalImage = ogImage;

    if (!finalImage && parsed.imageSearch) {
      // ── Option A: Unsplash API (50 req/hr free — add UNSPLASH_ACCESS_KEY in Vercel env vars) ──
      if (process.env.UNSPLASH_ACCESS_KEY) {
        try {
          const uRes = await fetch(
            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(parsed.imageSearch)}&per_page=1&orientation=landscape&client_id=${process.env.UNSPLASH_ACCESS_KEY}`,
            { signal: AbortSignal.timeout(4000) }
          );
          const uData = await uRes.json();
          const url = uData.results?.[0]?.urls?.regular;
          if (url) finalImage = url + "&w=600&q=80";
        } catch {}
      }

      // ── Option B: Hardcoded curated food photos by tag (always available, no key needed) ──
      if (!finalImage) {
        const foodPhotos = {
          pasta:       "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80",
          spaghetti:   "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80",
          chicken:     "https://images.unsplash.com/photo-1598103442097-8b74394b95c7?w=600&q=80",
          beef:        "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80",
          steak:       "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80",
          fish:        "https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&q=80",
          salmon:      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80",
          seafood:     "https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&q=80",
          shrimp:      "https://images.unsplash.com/photo-1565680018093-ebb6b9ab5460?w=600&q=80",
          prawn:       "https://images.unsplash.com/photo-1565680018093-ebb6b9ab5460?w=600&q=80",
          salad:       "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
          soup:        "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80",
          stew:        "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80",
          dessert:     "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=600&q=80",
          cake:        "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=600&q=80",
          chocolate:   "https://images.unsplash.com/photo-1606312619070-d48b2c0a3b3a?w=600&q=80",
          cookie:      "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&q=80",
          breakfast:   "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&q=80",
          pancake:     "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80",
          egg:         "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80",
          vegetarian:  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
          vegan:       "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
          pizza:       "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
          curry:       "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80",
          rice:        "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&q=80",
          fried:       "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=600&q=80",
          stir:        "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=600&q=80",
          sandwich:    "https://images.unsplash.com/photo-1553909489-cd47e0907980?w=600&q=80",
          wrap:        "https://images.unsplash.com/photo-1553909489-cd47e0907980?w=600&q=80",
          taco:        "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80",
          burger:      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
          bread:       "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600&q=80",
          muffin:      "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=600&q=80",
          noodle:      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80",
          ramen:       "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80",
          pork:        "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=600&q=80",
          lamb:        "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=600&q=80",
          mushroom:    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
          default:     "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
        };
        const search = (parsed.imageSearch + " " + (parsed.tags||[]).join(" ") + " " + (parsed.title||"")).toLowerCase();
        const match = Object.keys(foodPhotos).find(k => search.includes(k));
        finalImage = foodPhotos[match || "default"];
      }
    }

    // If image was uploaded, use it as the recipe image
    if (imageBase64 && !finalImage) {
      finalImage = `data:${imageMediaType};base64,${imageBase64}`;
    }

    return Response.json({ ok:true, recipe:parsed, ogImage:finalImage });
  } catch {
    return Response.json({ ok:false, error:"Parse failed" }, { status:422 });
  }
}
