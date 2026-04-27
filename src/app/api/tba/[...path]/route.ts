import { NextRequest } from "next/server";

const TBA_BASE = "https://www.thebluealliance.com/api/v3";

// Server-side proxy for The Blue Alliance.
// Reads TBA_AUTH_KEY from env vars (never exposed to the browser) and forwards
// authenticated GET requests. Caches each upstream response for 60s so a
// venue full of phones polling the schedule doesn't blow our rate limit.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const upstreamPath = path.join("/");
  const search = req.nextUrl.search;
  const upstreamUrl = `${TBA_BASE}/${upstreamPath}${search}`;

  const key = process.env.TBA_AUTH_KEY;
  if (!key) {
    return new Response(
      JSON.stringify({ error: "TBA_AUTH_KEY env var is not configured." }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { "X-TBA-Auth-Key": key },
      // Vercel/Next.js fetch cache. 60s is short enough that "next match"
      // info stays fresh during eliminations and avoids hammering TBA.
      next: { revalidate: 60 },
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "public, max-age=30, s-maxage=60",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Upstream TBA fetch failed",
        detail: err instanceof Error ? err.message : String(err),
      }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  }
}
