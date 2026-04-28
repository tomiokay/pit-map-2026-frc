"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAllHoustonMatches,
  fetchEventMatches,
  HOUSTON_2026_DIVISION_KEYS,
  shouldRefreshSchedule,
  teamsCurrentlyQueueing,
  type HoustonEventKey,
  type QueueingTeam,
  type TbaMatch,
} from "@/lib/tba";

interface Props {
  onQueueingChange: (teams: number[]) => void;
  /** When set, only watch this single division's matches instead of all 8. */
  divisionKey?: HoustonEventKey;
}

const TICK_MS = 60_000;
const WINDOW_S = 300;
const ENABLED_KEY = "pit-map-tba-enabled-v1";

export function TbaQueueWatcher({ onQueueingChange, divisionKey }: Props) {
  const watchedKeys = divisionKey ? [divisionKey] : HOUSTON_2026_DIVISION_KEYS;
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [queueing, setQueueing] = useState<QueueingTeam[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [failedDivisions, setFailedDivisions] = useState<string[]>([]);
  // Cached match list — refilled only on hard refresh. The minute-by-minute
  // tick re-evaluates queueing against this cache without a network call.
  const matchesRef = useRef<TbaMatch[]>([]);

  // Restore on/off preference; default to ON.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(ENABLED_KEY);
    if (stored === "0") setEnabled(false);
  }, []);

  const recompute = useCallback(() => {
    const q = teamsCurrentlyQueueing(matchesRef.current, WINDOW_S);
    setQueueing(q);
    onQueueingChange(q.map((t) => t.team));
  }, [onQueueingChange]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = divisionKey
        ? await fetchEventMatches(divisionKey).then(
            (matches) => ({ matches, failedDivisions: [] as string[] }),
            () => ({ matches: [] as TbaMatch[], failedDivisions: [divisionKey] })
          )
        : await fetchAllHoustonMatches();
      matchesRef.current = result.matches;
      setFailedDivisions(result.failedDivisions);
      setLastFetched(Date.now());
      if (result.failedDivisions.length === watchedKeys.length) {
        setError("Couldn’t reach TBA — check your TBA_AUTH_KEY env var.");
      }
      recompute();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
      onQueueingChange([]);
    } finally {
      setIsLoading(false);
    }
  }, [divisionKey, onQueueingChange, recompute, watchedKeys.length]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
    }
    if (!enabled) {
      onQueueingChange([]);
      return;
    }
    // Initial pull. Subsequent ticks recompute locally; we only refetch when
    // the cache is stale (every 30 min) or a playoff match looks overdue.
    void refresh();
    const id = window.setInterval(() => {
      const last = lastFetchedRef.current ?? 0;
      if (shouldRefreshSchedule(matchesRef.current, last)) {
        void refresh();
      } else {
        recompute();
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Mirror lastFetched into a ref so the interval callback can read it
  // without resubscribing every refresh.
  const lastFetchedRef = useRef<number | null>(null);
  useEffect(() => {
    lastFetchedRef.current = lastFetched;
  }, [lastFetched]);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-neutral-300 hover:text-neutral-100"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden>🚦</span>
          Queue alerts
          {enabled && queueing.length > 0 && (
            <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 tabular-nums">
              {queueing.length} queueing
            </span>
          )}
          {enabled && queueing.length === 0 && !error && lastFetched && (
            <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              none queueing
            </span>
          )}
          {!enabled && (
            <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
              off
            </span>
          )}
        </span>
        <span className="text-xs text-neutral-500">{open ? "hide" : "open"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-neutral-400">
            {divisionKey
              ? `Watching only ${divisionKey} matches.`
              : `Pulls match schedules for all 8 Houston divisions (${HOUSTON_2026_DIVISION_KEYS.join(
                  ", "
                )})`}{" "}
            from The Blue Alliance and auto-adds teams queueing or on the field
            within the next {WINDOW_S / 60} min to your route’s avoid list.
            Refreshes every minute.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEnabled((e) => !e)}
              className={`text-sm px-3 py-1.5 rounded-md font-semibold transition ${
                enabled
                  ? "bg-rose-500 text-neutral-950 hover:bg-rose-400"
                  : "bg-amber-500 text-neutral-950 hover:bg-amber-400"
              }`}
            >
              {enabled ? "Stop tracking" : "Start tracking"}
            </button>
            {enabled && (
              <button
                onClick={() => void refresh()}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 rounded-md bg-neutral-800 text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
              >
                {isLoading ? "Refreshing…" : "Refresh now"}
              </button>
            )}
            {enabled && lastFetched && !isLoading && (
              <span className="text-[11px] text-neutral-500">
                Last refresh: {new Date(lastFetched).toLocaleTimeString()}
              </span>
            )}
          </div>
          {error && <p className="text-xs text-rose-300">{error}</p>}
          {failedDivisions.length > 0 &&
            failedDivisions.length < watchedKeys.length && (
              <p className="text-[11px] text-amber-300/80">
                Some divisions returned errors:{" "}
                {failedDivisions.join(", ")}. Other divisions are still being
                tracked.
              </p>
            )}
          {enabled && queueing.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">
                Currently queueing
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {queueing
                  .slice()
                  .sort((a, b) => a.secondsUntilStart - b.secondsUntilStart)
                  .map((q) => (
                    <li
                      key={`${q.matchKey}-${q.team}`}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-950/30 border border-rose-900/50 text-rose-200 tabular-nums"
                      title={`Match ${q.matchKey} starts in ${Math.round(q.secondsUntilStart / 60)} min`}
                    >
                      {q.team}
                      <span className="text-neutral-500">
                        ·{" "}
                        {q.secondsUntilStart < 0
                          ? "now"
                          : `${Math.max(1, Math.round(q.secondsUntilStart / 60))}m`}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
