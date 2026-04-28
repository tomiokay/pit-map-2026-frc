"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "pit-map-session-counted-v1";

/**
 * Fires a single POST to /api/loads on mount. Uses sessionStorage to dedupe
 * within the same tab, so refreshing doesn't count again until the tab is
 * closed. Then renders the current count in the footer.
 */
export function SiteLoadCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const alreadyCounted =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(SESSION_KEY) === "1";

    async function go() {
      try {
        const r = await fetch(alreadyCounted ? "/api/loads" : "/api/loads", {
          method: alreadyCounted ? "GET" : "POST",
        });
        const j = (await r.json()) as { count: number; ok: boolean };
        if (!cancelled && j.ok) setCount(j.count);
        if (!alreadyCounted && typeof window !== "undefined") {
          window.sessionStorage.setItem(SESSION_KEY, "1");
        }
      } catch {
        // network error — silent, footer just shows nothing
      }
    }
    void go();
    return () => {
      cancelled = true;
    };
  }, []);

  if (count == null) return null;
  return (
    <p className="opacity-50">
      <span className="tabular-nums">{count.toLocaleString()}</span> loads
    </p>
  );
}
