"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFavorites, useMapSize, useMyTeam, usePits } from "@/lib/store";
import type { DivisionId, Pit } from "@/lib/types";
import { DIVISIONS, DIVISION_BY_ID } from "@/lib/divisions";
import { SIDES, SIDE_BY_DIVISION, type SideConfig } from "@/lib/sides";
import { EVENT_KEY_BY_DIVISION } from "@/lib/tba";
import { SearchBar } from "@/components/SearchBar";
import { TeamResult } from "@/components/TeamResult";
import { FavoritesList } from "@/components/FavoritesList";
import { SideMap } from "@/components/SideMap";
import { Legend } from "@/components/Legend";
import { SiteLoadCounter } from "@/components/SiteLoadCounter";
import { LocationPanel } from "@/components/LocationPanel";
import { MyTeamCard } from "@/components/MyTeamCard";
import { RoutePlanner } from "@/components/RoutePlanner";
import { planMultiSideRoute, type PlannedSideRoute } from "@/lib/router";
import { TbaQueueWatcher } from "@/components/TbaQueueWatcher";
import { ThemeToggle } from "@/components/ThemeToggle";

const SCOPE_KEY = "pit-map-scope-division-v1";

export default function Home() {
  const { pits } = usePits();
  const { favorites, isFavorite, toggle, clear } = useFavorites();
  const { size, setSize } = useMapSize();
  const { myTeam, setMyTeam } = useMyTeam();
  const [query, setQuery] = useState("");
  const [activeSide, setActiveSide] = useState<string>("left");
  const [highlightedTeam, setHighlightedTeam] = useState<number | null>(null);
  const [routes, setRoutes] = useState<PlannedSideRoute[]>([]);
  const [activeLeg, setActiveLeg] = useState<number | null>(null);
  const [queueingTeams, setQueueingTeams] = useState<number[]>([]);
  const [scopeDivision, setScopeDivision] = useState<DivisionId | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(SCOPE_KEY) as DivisionId | null;
    if (stored && DIVISION_BY_ID[stored]) setScopeDivision(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (scopeDivision) window.localStorage.setItem(SCOPE_KEY, scopeDivision);
    else window.localStorage.removeItem(SCOPE_KEY);
  }, [scopeDivision]);

  const fullPitByTeam = useMemo(() => {
    const m = new Map<number, Pit>();
    for (const p of pits) if (p.team !== null) m.set(p.team, p);
    return m;
  }, [pits]);

  const scopedPits = useMemo(
    () =>
      scopeDivision ? pits.filter((p) => p.division === scopeDivision) : pits,
    [pits, scopeDivision]
  );

  const pitByTeam = useMemo(() => {
    const m = new Map<number, Pit>();
    for (const p of scopedPits) if (p.team !== null) m.set(p.team, p);
    return m;
  }, [scopedPits]);

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return scopedPits.filter(
      (p) => p.team !== null && String(p.team).startsWith(q)
    );
  }, [query, scopedPits]);

  const myTeamPit = myTeam != null ? fullPitByTeam.get(myTeam) ?? null : null;
  const myTeamOutsideScope =
    scopeDivision != null &&
    myTeam != null &&
    (myTeamPit?.division ?? null) !== scopeDivision;

  const hiddenFavoritesCount = useMemo(() => {
    if (!scopeDivision) return 0;
    return favorites.filter((t) => {
      const p = fullPitByTeam.get(t);
      return p && p.division !== scopeDivision;
    }).length;
  }, [favorites, fullPitByTeam, scopeDivision]);

  const sidesToRender: SideConfig[] = useMemo(() => {
    if (!scopeDivision) return SIDES;
    const meta = DIVISION_BY_ID[scopeDivision];
    return [
      {
        id: SIDE_BY_DIVISION[scopeDivision].id,
        name: meta.name,
        subtitle: `${meta.drape} drape · ${SIDE_BY_DIVISION[scopeDivision].name} · single-division view`,
        placements: [{ id: scopeDivision, rowOffset: 0, colOffset: 0 }],
      },
    ];
  }, [scopeDivision]);

  const exactMatch = useMemo(() => {
    const n = Number(query.trim());
    if (!query.trim() || Number.isNaN(n)) return null;
    return pitByTeam.get(n) ?? null;
  }, [query, pitByTeam]);

  const searchRoutes: PlannedSideRoute[] = useMemo(() => {
    const homePit = myTeam != null ? fullPitByTeam.get(myTeam) ?? null : null;
    if (!homePit || !exactMatch) return [];
    if (exactMatch.team === myTeam) return [];
    if (scopeDivision && homePit.division !== scopeDivision) return [];
    return planMultiSideRoute(pits, homePit, [exactMatch], { returnHome: false });
  }, [exactMatch, fullPitByTeam, myTeam, pits, scopeDivision]);

  useEffect(() => {
    if (exactMatch) {
      setHighlightedTeam(exactMatch.team);
      setActiveSide(SIDE_BY_DIVISION[exactMatch.division].id);
    } else if (!query.trim()) {
      setHighlightedTeam(null);
    }
  }, [exactMatch, query]);

  // Jump back to the top of the page on the first keystroke so the result
  // card animates in. After we get an exact match, scroll the matching cell
  // into the center of the viewport so the user can see it on the map.
  const wasEmpty = useRef(true);
  useEffect(() => {
    const isEmpty = !query.trim();
    if (wasEmpty.current && !isEmpty) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    wasEmpty.current = isEmpty;
  }, [query]);

  useEffect(() => {
    if (!exactMatch) return;
    const team = exactMatch.team;
    // Wait a tick so the right side map is mounted/visible (state may have
    // just flipped activeSide above) before we try to find the cell.
    const id = window.setTimeout(() => {
      const cell = document.querySelector<HTMLElement>(`[data-team="${team}"]`);
      if (cell) {
        cell.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    }, 350);
    return () => window.clearTimeout(id);
  }, [exactMatch]);

  // Watch each side section so the sticky nav chip auto-updates to whichever
  // hall is currently in view. Triggers when ~50% of a side's height is in
  // the middle band of the viewport.
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SIDES.forEach((s) => {
      const el = sectionRefs.current[s.id];
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSide(s.id);
        },
        { rootMargin: "-35% 0px -35% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [pits.length, scopeDivision]);

  const jumpToPit = (pit: Pit) => {
    // If the pit is outside the current scope, clear scope so it can render.
    if (scopeDivision && pit.division !== scopeDivision) {
      setScopeDivision(null);
    }
    const sideId = SIDE_BY_DIVISION[pit.division].id;
    setActiveSide(sideId);
    setHighlightedTeam(pit.team);
    // Center the actual cell in the viewport, falling back to the side
    // section if the cell can't be found (e.g. INSP slots have no team).
    window.setTimeout(() => {
      if (pit.team !== null) {
        const cell = document.querySelector<HTMLElement>(
          `[data-team="${pit.team}"]`
        );
        if (cell) {
          cell.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
          });
          return;
        }
      }
      sectionRefs.current[sideId]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <SearchBar value={query} onChange={setQuery} matchCount={matches.length} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              FRC Houston <span className="text-amber-400">Pit Finder</span>
            </h1>
            <p className="text-xs text-neutral-500">
              2026 World Championship — search any team and pin favorites.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500 tabular-nums">
              {pitByTeam.size} teams loaded
            </span>
            <ThemeToggle />
          </div>
        </header>

        {exactMatch && (
          <TeamResult
            pit={exactMatch}
            isFavorite={isFavorite(exactMatch.team!)}
            favorites={favorites}
            onToggleFavorite={() => toggle(exactMatch.team!)}
            onJumpToMap={() => jumpToPit(exactMatch)}
          />
        )}

        {query.trim() && !exactMatch && matches.length > 0 && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
            <p className="text-xs text-neutral-400 mb-2">
              No exact team {query}. Did you mean:
            </p>
            <ul className="flex flex-wrap gap-2">
              {matches.slice(0, 24).map((p) => (
                <li key={`${p.id}-${p.team}`}>
                  <button
                    onClick={() => setQuery(String(p.team))}
                    className="text-xs px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 tabular-nums"
                  >
                    <span className="text-amber-400 font-bold">{p.team}</span>{" "}
                    <span className="text-neutral-400">· {p.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {query.trim() && !exactMatch && matches.length === 0 && (
          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3 text-sm text-rose-200">
            No pit matches for team <strong>{query}</strong>. Check the number or import the full
            roster CSV below.
          </div>
        )}

        {scopeDivision && (
          <section className="rounded-xl border border-amber-700/40 bg-amber-950/15 px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[10px] uppercase tracking-widest text-amber-300/80">
                Scoped
              </span>
              <span
                className={`w-2 h-2 rounded-full ${DIVISION_BY_ID[scopeDivision].swatch}`}
              />
              <span className="font-bold text-amber-200">
                {DIVISION_BY_ID[scopeDivision].name}
              </span>
              <span className="text-[11px] text-neutral-500">
                · {pitByTeam.size} teams
              </span>
            </div>
            <button
              onClick={() => setScopeDivision(null)}
              className="text-xs px-3 py-1 rounded-full bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            >
              Show all divisions
            </button>
          </section>
        )}

        {myTeamOutsideScope && myTeamPit && (
          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 px-4 py-2.5 text-xs text-rose-200 flex items-center gap-2 flex-wrap">
            <span aria-hidden>⚠</span>
            <span>
              Your team <strong className="tabular-nums">{myTeam}</strong> is in{" "}
              <strong>{DIVISION_BY_ID[myTeamPit.division].name}</strong> — outside
              the current scope.
            </span>
            <button
              onClick={() => setScopeDivision(myTeamPit.division)}
              className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            >
              Switch scope
            </button>
          </div>
        )}

        <MyTeamCard
          myTeam={myTeam}
          myPit={myTeam != null ? pitByTeam.get(myTeam) ?? null : null}
          onSet={setMyTeam}
          onJump={jumpToPit}
        />

        <FavoritesList
          favorites={
            scopeDivision
              ? favorites.filter(
                  (t) => fullPitByTeam.get(t)?.division === scopeDivision
                )
              : favorites
          }
          pitByTeam={pitByTeam}
          onToggle={toggle}
          onJump={jumpToPit}
          onClear={clear}
        />

        {scopeDivision && hiddenFavoritesCount > 0 && (
          <p className="text-[11px] text-neutral-500 -mt-3">
            + {hiddenFavoritesCount} favorite
            {hiddenFavoritesCount === 1 ? "" : "s"} hidden in other divisions.{" "}
            <button
              onClick={() => setScopeDivision(null)}
              className="underline hover:text-neutral-300"
            >
              Show all
            </button>
          </p>
        )}

        <RoutePlanner
          pits={pits}
          myTeam={myTeam}
          routes={routes}
          activeLeg={activeLeg}
          setActiveLeg={setActiveLeg}
          autoAvoidTeams={queueingTeams}
          onPlan={setRoutes}
          onJumpToStop={jumpToPit}
          scopeDivision={scopeDivision}
        />

        <TbaQueueWatcher
          onQueueingChange={setQueueingTeams}
          divisionKey={
            scopeDivision ? EVENT_KEY_BY_DIVISION[scopeDivision] : undefined
          }
        />

        <LocationPanel />

        <Legend />

        <nav className="sticky top-[88px] z-20 bg-neutral-950 py-2 -mx-1 px-1 border-b border-neutral-800/80 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 mr-1">
              Scope
            </span>
            <button
              onClick={() => setScopeDivision(null)}
              className={`text-xs px-2.5 py-1 rounded-full border transition ${
                scopeDivision === null
                  ? "bg-amber-500 text-neutral-950 border-amber-400 font-semibold"
                  : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-600"
              }`}
            >
              All
            </button>
            {DIVISIONS.map((d) => (
              <button
                key={d.id}
                onClick={() => setScopeDivision(d.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1.5 ${
                  scopeDivision === d.id
                    ? "bg-amber-500 text-neutral-950 border-amber-400 font-semibold"
                    : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-600"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${d.swatch}`} />
                {d.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!scopeDivision &&
              SIDES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSide(s.id);
                    sectionRefs.current[s.id]?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition ${
                    activeSide === s.id
                      ? "bg-amber-500 text-neutral-950 border-amber-400 font-semibold"
                      : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-600"
                  }`}
                >
                  {s.name}
                  <span className="text-[10px] opacity-70">
                    ({s.subtitle.split(" · ").length} divs)
                  </span>
                </button>
              ))}
            <div
              className="ml-auto inline-flex rounded-full border border-neutral-800 bg-neutral-900 p-0.5"
              role="group"
              aria-label="Map size"
            >
              {(["XS", "S", "M", "L"] as const).map((sz) => (
                <button
                  key={sz}
                  onClick={() => setSize(sz)}
                  className={`text-[11px] h-6 px-2 grid place-items-center rounded-full transition ${
                    size === sz
                      ? "bg-amber-500 text-neutral-950 font-bold"
                      : "text-neutral-400 hover:text-neutral-100"
                  }`}
                  title={
                    sz === "XS"
                      ? "Extra small — fit the whole hall on screen"
                      : sz === "S"
                      ? "Small — see more of the map at once"
                      : sz === "M"
                      ? "Medium"
                      : "Large — easier to read"
                  }
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="space-y-6">
          {sidesToRender.map((s) => (
            <div
              key={s.id}
              ref={(el) => {
                sectionRefs.current[s.id] = el;
              }}
              style={{ scrollMarginTop: 140 }}
            >
              <SideMap
                side={s}
                pits={scopedPits}
                highlightedTeam={highlightedTeam}
                favorites={favorites}
                size={size}
                myTeam={myTeam}
                route={
                  searchRoutes.find((r) => r.sideId === s.id)?.plan ??
                  routes.find((r) => r.sideId === s.id)?.plan ??
                  null
                }
                activeLeg={activeLeg}
                onPitClick={(pit) => {
                  if (pit.team !== null) {
                    setQuery(String(pit.team));
                  }
                }}
              />
            </div>
          ))}
        </div>

        <footer className="text-xs text-neutral-600 pt-6 pb-12 text-center space-y-1">
          <p>
            Bundled pit data was transcribed from the official maps and may
            contain typos — always verify against the official PDF before
            walking off.
          </p>
          <p className="opacity-60">
            Favorites & routes are stored in your browser only.
          </p>
          <SiteLoadCounter />
          <p className="pt-3 text-neutral-500">
            Made by{" "}
            <span className="text-neutral-300 font-semibold">Athan Wang</span>{" "}
            ·{" "}
            <a
              href="https://www.thebluealliance.com/team/7558"
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:underline tabular-nums"
            >
              Team 7558
            </a>
          </p>
        </footer>
      </div>

      <button
        onClick={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
          setTimeout(() => {
            const input = document.querySelector<HTMLInputElement>('input[type="search"]');
            input?.focus();
          }, 250);
        }}
        className="fixed bottom-4 right-4 z-40 sm:hidden rounded-full w-12 h-12 bg-amber-500 text-neutral-950 grid place-items-center shadow-xl"
        aria-label="Search"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
      </button>
    </main>
  );
}
