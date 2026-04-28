/**
 * Lightweight site-load counter that piggy-backs on api.counterapi.dev,
 * a free public counter service. No auth, no setup, no Vercel paid plan.
 *
 *   POST /api/loads  → increment + return new count
 *   GET  /api/loads  → return current count without incrementing
 */

const NAMESPACE = "houston-pit-map";
const COUNTER = "loads";

interface CounterResponse {
  code: number;
  message?: string;
  data?: { up_count?: number; count?: number };
}

async function readCount(): Promise<number | null> {
  try {
    const r = await fetch(
      `https://api.counterapi.dev/v1/${NAMESPACE}/${COUNTER}`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as CounterResponse;
    return j.data?.count ?? j.data?.up_count ?? null;
  } catch {
    return null;
  }
}

async function incrementCount(): Promise<number | null> {
  try {
    const r = await fetch(
      `https://api.counterapi.dev/v1/${NAMESPACE}/${COUNTER}/up`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as CounterResponse;
    return j.data?.count ?? j.data?.up_count ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const count = await readCount();
  return Response.json(
    { count: count ?? 0, ok: count !== null },
    { headers: { "cache-control": "no-store" } }
  );
}

export async function POST() {
  const count = await incrementCount();
  return Response.json(
    { count: count ?? 0, ok: count !== null },
    { headers: { "cache-control": "no-store" } }
  );
}
