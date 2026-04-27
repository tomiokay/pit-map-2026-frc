"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Pit } from "@/lib/types";
import { DIVISION_BY_ID } from "@/lib/divisions";
import { SIDES, SIDE_BY_DIVISION } from "@/lib/sides";
import {
  buildWalkableGrid,
  placePitsOnSide,
  planRoute,
  type RoutePlan,
} from "@/lib/router";
import {
  useCurrentRouteDraft,
  useSavedRoutes,
  type SavedRoute,
} from "@/lib/store";

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
  /** Lifted state so SideMap can dim non-active legs. */
  activeLeg?: number | null;
  setActiveLeg?: (leg: number | null) => void;
  /** Teams the TBA watcher reports as queueing. Always treated as avoid,
   *  on top of whatever the user manually typed. */
  autoAvoidTeams?: number[];
}

const APPROX_FT_PER_CELL = 7; // each grid cell ≈ 7 ft (pit + half aisle)
const APPROX_FT_PER_MIN = 280; // ≈ 3.2 mph
const INTER_HALL_FT = 1100;   // rough walk through GRB concourse + admin row
const INTER_HALL_MIN = INTER_HALL_FT / APPROX_FT_PER_MIN;

export function RoutePlanner({
  pits,
  myTeam,
  onPlan,
  onJumpToStop,
  routes,
  activeLeg: activeLegProp,
  setActiveLeg: setActiveLegProp,
  autoAvoidTeams = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [returnHome, setReturnHome] = useState(true);
  const [avoidText, setAvoidText] = useState("");
  const [doneTeams, setDoneTeams] = useState<number[]>([]);
  const [activeLegLocal, setActiveLegLocal] = useState<number | null>(null);
  const activeLeg = activeLegProp ?? activeLegLocal;
  const setActiveLeg = setActiveLegProp ?? setActiveLegLocal;
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [saveDraftName, setSaveDraftName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const { savedRoutes, saveRoute, deleteRoute } = useSavedRoutes();
  const { draft, hydrated, saveDraft } = useCurrentRouteDraft();
  const restoredRef = useRef(false);

  const pitByTeam = useMemo(() => {
    const m = new Map<number, Pit>();
    for (const p of pits) if (p.team !== null) m.set(p.team, p);
    return m;
  }, [pits]);

  const parseTeams = (raw: string): number[] => {
    const out: number[] = [];
    for (const tok of raw.split(/[\s,]+/)) {
      const t = tok.trim();
      if (!t) continue;
      const n = Number(t);
      if (Number.isFinite(n) && n > 0 && !out.includes(n)) out.push(n);
    }
    return out;
  };

  const requestedTeams = useMemo(() => parseTeams(text), [text]);
  const manualAvoidTeams = useMemo(() => parseTeams(avoidText), [avoidText]);
  // Combined avoid list: manual + auto (TBA queueing).
  const avoidTeams = useMemo(
    () => [...new Set([...manualAvoidTeams, ...autoAvoidTeams])],
    [manualAvoidTeams, autoAvoidTeams]
  );
  const doneSet = useMemo(() => new Set(doneTeams), [doneTeams]);
  // The list that actually gets routed: requested minus avoid minus done.
  const activeTeams = useMemo(
    () =>
      requestedTeams.filter((t) => !avoidTeams.includes(t) && !doneSet.has(t)),
    [requestedTeams, avoidTeams, doneSet]
  );

  const recognized = requestedTeams
    .map((t) => ({ team: t, pit: pitByTeam.get(t) ?? null }))
    .filter((r): r is { team: number; pit: Pit } => r.pit !== null);
  const missing = requestedTeams.filter((t) => !pitByTeam.has(t));

  const computePlans = (
    teams: number[],
    rh: boolean
  ): PlannedSideRoute[] => {
    if (myTeam == null) return [];
    const homePit = pitByTeam.get(myTeam);
    if (!homePit) return [];
    const homeSideId = SIDE_BY_DIVISION[homePit.division].id;
    const recognizedList = teams
      .map((t) => ({ team: t, pit: pitByTeam.get(t) ?? null }))
      .filter((r): r is { team: number; pit: Pit } => r.pit !== null);
    const otherHallHasVisits = recognizedList.some(
      (r) => SIDE_BY_DIVISION[r.pit.division].id !== homeSideId
    );

    const plans: PlannedSideRoute[] = [];
    // Visit the home hall first, then the other hall, so the trip reads as
    // one continuous walk: home → home-hall stops → concourse → other-hall
    // stops → concourse → home.
    const orderedSides = [...SIDES].sort((a, b) =>
      a.id === homeSideId ? -1 : b.id === homeSideId ? 1 : 0
    );
    for (const side of orderedSides) {
      const placed = placePitsOnSide(side, pits);
      const grid = buildWalkableGrid(placed);
      const sidePits = new Set(side.placements.map((p) => p.id));

      const homePlaced = placed.find(
        (p) => p.division === homePit.division && p.id === homePit.id
      );
      const visits = recognizedList
        .filter((r) => sidePits.has(r.pit.division))
        .map((r) =>
          placed.find((p) => p.division === r.pit.division && p.id === r.pit.id)!
        )
        .filter(Boolean);

      if (visits.length === 0) continue;

      let anchor = homePlaced;
      let stopsList = visits;
      let endAt: typeof visits[0] | undefined = undefined;
      const isHomeHall = side.id === homeSideId;

      // Pick the concourse-facing edge for this side:
      //   left side (Hall A) → exits/enters on its RIGHT edge
      //   right side (Hall E) → exits/enters on its LEFT edge
      const concourseSortByCol = (a: typeof visits[0], b: typeof visits[0]) =>
        side.id === "left" ? b.gridCol - a.gridCol : a.gridCol - b.gridCol;

      if (!homePlaced) {
        // Other hall — anchor at the concourse-side edge so we enter/exit
        // closest to the home hall.
        const sorted = [...visits].sort(concourseSortByCol);
        anchor = sorted[0];
        stopsList = sorted.slice(1);
      } else if (otherHallHasVisits && visits.length > 0) {
        // Home hall, but the trip continues to the other hall after this.
        // End on the concourse-side edge so the user can walk straight to
        // the other hall (Hall A ends on the right, Hall E ends on the left).
        const sorted = [...visits].sort(concourseSortByCol);
        endAt = sorted[0];
      }
      if (!anchor) continue;

      // Plan-options:
      //   home hall, no other-hall stops → respect the "return to my pit" toggle
      //   home hall, with other-hall stops → end at concourse-side edge, no return
      //   other hall → loop back to anchor so the user can retrace through concourse
      const planReturn = isHomeHall
        ? otherHallHasVisits
          ? false
          : rh
        : true;
      const plan = planRoute(anchor, stopsList, grid, {
        returnHome: planReturn,
        endAt,
      });
      plans.push({ sideId: side.id, plan });
    }
    return plans;
  };

  const handlePlan = () => {
    setActiveLeg(null);
    onPlan(computePlans(activeTeams, returnHome));
  };

  const handleClear = () => {
    setText("");
    setAvoidText("");
    setDoneTeams([]);
    setActiveLeg(null);
    onPlan([]);
    setShowSaveInput(false);
    setSaveDraftName("");
    saveDraft({ text: "", returnHome, avoidText: "", doneTeams: [] });
  };

  const markDone = (team: number) => {
    if (doneSet.has(team)) return;
    const nextDone = [...doneTeams, team];
    setDoneTeams(nextDone);
    // Re-plan immediately with this team excluded so the polyline updates.
    const nextActive = activeTeams.filter((t) => t !== team);
    setActiveLeg(null);
    onPlan(computePlans(nextActive, returnHome));
  };

  const undoDone = (team: number) => {
    setDoneTeams(doneTeams.filter((t) => t !== team));
    // Re-plan to bring it back into the route.
    const nextActive = [...activeTeams, team].filter(
      (t) => !avoidTeams.includes(t)
    );
    setActiveLeg(null);
    onPlan(computePlans(nextActive, returnHome));
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("route");
    url.searchParams.delete("return");
    url.searchParams.delete("avoid");
    if (requestedTeams.length > 0) url.searchParams.set("route", requestedTeams.join(","));
    if (!returnHome) url.searchParams.set("return", "0");
    if (avoidTeams.length > 0) url.searchParams.set("avoid", avoidTeams.join(","));
    const link = url.toString();
    const navAny = navigator as Navigator & {
      share?: (data: { title?: string; url?: string; text?: string }) => Promise<void>;
    };
    try {
      if (navAny.share) {
        await navAny.share({ title: "FRC Pit Route", url: link });
        setShareMessage("Shared!");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        setShareMessage("Link copied to clipboard");
      } else {
        setShareMessage(link);
      }
    } catch {
      setShareMessage("Couldn’t share. Copy manually: " + link);
    }
    window.setTimeout(() => setShareMessage(null), 4000);
  };

  // Restore the in-progress draft on mount (once `useCurrentRouteDraft` has
  // read from localStorage). URL query params override the draft so a
  // shared link can hand off a route to someone else.
  useEffect(() => {
    if (!hydrated) return;
    if (restoredRef.current) return;
    let nextText = draft.text;
    let nextReturn = draft.returnHome;
    let nextAvoid = draft.avoidText;
    let nextDone = draft.doneTeams;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const routeParam = params.get("route");
      if (routeParam) {
        nextText = routeParam.split(",").join(", ");
        nextReturn = params.get("return") !== "0";
        nextAvoid = params.get("avoid")?.split(",").join(", ") ?? "";
        nextDone = [];
        // Drop the params after consuming so refresh doesn't re-import.
        params.delete("route");
        params.delete("return");
        params.delete("avoid");
        const newSearch = params.toString();
        const newUrl =
          window.location.pathname +
          (newSearch ? `?${newSearch}` : "") +
          window.location.hash;
        window.history.replaceState({}, "", newUrl);
      }
    }
    setText(nextText);
    setReturnHome(nextReturn);
    setAvoidText(nextAvoid);
    setDoneTeams(nextDone);
    restoredRef.current = true;
  }, [hydrated, draft.text, draft.returnHome, draft.avoidText, draft.doneTeams]);

  // Once everything is hydrated AND the user has both a team set and pits
  // loaded, replay the saved draft so the polylines come back automatically.
  useEffect(() => {
    if (!restoredRef.current) return;
    if (myTeam == null) return;
    if (!text.trim()) return;
    const teams = parseTeams(text);
    const avoid = parseTeams(avoidText);
    const filtered = teams.filter(
      (t) => !avoid.includes(t) && !doneSet.has(t)
    );
    if (filtered.length === 0) return;
    onPlan(computePlans(filtered, returnHome));
    // We intentionally only run this once per draft restore — subsequent
    // edits go through handlePlan instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredRef.current, myTeam, pits.length]);

  // Persist draft whenever any tracked field changes (skip pre-hydration so
  // we don't clobber the stored draft with the initial empty state).
  useEffect(() => {
    if (!hydrated || !restoredRef.current) return;
    saveDraft({ text, returnHome, avoidText, doneTeams });
  }, [text, returnHome, avoidText, doneTeams, hydrated, saveDraft]);

  // When the TBA-driven auto-avoid set changes, replan in place so the
  // currently-displayed route reflects who's queueing now.
  const lastAutoAvoidRef = useRef("");
  useEffect(() => {
    if (!restoredRef.current) return;
    if (routes.length === 0) return;
    const sig = autoAvoidTeams.slice().sort().join(",");
    if (sig === lastAutoAvoidRef.current) return;
    lastAutoAvoidRef.current = sig;
    onPlan(computePlans(activeTeams, returnHome));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAvoidTeams]);

  const handleSave = () => {
    if (recognized.length === 0) return;
    const teamList = recognized.map((r) => r.team);
    saveRoute(saveDraftName, teamList, returnHome);
    setSaveDraftName("");
    setShowSaveInput(false);
  };

  const loadSavedRoute = (route: SavedRoute) => {
    setText(route.teams.join(", "));
    setReturnHome(route.returnHome);
    setDoneTeams([]);
    setActiveLeg(null);
    onPlan(computePlans(route.teams, route.returnHome));
  };

  if (myTeam == null) return null;

  const totalCells = routes.reduce((sum, r) => sum + r.plan.totalCells, 0);
  const inHallFt = totalCells * APPROX_FT_PER_CELL;
  const interHallTrips = routes.length >= 2 ? (returnHome ? 2 : 1) : 0;
  const interHallFt = interHallTrips * INTER_HALL_FT;
  const ft = inHallFt + interHallFt;
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
          {savedRoutes.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                Saved routes
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {savedRoutes.map((sr) => (
                  <li
                    key={sr.id}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-neutral-900 border border-neutral-700 hover:border-amber-500"
                  >
                    <button
                      onClick={() => loadSavedRoute(sr)}
                      className="text-neutral-200 hover:text-amber-300 tabular-nums"
                    >
                      {sr.name}
                      <span className="ml-1 text-neutral-500">
                        ({sr.teams.length})
                      </span>
                    </button>
                    <button
                      onClick={() => deleteRoute(sr.id)}
                      aria-label={`Delete saved route ${sr.name}`}
                      className="text-neutral-600 hover:text-rose-400 leading-none"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
                const isAvoided = avoidTeams.includes(r.team);
                const isDone = doneSet.has(r.team);
                return (
                  <span
                    key={r.team}
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border tabular-nums ${
                      isAvoided
                        ? "bg-rose-950/30 border-rose-900/60 text-rose-300 line-through"
                        : isDone
                        ? "bg-emerald-950/30 border-emerald-900/60 text-emerald-300 line-through"
                        : "bg-neutral-900 border-neutral-700"
                    }`}
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
          <details className="text-xs text-neutral-400">
            <summary className="cursor-pointer hover:text-neutral-200">
              Avoid teams (e.g. queueing — won’t be routed)
              {avoidTeams.length > 0 && (
                <span className="ml-2 text-rose-300">
                  · {avoidTeams.length} avoided
                </span>
              )}
            </summary>
            <textarea
              value={avoidText}
              onChange={(e) => setAvoidText(e.target.value)}
              rows={2}
              placeholder="111, 254, …"
              className="mt-1 w-full rounded-lg bg-neutral-950 border border-neutral-800 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/40 outline-none px-3 py-2 font-mono text-sm text-neutral-200"
            />
          </details>
          <label className="flex items-center gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={returnHome}
              onChange={(e) => setReturnHome(e.target.checked)}
              className="accent-amber-400"
            />
            Return to my pit at the end
          </label>
          <div className="flex flex-wrap items-center gap-2">
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
            {recognized.length > 0 && !showSaveInput && (
              <button
                onClick={() => setShowSaveInput(true)}
                className="text-sm px-3 py-1.5 rounded-md bg-emerald-500 text-neutral-950 font-semibold hover:bg-emerald-400"
              >
                Save…
              </button>
            )}
            {recognized.length > 0 && (
              <button
                onClick={handleShare}
                className="text-sm px-3 py-1.5 rounded-md bg-sky-500 text-neutral-950 font-semibold hover:bg-sky-400"
              >
                Share
              </button>
            )}
          </div>
          {shareMessage && (
            <p className="text-[11px] text-sky-300">{shareMessage}</p>
          )}
          {showSaveInput && (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={saveDraftName}
                onChange={(e) => setSaveDraftName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="Name this route (e.g. Friday morning rounds)"
                className="flex-1 rounded-md bg-neutral-950 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-100"
                autoFocus
              />
              <button
                onClick={handleSave}
                className="text-sm px-3 py-1.5 rounded-md bg-emerald-500 text-neutral-950 font-semibold hover:bg-emerald-400"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowSaveInput(false);
                  setSaveDraftName("");
                }}
                className="text-sm px-2 py-1.5 rounded-md text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
            </div>
          )}

          {routes.length > 0 && (
            <div className="pt-2 border-t border-neutral-800 space-y-2">
              <div className="text-xs text-neutral-400">
                ≈{ft.toFixed(0)} ft · {min < 1 ? "<1" : min.toFixed(0)} min walk
                {interHallTrips > 0 && (
                  <span className="text-neutral-500">
                    {" "}(includes {interHallTrips} concourse crossing
                    {interHallTrips === 1 ? "" : "s"} ≈
                    {(INTER_HALL_MIN * interHallTrips).toFixed(0)} min)
                  </span>
                )}
              </div>
              <ol className="space-y-1">
                {(() => {
                  const items: React.ReactNode[] = [];
                  let globalIdx = 0;
                  routes.forEach(({ sideId, plan }, hallIdx) => {
                    const side = SIDES.find((s) => s.id === sideId);
                    if (!side) return;

                    if (hallIdx > 0) {
                      items.push(
                        <li
                          key={`bridge-${sideId}`}
                          className="flex items-center gap-2 px-2 py-1.5 my-1 rounded-md bg-neutral-950 border border-dashed border-neutral-700 text-[11px] text-neutral-400"
                        >
                          <span className="text-base leading-none">🚶</span>
                          Walk through concourse to {side.name} (~
                          {INTER_HALL_MIN.toFixed(0)} min)
                        </li>
                      );
                    }

                    plan.stops.forEach((stop, idx) => {
                      const isPlanHome =
                        idx === 0 ||
                        (idx === plan.stops.length - 1 &&
                          plan.stops[0].pit.division === stop.pit.division &&
                          plan.stops[0].pit.id === stop.pit.id);
                      const div = DIVISION_BY_ID[stop.pit.division];
                      globalIdx += 1;
                      const labelChar = isPlanHome
                        ? idx === 0
                          ? "S"
                          : "E"
                        : String(globalIdx);
                      // Map this stop to a leg-index so clicking it can
                      // highlight the corresponding polyline segment. Leg i
                      // ends at stop i (legs are 1-indexed by stop, since
                      // stop 0 is home).
                      const legIdx = idx === 0 ? null : idx - 1;
                      const isActive = legIdx != null && activeLeg === legIdx && /* same hall */ true;
                      items.push(
                        <li
                          key={`${sideId}-${idx}`}
                          onClick={() => {
                            if (legIdx != null) {
                              setActiveLeg(activeLeg === legIdx ? null : legIdx);
                            }
                            onJumpToStop(stop.pit);
                          }}
                          className={`flex items-center gap-2 text-xs px-2 py-1 rounded-md cursor-pointer ${
                            isActive
                              ? "bg-amber-500/15 ring-1 ring-amber-400"
                              : "hover:bg-neutral-900"
                          }`}
                        >
                          <span
                            className={`w-5 h-5 grid place-items-center rounded-full text-[10px] font-bold ${
                              isPlanHome
                                ? "bg-emerald-400 text-neutral-950"
                                : "bg-amber-500 text-neutral-950"
                            }`}
                          >
                            {labelChar}
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
                          {!isPlanHome && stop.pit.team !== null && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markDone(stop.pit.team!);
                              }}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-neutral-950 font-bold"
                              title="Mark this stop done — removes it from the route"
                            >
                              ✓ done
                            </button>
                          )}
                        </li>
                      );
                    });
                  });
                  return items;
                })()}
              </ol>
              {routes.some((r) => r.plan.unreachable.length > 0) && (
                <p className="text-[11px] text-rose-300">
                  Couldn’t route to some pits — they may be on a different
                  side or completely walled in.
                </p>
              )}
              {doneTeams.length > 0 && (
                <div className="pt-2 border-t border-neutral-800/60">
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">
                    Marked done · {doneTeams.length}
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {doneTeams.map((t) => {
                      const pit = pitByTeam.get(t);
                      const div = pit ? DIVISION_BY_ID[pit.division] : null;
                      return (
                        <li
                          key={t}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-950/30 border border-emerald-900/40 text-emerald-300 line-through tabular-nums"
                        >
                          {div && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${div.swatch}`}
                            />
                          )}
                          {t}
                          <button
                            onClick={() => undoDone(t)}
                            aria-label={`Undo done for team ${t}`}
                            title="Undo — put this stop back in the route"
                            className="text-emerald-400 hover:text-emerald-200 leading-none ml-1"
                          >
                            ↺
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
