"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchEventMatches,
  readSavedEventKey,
  teamsCurrentlyQueueing,
  writeSavedEventKey,
  type QueueingTeam,
} from "@/lib/tba";

interface Props {
  /** Called whenever the queueing-team set changes so the route planner can
   *  treat them as auto-avoid. */
  onQueueingChange: (teams: number[]) => void;
}

const POLL_MS = 60_000; // refresh every minute
const WINDOW_S = 300;   // teams queueing within this many seconds count

export function TbaQueueWatcher({ onQueueingChange }: Props) {
  const [eventKey, setEventKey] = useState("");
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [queueing, setQueueing] = useState<QueueingTeam[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const saved = readSavedEventKey();
    if (saved) {
      setEventKey(saved);
      setEnabled(true);
    }
  }, []);

  const refresh = useCallback(
    async (key: string) => {
      if (!key) return;
      setIsLoading(true);
      setError(null);
      try {
        const matches = await fetchEventMatches(key);
        const q = teamsCurrentlyQueueing(matches, WINDOW_S);
        setQueueing(q);
        onQueueingChange(q.map((t) => t.team));
        setLastFetched(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fetch failed");
        onQueueingChange([]);
      } finally {
        setIsLoading(false);
      }
    },
    [onQueueingChange]
  );

  useEffect(() => {
    if (!enabled || !eventKey) {
      onQueueingChange([]);
      return;
    }
    void refresh(eventKey);
    const id = window.setInterval(() => void refresh(eventKey), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, eventKey, refresh, onQueueingChange]);

  const toggleEnabled = () => {
    if (!eventKey.trim()) return;
    const next = !enabled;
    setEnabled(next);
    writeSavedEventKey(next ? eventKey.trim() : "");
  };

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
          {enabled && queueing.length === 0 && (
            <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              none queueing
            </span>
          )}
        </span>
        <span className="text-xs text-neutral-500">{open ? "hide" : "open"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-neutral-400">
            Pulls the match schedule from The Blue Alliance and auto-adds any
            team queueing or on the field within the next {WINDOW_S / 60} min
            to your route’s “avoid” list. Refreshes every minute.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={eventKey}
              onChange={(e) => setEventKey(e.target.value.trim())}
              placeholder="Event key — e.g. 2026hou"
              className="flex-1 rounded-md bg-neutral-950 border border-neutral-700 focus:border-amber-400 outline-none px-3 py-1.5 font-mono text-sm text-neutral-200"
            />
            <button
              onClick={toggleEnabled}
              disabled={!eventKey.trim()}
              className={`text-sm px-3 py-1.5 rounded-md font-semibold transition ${
                enabled
                  ? "bg-rose-500 text-neutral-950 hover:bg-rose-400"
                  : "bg-amber-500 text-neutral-950 hover:bg-amber-400"
              } disabled:opacity-40`}
            >
              {enabled ? "Stop" : "Start"}
            </button>
          </div>
          {enabled && (
            <div className="text-[11px] text-neutral-500 flex items-center gap-2">
              {isLoading ? "Refreshing…" : null}
              {!isLoading && lastFetched && (
                <>Last refresh: {new Date(lastFetched).toLocaleTimeString()}</>
              )}
              <button
                onClick={() => void refresh(eventKey)}
                className="ml-auto text-neutral-300 hover:text-amber-300"
              >
                Refresh now
              </button>
            </div>
          )}
          {error && (
            <p className="text-xs text-rose-300">
              {error}
              {error.includes("404") && " — check the event key spelling."}
              {error.includes("500") && " — TBA_AUTH_KEY missing on server."}
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
