// Thin client for our /api/tba/* proxy. The browser never sees the auth key
// — the server route attaches it. All requests are GET-only.

export interface TbaMatch {
  key: string;
  comp_level: string;
  match_number: number;
  set_number: number;
  alliances: {
    red: { team_keys: string[] };
    blue: { team_keys: string[] };
  };
  predicted_time: number | null;   // unix seconds, null until predicted
  time: number | null;              // scheduled
  actual_time: number | null;       // null until played
}

export interface QueueingTeam {
  team: number;
  matchKey: string;
  /** Seconds until the predicted/scheduled match start. */
  secondsUntilStart: number;
}

export async function fetchEventMatches(eventKey: string): Promise<TbaMatch[]> {
  const r = await fetch(`/api/tba/event/${encodeURIComponent(eventKey)}/matches/simple`);
  if (!r.ok) throw new Error(`TBA proxy returned ${r.status}`);
  return (await r.json()) as TbaMatch[];
}

/**
 * The 8 division events that share the GRB venue during 2026 Houston Worlds.
 * Each division is its own TBA event with its own match schedule and queue.
 */
export const HOUSTON_2026_DIVISION_KEYS = [
  "2026arc",
  "2026cur",
  "2026dal",
  "2026gal",
  "2026hop",
  "2026joh",
  "2026mil",
  "2026new",
] as const;

export async function fetchAllHoustonMatches(): Promise<{
  matches: TbaMatch[];
  failedDivisions: string[];
}> {
  const results = await Promise.all(
    HOUSTON_2026_DIVISION_KEYS.map(async (k) => {
      try {
        return { key: k, matches: await fetchEventMatches(k) };
      } catch {
        return { key: k, matches: null as TbaMatch[] | null };
      }
    })
  );
  const matches: TbaMatch[] = [];
  const failedDivisions: string[] = [];
  for (const r of results) {
    if (r.matches === null) failedDivisions.push(r.key);
    else matches.push(...r.matches);
  }
  return { matches, failedDivisions };
}

/** Teams whose match starts within `windowSeconds` seconds and hasn't been
 *  played yet. These are the teams a scout should avoid visiting because
 *  they're queueing or on the field. */
export function teamsCurrentlyQueueing(
  matches: TbaMatch[],
  windowSeconds: number,
  now: number = Date.now() / 1000
): QueueingTeam[] {
  const out: QueueingTeam[] = [];
  for (const m of matches) {
    if (m.actual_time !== null) continue; // already played
    const start = m.predicted_time ?? m.time;
    if (start === null) continue;
    const delta = start - now;
    if (delta < -300 || delta > windowSeconds) continue; // outside window
    const teams = [...m.alliances.red.team_keys, ...m.alliances.blue.team_keys];
    for (const tk of teams) {
      const num = Number(tk.replace(/^frc/, ""));
      if (Number.isFinite(num)) {
        out.push({ team: num, matchKey: m.key, secondsUntilStart: delta });
      }
    }
  }
  return out;
}

const TBA_KEY_KEY = "pit-map-tba-event-v1";

export function readSavedEventKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TBA_KEY_KEY) ?? "";
}

export function writeSavedEventKey(key: string): void {
  if (typeof window === "undefined") return;
  if (!key) window.localStorage.removeItem(TBA_KEY_KEY);
  else window.localStorage.setItem(TBA_KEY_KEY, key);
}
