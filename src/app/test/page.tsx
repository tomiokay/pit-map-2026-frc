"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFavorites, useMapSize, useMyTeam, usePits } from "@/lib/store";
import type { DivisionId, Pit } from "@/lib/types";
import { DIVISIONS, DIVISION_BY_ID } from "@/lib/divisions";
import { SIDE_BY_DIVISION, type SideConfig } from "@/lib/sides";
import { EVENT_KEY_BY_DIVISION } from "@/lib/tba";
import { SearchBar } from "@/components/SearchBar";
import { TeamResult } from "@/components/TeamResult";
import { SideMap } from "@/components/SideMap";
import { TbaQueueWatcher } from "@/components/TbaQueueWatcher";

const DIVISION_KEY = "pit-map-test-division-v1";

export default function TestPage() {
  const { pits } = usePits();
  const { favorites, isFavorite, toggle } = useFavorites();
  const { size, setSize } = useMapSize();
  const { myTeam } = useMyTeam();
  const [division, setDivision] = useState<DivisionId | null>(null);
  const [query, setQuery] = useState("");
  const [highlightedTeam, setHighlightedTeam] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(DIVISION_KEY) as DivisionId | null;
    if (stored && DIVISION_BY_ID[stored]) setDivision(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (division) window.localStorage.setItem(DIVISION_KEY, division);
    else window.localStorage.removeItem(DIVISION_KEY);
  }, [division]);

  const scopedPits = useMemo(
    () => (division ? pits.filter((p) => p.division === division) : []),
    [pits, division]
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

  const exactMatch = useMemo(() => {
    const n = Number(query.trim());
    if (!query.trim() || Number.isNaN(n)) return null;
    return pitByTeam.get(n) ?? null;
  }, [query, pitByTeam]);

  useEffect(() => {
    if (exactMatch) setHighlightedTeam(exactMatch.team);
    else if (!query.trim()) setHighlightedTeam(null);
  }, [exactMatch, query]);

  useEffect(() => {
    if (!exactMatch) return;
    const team = exactMatch.team;
    const id = window.setTimeout(() => {
      const cell = document.querySelector<HTMLElement>(`[data-team="${team}"]`);
      cell?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }, 200);
    return () => window.clearTimeout(id);
  }, [exactMatch]);

  const singleSide: SideConfig | null = useMemo(() => {
    if (!division) return null;
    const meta = DIVISION_BY_ID[division];
    return {
      id: SIDE_BY_DIVISION[division].id,
      name: meta.name,
      subtitle: `${meta.drape} drape · ${
        SIDE_BY_DIVISION[division].name
      } · single-division view`,
      placements: [{ id: division, rowOffset: 0, colOffset: 0 }],
    };
  }, [division]);

  const noopQueueing = useCallback(() => {}, []);

  const headingDivisionName = division ? DIVISION_BY_ID[division].name : null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <header className="border-b border-neutral-800 pb-4">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            <span className="text-rose-400">/test</span>{" "}
            <span className="text-neutral-500 font-normal">·</span> Single-division
            sandbox
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Hidden testing page. Pick a division to scope search, map, and queue
            alerts.
          </p>
        </header>

        <section className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">
            Division
          </div>
          <div className="flex flex-wrap gap-2">
            {DIVISIONS.map((d) => {
              const isActive = division === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => {
                    setDivision(isActive ? null : d.id);
                    setQuery("");
                  }}
                  className={`text-sm px-3 py-1.5 rounded-full border transition flex items-center gap-2 ${
                    isActive
                      ? "bg-amber-500 text-neutral-950 border-amber-400 font-semibold"
                      : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-600"
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${d.swatch}`} />
                  {d.name}
                </button>
              );
            })}
            {division && (
              <button
                onClick={() => {
                  setDivision(null);
                  setQuery("");
                }}
                className="text-xs px-3 py-1.5 rounded-full bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              >
                Clear
              </button>
            )}
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
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </section>

        {!division && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 text-center text-sm text-neutral-400">
            Pick a division above to start.
          </div>
        )}

        {division && (
          <>
            <SearchBar
              value={query}
              onChange={setQuery}
              matchCount={matches.length}
            />

            <p className="text-[11px] text-neutral-500 -mt-3">
              Searching <strong className="text-neutral-300">{pitByTeam.size}</strong>{" "}
              teams in {headingDivisionName} only.
            </p>

            {exactMatch && (
              <TeamResult
                pit={exactMatch}
                isFavorite={isFavorite(exactMatch.team!)}
                favorites={favorites}
                onToggleFavorite={() => toggle(exactMatch.team!)}
                onJumpToMap={() => {
                  const cell = document.querySelector<HTMLElement>(
                    `[data-team="${exactMatch.team}"]`
                  );
                  cell?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "center",
                  });
                }}
              />
            )}

            {query.trim() && !exactMatch && matches.length > 0 && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
                <p className="text-xs text-neutral-400 mb-2">
                  No exact team {query} in {headingDivisionName}. Did you mean:
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
                No team <strong>{query}</strong> in {headingDivisionName}.
              </div>
            )}

            <TbaQueueWatcher
              divisionKey={EVENT_KEY_BY_DIVISION[division]}
              onQueueingChange={noopQueueing}
            />

            {singleSide && (
              <SideMap
                side={singleSide}
                pits={scopedPits}
                highlightedTeam={highlightedTeam}
                favorites={favorites}
                size={size}
                myTeam={myTeam}
                onPitClick={(pit) => {
                  if (pit.team !== null) setQuery(String(pit.team));
                }}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
