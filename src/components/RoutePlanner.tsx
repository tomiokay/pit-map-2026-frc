"use client";

import { useMemo, useState } from "react";
import type { Pit } from "@/lib/types";
import { DIVISION_BY_ID } from "@/lib/divisions";
import { SIDES, SIDE_BY_DIVISION } from "@/lib/sides";
import {
  buildWalkableGrid,
  placePitsOnSide,
  planRoute,
  type RoutePlan,
} from "@/lib/router";

export interface PlannedSideRoute {
  sideId: string;
  plan: RoutePlan;
}

interface Props {
  pits: Pit[];
  myTeam: number | null;
  onPlan: (routes: PlannedSideRoute[]) => void;
  onJumpToStop: (pit: Pit) => void;
  routes: PlannedSideRoute[];
}

const APPROX_FT_PER_CELL = 7; // each grid cell ≈ 7 ft (pit + half aisle)
const APPROX_FT_PER_MIN = 280; // ≈ 3.2 mph

export function RoutePlanner({ pits, myTeam, onPlan, onJumpToStop, routes }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [returnHome, setReturnHome] = useState(true);

  const pitByTeam = useMemo(() => {
    const m = new Map<number, Pit>();
    for (const p of pits) if (p.team !== null) m.set(p.team, p);
    return m;
  }, [pits]);

  const requestedTeams = useMemo(() => {
    const out: number[] = [];
    for (const tok of text.split(/[\s,]+/)) {
      const t = tok.trim();
      if (!t) continue;
      const n = Number(t);
      if (Number.isFinite(n) && n > 0 && !out.includes(n)) out.push(n);
    }
    return out;
  }, [text]);

  const recognized = requestedTeams
    .map((t) => ({ team: t, pit: pitByTeam.get(t) ?? null }))
    .filter((r): r is { team: number; pit: Pit } => r.pit !== null);
  const missing = requestedTeams.filter((t) => !pitByTeam.has(t));

  const handlePlan = () => {
    if (myTeam == null) return;
    const homePit = pitByTeam.get(myTeam);
    if (!homePit) return;

    const plans: PlannedSideRoute[] = [];
    for (const side of SIDES) {
      const placed = placePitsOnSide(side, pits);
      const grid = buildWalkableGrid(placed);
      const sidePits = new Set(side.placements.map((p) => p.id));

      const homePlaced = placed.find(
        (p) => p.division === homePit.division && p.id === homePit.id
      );
      const visits = recognized
        .filter((r) => sidePits.has(r.pit.division))
        .map((r) =>
          placed.find((p) => p.division === r.pit.division && p.id === r.pit.id)!
        )
        .filter(Boolean);

      // If home is on a different side, we still want to plan the route on
      // this side — pick a synthetic anchor (the first visit) instead of home.
      if (visits.length === 0) continue;

      let anchor = homePlaced;
      let stopsList = visits;
      if (!homePlaced) {
        anchor = visits[0];
        stopsList = visits.slice(1);
      }
      if (!anchor) continue;

      const plan = planRoute(anchor, stopsList, grid, { returnHome });
      plans.push({ sideId: side.id, plan });
    }
    onPlan(plans);
  };

  const handleClear = () => {
    setText("");
    onPlan([]);
  };

  if (myTeam == null) return null;

  const totalCells = routes.reduce((sum, r) => sum + r.plan.totalCells, 0);
  const ft = totalCells * APPROX_FT_PER_CELL;
  const min = ft / APPROX_FT_PER_MIN;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-neutral-300 hover:text-neutral-100"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden>🧭</span>
          Plan Route
          {routes.length > 0 && (
            <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
              {routes.reduce((c, r) => c + r.plan.stops.length - 1, 0)} stops
            </span>
          )}
        </span>
        <span className="text-xs text-neutral-500">{open ? "hide" : "open"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-amber-300/90 bg-amber-950/30 border border-amber-900/40 rounded-md px-2 py-1.5">
            ⚠ Pit assignments may have transcription errors. Always verify with
            the official event map before walking off.
          </p>
          <div>
            <label className="text-xs text-neutral-400 block mb-1">
              Teams to visit (comma- or newline-separated)
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="254, 2056, 1323, …"
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 outline-none px-3 py-2 font-mono text-sm text-neutral-200"
            />
          </div>
          {recognized.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recognized.map((r) => {
                const div = DIVISION_BY_ID[r.pit.division];
                return (
                  <span
                    key={r.team}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 tabular-nums"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${div.swatch}`} />
                    {r.team}
                    <span className="text-neutral-500">· {r.pit.id}</span>
                  </span>
                );
              })}
            </div>
          )}
          {missing.length > 0 && (
            <p className="text-[11px] text-rose-300">
              Not in dataset: {missing.join(", ")}
            </p>
          )}
          <label className="flex items-center gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={returnHome}
              onChange={(e) => setReturnHome(e.target.checked)}
              className="accent-amber-400"
            />
            Return to my pit at the end
          </label>
          <div className="flex gap-2">
            <button
              onClick={handlePlan}
              disabled={recognized.length === 0}
              className="text-sm px-3 py-1.5 rounded-md bg-amber-500 text-neutral-950 font-semibold hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Plan route
            </button>
            <button
              onClick={handleClear}
              className="text-sm px-3 py-1.5 rounded-md bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            >
              Clear
            </button>
          </div>

          {routes.length > 0 && (
            <div className="pt-2 border-t border-neutral-800 space-y-2">
              <div className="text-xs text-neutral-400">
                ≈{ft.toFixed(0)} ft · {min < 1 ? "<1" : min.toFixed(0)} min walk
              </div>
              {routes.map(({ sideId, plan }) => {
                const side = SIDES.find((s) => s.id === sideId);
                if (!side) return null;
                return (
                  <div key={sideId} className="space-y-1">
                    <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                      {side.name} — {plan.stops.length - 1} stops
                    </div>
                    <ol className="space-y-1">
                      {plan.stops.map((stop, idx) => {
                        const div = DIVISION_BY_ID[stop.pit.division];
                        const isHome =
                          idx === 0 ||
                          (idx === plan.stops.length - 1 && returnHome);
                        return (
                          <li
                            key={`${sideId}-${idx}`}
                            onClick={() => onJumpToStop(stop.pit)}
                            className="flex items-center gap-2 text-xs px-2 py-1 rounded-md hover:bg-neutral-900 cursor-pointer"
                          >
                            <span
                              className={`w-5 h-5 grid place-items-center rounded-full text-[10px] font-bold ${
                                isHome
                                  ? "bg-emerald-400 text-neutral-950"
                                  : "bg-amber-500 text-neutral-950"
                              }`}
                            >
                              {isHome
                                ? idx === 0
                                  ? "S"
                                  : "E"
                                : idx}
                            </span>
                            <span className={`w-1.5 h-1.5 rounded-full ${div.swatch}`} />
                            <span className="font-bold tabular-nums w-14 text-amber-400">
                              {stop.pit.team ?? "—"}
                            </span>
                            <span className="text-neutral-300 tabular-nums w-12">
                              {stop.pit.id}
                            </span>
                            <span className="text-neutral-500 truncate flex-1">
                              {div.name}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
              {routes.some((r) => r.plan.unreachable.length > 0) && (
                <p className="text-[11px] text-rose-300">
                  Couldn’t route to some pits — they may be on a different
                  side or completely walled in.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
