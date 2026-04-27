"use client";

import type { Pit } from "@/lib/types";
import { DIVISION_BY_ID } from "@/lib/divisions";
import { colorForFavorite } from "@/lib/favoriteColors";

interface Props {
  divisionId: string;
  pits: Pit[];
  highlightedTeam: number | null;
  favorites: number[];
  onPitClick?: (pit: Pit) => void;
}

export function DivisionGrid({ divisionId, pits, highlightedTeam, favorites, onPitClick }: Props) {
  const div = DIVISION_BY_ID[divisionId];
  if (!div) return null;

  const divPits = pits.filter((p) => p.division === divisionId);
  if (divPits.length === 0) {
    return (
      <div className="text-sm text-neutral-500 italic">No pits loaded for this division.</div>
    );
  }

  const maxRow = Math.max(...divPits.map((p) => p.row));
  const maxCol = Math.max(...divPits.map((p) => p.col));

  const cells: Map<string, Pit> = new Map();
  for (const p of divPits) cells.set(`${p.row},${p.col}`, p);

  const populatedRows = new Set(divPits.map((p) => p.row));
  const populatedCols = new Set(divPits.map((p) => p.col));

  const rowsArr = Array.from({ length: maxRow + 1 }, (_, r) => r);
  const colsArr = Array.from({ length: maxCol + 1 }, (_, c) => c);

  const colTemplate = colsArr
    .map((c) => (populatedCols.has(c) ? "60px" : "28px"))
    .join(" ");
  const rowTemplate = rowsArr
    .map((r) => (populatedRows.has(r) ? "60px" : "20px"))
    .join(" ");

  const favSet = new Set(favorites);

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ring-1 ring-white/10 ${div.swatch}`} />
          <h3 className="font-bold text-neutral-100">{div.name}</h3>
          <span className="text-xs text-neutral-500">{div.drape} drape</span>
        </div>
        <span className="text-xs text-neutral-500 tabular-nums">{divPits.length} pits</span>
      </header>
      <div className="w-full overflow-x-auto">
      <div
        className="grid gap-2 select-none w-max mx-auto"
        style={{
          gridTemplateColumns: colTemplate,
          gridTemplateRows: rowTemplate,
        }}
      >
        {rowsArr.map((r) =>
          colsArr.map((c) => {
            const pit = cells.get(`${r},${c}`);
            if (!pit) {
              return <div key={`${r}-${c}`} />;
            }
            const isHighlight = pit.team !== null && pit.team === highlightedTeam;
            const isFav = pit.team !== null && favSet.has(pit.team);
            const isSpecial = pit.status !== "TEAM";
            const baseColor = isSpecial
              ? "bg-neutral-800/60 border-neutral-700 text-neutral-500"
              : "bg-neutral-900 border-neutral-700 text-neutral-100";
            let highlightClass = "";
            if (isHighlight) {
              highlightClass = "ring-2 ring-white bg-white/15 border-white text-white animate-pulse";
            } else if (isFav && pit.team !== null) {
              highlightClass = colorForFavorite(pit.team, favorites).cell;
            }
            return (
              <button
                key={pit.id}
                onClick={() => onPitClick?.(pit)}
                className={`relative rounded-md border flex flex-col items-center justify-center px-1 text-center transition ${baseColor} ${highlightClass}`}
                title={pit.team ? `Team ${pit.team} – Pit ${pit.id}` : `${pit.id} – ${pit.status}`}
              >
                <div className="font-mono text-[10px] leading-none text-neutral-500">{pit.id}</div>
                <div className="font-bold tabular-nums text-[13px] sm:text-sm leading-tight mt-0.5">
                  {pit.status === "TEAM" ? pit.team : pit.status}
                </div>
                {isFav && pit.team !== null && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full ${colorForFavorite(pit.team, favorites).dot} ring-1 ring-neutral-950`}
                    aria-hidden
                  />
                )}
              </button>
            );
          })
        )}
      </div>
      </div>
    </section>
  );
}
