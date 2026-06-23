export async function POST(req) {
  const body = await req.json();
  const { input = "", imageBase64 = "", imageMediaType = "image/jpeg" } = body;
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

    // Fallback: fetch a real food photo from Foodish API (free, no key, returns actual food photos)
    if (!finalImage && parsed.imageSearch) {
      // Try multiple free image sources
      const query = encodeURIComponent(parsed.imageSearch);

      // 1. Try Wikimedia Commons food images (truly free, no API key)
      try {
        const wikiRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(parsed.title||parsed.imageSearch)}&prop=pageimages&format=json&pithumbsize=600&origin=*`,
          { signal: AbortSignal.timeout(3000) }
        );
        const wikiData = await wikiRes.json();
        const pages = Object.values(wikiData?.query?.pages || {});
        const thumb = pages[0]?.thumbnail?.source;
        if (thumb) finalImage = thumb;
      } catch {}

      // 2. Try Unsplash direct (new API format — different from deprecated source.unsplash.com)
      if (!finalImage) {
        // Use a curated food photo based on first tag — reliable CDN images
        const foodPhotos = {
          pasta: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80",
          chicken: "https://images.unsplash.com/photo-1598103442097-8b74394b95c7?w=600&q=80",
          beef: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80",
          fish: "https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&q=80",
          seafood: "https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&q=80",
          salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
          soup: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80",
          dessert: "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=600&q=80",
          breakfast: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&q=80",
          vegetarian: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
          vegan: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
          pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
          curry: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80",
          rice: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&q=80",
          cake: "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=600&q=80",
          sandwich: "https://images.unsplash.com/photo-1553909489-cd47e0907980?w=600&q=80",
          tacos: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80",
          burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
          stir: "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=600&q=80",
          bread: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600&q=80",
          default: "https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=600&q=80",
        };
        const search = (parsed.imageSearch + " " + (parsed.tags||[]).join(" ")).toLowerCase();
        const match = Object.keys(foodPhotos).find(k => search.includes(k));
        finalImage = foodPhotos[match || "default"];
      }
    }

    // If image was uploaded, use it as the og image
    if (imageBase64 && !finalImage) {
      finalImage = `data:${imageMediaType};base64,${imageBase64}`;
    }

    return Response.json({ ok:true, recipe:parsed, ogImage:finalImage });
  } catch {
    return Response.json({ ok:false, error:"Parse failed" }, { status:422 });
  }
}
