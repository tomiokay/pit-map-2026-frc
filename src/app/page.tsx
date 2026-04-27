"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFavorites, useMapSize, usePits } from "@/lib/store";
import type { Pit } from "@/lib/types";
import { SIDES, SIDE_BY_DIVISION } from "@/lib/sides";
import { SearchBar } from "@/components/SearchBar";
import { TeamResult } from "@/components/TeamResult";
import { FavoritesList } from "@/components/FavoritesList";
import { SideMap } from "@/components/SideMap";
import { CsvImporter } from "@/components/CsvImporter";
import { Legend } from "@/components/Legend";
import { LocationPanel } from "@/components/LocationPanel";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  const { pits, setPits, resetPits, isOverridden } = usePits();
  const { favorites, isFavorite, toggle, clear } = useFavorites();
  const { size, setSize } = useMapSize();
  const [query, setQuery] = useState("");
  const [activeSide, setActiveSide] = useState<string>("left");
  const [highlightedTeam, setHighlightedTeam] = useState<number | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const pitByTeam = useMemo(() => {
    const m = new Map<number, Pit>();
    for (const p of pits) if (p.team !== null) m.set(p.team, p);
    return m;
  }, [pits]);

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return pits.filter((p) => p.team !== null && String(p.team).startsWith(q));
  }, [query, pits]);

  const exactMatch = useMemo(() => {
    const n = Number(query.trim());
    if (!query.trim() || Number.isNaN(n)) return null;
    return pitByTeam.get(n) ?? null;
  }, [query, pitByTeam]);

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
  }, [pits.length]);

  const jumpToPit = (pit: Pit) => {
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

        <FavoritesList
          favorites={favorites}
          pitByTeam={pitByTeam}
          onToggle={toggle}
          onJump={jumpToPit}
          onClear={clear}
        />

        <LocationPanel />

        <Legend />

        <nav className="flex flex-wrap items-center gap-2 sticky top-[88px] z-20 bg-neutral-950 py-2 -mx-1 px-1 border-b border-neutral-800/80">
          {SIDES.map((s) => (
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
              <span className="text-[10px] opacity-70">({s.subtitle.split(" · ").length} divs)</span>
            </button>
          ))}
          <div
            className="ml-auto inline-flex rounded-full border border-neutral-800 bg-neutral-900 p-0.5"
            role="group"
            aria-label="Map size"
          >
            {(["S", "M", "L"] as const).map((sz) => (
              <button
                key={sz}
                onClick={() => setSize(sz)}
                className={`text-[11px] w-7 h-6 grid place-items-center rounded-full transition ${
                  size === sz
                    ? "bg-amber-500 text-neutral-950 font-bold"
                    : "text-neutral-400 hover:text-neutral-100"
                }`}
                title={
                  sz === "S"
                    ? "Small — see more of the map at once"
                    : sz === "M"
                    ? "Medium (default)"
                    : "Large — easier to read"
                }
              >
                {sz}
              </button>
            ))}
          </div>
        </nav>

        <div className="space-y-6">
          {SIDES.map((s) => (
            <div
              key={s.id}
              ref={(el) => {
                sectionRefs.current[s.id] = el;
              }}
              style={{ scrollMarginTop: 140 }}
            >
              <SideMap
                side={s}
                pits={pits}
                highlightedTeam={highlightedTeam}
                favorites={favorites}
                size={size}
                onPitClick={(pit) => {
                  if (pit.team !== null) {
                    setQuery(String(pit.team));
                  }
                }}
              />
            </div>
          ))}
        </div>

        <CsvImporter
          pits={pits}
          onLoad={setPits}
          onReset={resetPits}
          isOverridden={isOverridden}
        />

        <footer className="text-xs text-neutral-600 pt-6 pb-12 text-center space-y-1">
          <p>
            Bundled pit data was transcribed from the official maps and may contain typos.
            Verify against the official PDF before relying in the field — use the import panel
            above to overwrite with corrections.
          </p>
          <p className="opacity-60">Favorites & overrides are stored in your browser only.</p>
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
