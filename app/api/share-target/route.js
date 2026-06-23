export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url") || "";
  const text = searchParams.get("text") || "";
  const title = searchParams.get("title") || "";
  const shared = url || text || title;
  const dest = shared ? `/?shared=${encodeURIComponent(shared)}` : "/";
  return Response.redirect(new URL(dest, req.url), 302);
}
